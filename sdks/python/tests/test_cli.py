import json
from pathlib import Path

import pytest
import yaml

from lingva._auth import auth_status, clear_credentials, credential_token, store_api_key
from lingva._cli import create_parser, run
from lingva._config import load_cli_config
from lingva._local import TRANSLATION_KEY_MAX_LENGTH, build_bundle, sync_local_files


def write_project(root: Path) -> Path:
    config_file = root / "lingva.config.yaml"
    config_file.write_text(
        yaml.safe_dump(
            {
                "projectId": "python-service",
                "environment": "stage",
                "locales": ["en", "de"],
                "defaultLocale": "en",
                "fallbackLocale": "en",
                "translationFiles": ".lingva/translations/{locale}.json",
                "apiUrl": "https://api.example.com",
            },
            sort_keys=False,
        ),
        encoding="utf-8",
    )
    translations = root / ".lingva" / "translations"
    translations.mkdir(parents=True)
    (translations / "en.json").write_text(
        json.dumps(
            {
                "actions": {"save": "Save"},
                "welcome": [
                    {"id": "formal", "tone": "formal", "text": "Welcome"},
                    {"id": "casual", "tone": "casual", "text": "Hi"},
                ],
            }
        ),
        encoding="utf-8",
    )
    (translations / "de.json").write_text(
        json.dumps(
            {
                "welcome": [
                    {"id": "formal", "tone": "formal", "text": "Willkommen"},
                ]
            }
        ),
        encoding="utf-8",
    )
    return config_file


def test_cli_exposes_help_and_version(capsys: pytest.CaptureFixture[str]):
    with pytest.raises(SystemExit) as help_exit:
        create_parser().parse_args(["--help"])
    assert help_exit.value.code == 0
    assert "auth" in capsys.readouterr().out

    with pytest.raises(SystemExit) as version_exit:
        create_parser().parse_args(["--version"])
    assert version_exit.value.code == 0
    assert "0.1.5" in capsys.readouterr().out


def test_auth_api_key_credentials_are_shared_without_exposing_the_key(tmp_path: Path):
    credentials_file = tmp_path / "credentials.json"
    store_api_key(
        "lvk_test_1234567890abcdef",
        project_id="python-service",
        path=credentials_file,
    )

    status = auth_status(credentials_file)
    assert status["authenticated"] is True
    assert status["authMethod"] == "api-key"
    assert status["apiKeyPreview"] == "lvk_test...cdef"
    assert "lvk_test_1234567890abcdef" not in json.dumps(status)
    assert credential_token(credentials_file) == "lvk_test_1234567890abcdef"

    clear_credentials(credentials_file)
    assert auth_status(credentials_file)["authenticated"] is False


def test_sync_matches_node_blank_key_and_variant_contract(tmp_path: Path):
    config_file = write_project(tmp_path)

    result = sync_local_files(load_cli_config(config_file), write=True)
    german = json.loads((tmp_path / ".lingva" / "translations" / "de.json").read_text())

    assert result["hasDrift"] is True
    assert german == {
        "actions": {"save": ""},
        "welcome": [
            {"id": "formal", "tone": "formal", "text": "Willkommen"},
            {"id": "casual", "tone": "casual", "text": ""},
        ],
    }


def test_sync_discovers_default_config(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    write_project(tmp_path)
    monkeypatch.chdir(tmp_path)

    exit_code = run(["sync", "--dry-run"])

    assert exit_code == 0


def test_sync_and_bundle_reject_keys_outside_the_portable_contract(tmp_path: Path):
    config_file = write_project(tmp_path)
    config = load_cli_config(config_file)
    invalid_key = "a" * (TRANSLATION_KEY_MAX_LENGTH + 1)
    english_file = tmp_path / ".lingva" / "translations" / "en.json"
    english_file.write_text(json.dumps({invalid_key: "Too long"}), encoding="utf-8")

    with pytest.raises(ValueError, match="at most 200 characters"):
        sync_local_files(config, write=False)

    with pytest.raises(ValueError, match="at most 200 characters"):
        build_bundle(config, "en", {"en": {invalid_key: "Too long"}})


def test_check_discovers_default_config_without_writing(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
):
    write_project(tmp_path)
    german_file = tmp_path / ".lingva" / "translations" / "de.json"
    before = german_file.read_text()
    monkeypatch.chdir(tmp_path)

    exit_code = run(["check", "--format", "json"])

    assert exit_code == 1
    assert german_file.read_text() == before


def test_init_creates_portable_config_and_locale_files(tmp_path: Path):
    config_file = tmp_path / "lingva.config.yaml"

    exit_code = run(
        [
            "init",
            "--mode",
            "local",
            "--no-auth",
            "--config-file",
            str(config_file),
            "--project-id",
            "python-service",
            "--locale",
            "en,de",
        ]
    )

    assert exit_code == 0
    assert yaml.safe_load(config_file.read_text())["locales"] == ["en", "de"]
    assert (tmp_path / ".lingva" / "translations" / "en.json").exists()
    assert (tmp_path / ".lingva" / "translations" / "de.json").exists()
    assert (tmp_path / ".lingva" / ".gitignore").read_text() == "remote-state.json\n"


def test_remote_init_requires_authentication(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr("lingva._cli.load_credentials", lambda: None)

    with pytest.raises(ValueError, match="auth login"):
        run(["init", "--sdk", "python", "--non-interactive"])


def test_remote_init_discovers_the_only_accessible_project(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(
        "lingva._cli.load_credentials",
        lambda: {"accessToken": "oauth-token", "platformUrl": "https://stage.lingva.dev"},
    )
    monkeypatch.setattr(
        "lingva._cli.list_platform_projects",
        lambda token, platform_url: [
            {
                "projectId": "python-service",
                "name": "Python service",
                "defaultLocale": "en",
                "locales": ["en", "de"],
                "environments": [
                    {"environmentId": "stage", "publishApiUrl": "https://publish.example.test"}
                ],
            }
        ],
    )

    assert run(["init", "--sdk", "python", "--non-interactive"]) == 0
    config = yaml.safe_load((tmp_path / "lingva.config.yaml").read_text())
    assert config["projectId"] == "python-service"
    assert config["environment"] == "stage"
    assert config["apiUrl"] == "https://publish.example.test"


def test_update_suggests_the_exact_python_upgrade_command(monkeypatch: pytest.MonkeyPatch, capsys):
    monkeypatch.setattr("lingva._cli._latest_sdk_version", lambda: "9.0.0")

    assert run(["update"]) == 0
    assert "python -m pip install --upgrade lingva-sdk" in capsys.readouterr().out


def test_push_uses_common_hosted_publish_contract(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    write_project(tmp_path)
    captured = {}
    monkeypatch.chdir(tmp_path)

    def fake_push(config, locales, token, output_dir, *, base_revision, force):
        captured.update(
            config=config,
            locales=locales,
            token=token,
            output_dir=output_dir,
            base_revision=base_revision,
            force=force,
        )
        return {
            "projectId": config.project_id,
            "publishId": "publish_1",
            "manifestKey": "stage/publish/manifest.json",
        }

    monkeypatch.setattr("lingva._cli.push_translations", fake_push)

    exit_code = run(
        [
            "push",
            "--locale",
            "de",
            "--auth-token",
            "secret",
            "--force",
            "--output-dir",
            "artifacts",
            "--format",
            "json",
        ]
    )

    assert exit_code == 0
    assert captured["locales"] == ("de",)
    assert captured["token"] == "secret"
    assert captured["output_dir"] == tmp_path / "artifacts"
    assert captured["base_revision"] is None
    assert captured["force"] is True


def test_pull_writes_hosted_messages_and_variants(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    write_project(tmp_path)
    (tmp_path / ".lingva" / "translations" / "de.json").write_text("{}\n")
    monkeypatch.chdir(tmp_path)

    monkeypatch.setattr(
        "lingva._cli.pull_bundle",
        lambda config, locale, token: (
            {
                "messages": {
                    "actions.save": "Speichern",
                    "actions.cancel": "Cancel",
                    "welcome": "Willkommen",
                },
                "sources": {
                    "actions.save": "de",
                    "actions.cancel": "en",
                    "welcome": "de",
                },
                "variants": {
                    "welcome": [
                        {"id": "formal", "tone": "formal", "text": "Willkommen"},
                        {"id": "casual", "tone": "casual", "text": "Hallo"},
                    ]
                },
            },
            "publish_1",
        ),
    )

    exit_code = run(["pull", "--locale", "de"])
    german = json.loads((tmp_path / ".lingva" / "translations" / "de.json").read_text())

    assert exit_code == 0
    assert german["actions"]["save"] == "Speichern"
    assert "cancel" not in german["actions"]
    assert german["welcome"][1]["text"] == "Hallo"
