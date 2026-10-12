import json
from pathlib import Path

import pytest
import yaml

from lingva import LingvaClient, LingvaSchemaError

FIXTURE_PATH = Path(__file__).parent.parent.parent / "fixtures" / "en.bundle.json"


@pytest.fixture()
def fixture_bundle() -> dict:
    return json.loads(FIXTURE_PATH.read_text())


def test_loads_fixture_bundle(fixture_bundle):
    client = LingvaClient.from_bundle(fixture_bundle)
    assert client.locale == "en"


def test_translates_simple_key(fixture_bundle):
    client = LingvaClient.from_bundle(fixture_bundle)
    assert client.t("actions.continue") == "Continue"


def test_interpolates_variable(fixture_bundle):
    client = LingvaClient.from_bundle(fixture_bundle)
    assert client.t("welcome.title", name="Alice") == "Welcome, Alice."


def test_selects_variant_by_id_or_metadata():
    bundle = {
        "schemaVersion": 1,
        "locale": "en",
        "messages": {"welcome.title": "Welcome"},
        "variants": {
            "welcome.title": [
                {"id": "warm", "tone": "warm", "text": "Welcome, {name}."},
                {"id": "bold", "tone": "bold", "text": "Ship it, {name}!"},
            ]
        },
    }
    client = LingvaClient.from_bundle(bundle)

    assert client.t("welcome.title", variant="bold", name="Yury") == "Ship it, Yury!"
    assert client.t("welcome.title", variant={"tone": "warm"}, name="Yury") == "Welcome, Yury."
    assert client.t("welcome.title", variant="unknown", name="Yury") == "Welcome, Yury."


def test_has_returns_true_for_known_key(fixture_bundle):
    client = LingvaClient.from_bundle(fixture_bundle)
    assert client.has("actions.continue") is True


def test_has_returns_false_for_unknown_key(fixture_bundle):
    client = LingvaClient.from_bundle(fixture_bundle)
    assert client.has("nonexistent.key") is False


def test_returns_key_for_missing_translation(fixture_bundle):
    client = LingvaClient.from_bundle(fixture_bundle)
    assert client.t("nonexistent.key") == "nonexistent.key"


def test_rejects_wrong_schema_version():
    with pytest.raises(LingvaSchemaError):
        LingvaClient.from_bundle({"schemaVersion": 99, "messages": {}})


def test_fallback_bundle_used_for_missing_key():
    primary = {"schemaVersion": 1, "locale": "fr", "fallbackLocale": "en", "messages": {}, "fallbackKeys": []}
    fallback = {"schemaVersion": 1, "locale": "en", "messages": {"greeting": "Hello"}, "fallbackKeys": []}
    client = LingvaClient(primary, fallback)
    assert client.t("greeting") == "Hello"


def test_fallback_keys_list_forces_fallback():
    primary = {
        "schemaVersion": 1, "locale": "fr", "fallbackLocale": "en",
        "messages": {"greeting": "Bonjour"},
        "fallbackKeys": ["greeting"],
    }
    fallback = {"schemaVersion": 1, "locale": "en", "messages": {"greeting": "Hello"}, "fallbackKeys": []}
    client = LingvaClient(primary, fallback)
    assert client.t("greeting") == "Hello"


def test_from_file_loads_fixture():
    client = LingvaClient.from_file(FIXTURE_PATH)
    assert client.t("actions.continue") == "Continue"


def test_from_config_loads_raw_local_translations_with_fallback(tmp_path: Path):
    config_file = tmp_path / "lingva.config.yaml"
    config_file.write_text(
        yaml.safe_dump(
            {
                "projectId": "python-service",
                "environment": "dev",
                "locales": ["en", "ru"],
                "defaultLocale": "en",
                "fallbackLocale": "en",
                "translationFiles": ".lingva/translations/{locale}.json",
            },
            sort_keys=False,
        ),
        encoding="utf-8",
    )
    translations = tmp_path / ".lingva" / "translations"
    translations.mkdir(parents=True)
    (translations / "en.json").write_text(
        json.dumps({"actions": {"continue": "Continue"}, "welcome": "Welcome, {name}!"}),
        encoding="utf-8",
    )
    (translations / "ru.json").write_text(
        json.dumps({"welcome": "Добро пожаловать, {name}!"}),
        encoding="utf-8",
    )

    client = LingvaClient.from_config("ru", config_file=config_file)

    assert client.locale == "ru"
    assert client.t("welcome", name="Yury") == "Добро пожаловать, Yury!"
    assert client.t("actions.continue") == "Continue"


def test_from_config_rejects_unconfigured_locale(tmp_path: Path):
    config_file = tmp_path / "lingva.config.yaml"
    config_file.write_text(
        yaml.safe_dump(
            {
                "projectId": "python-service",
                "locales": ["en"],
                "defaultLocale": "en",
                "translationFiles": ".lingva/translations/{locale}.json",
            }
        ),
        encoding="utf-8",
    )

    with pytest.raises(ValueError, match='locale "ru" is not configured'):
        LingvaClient.from_config("ru", config_file=config_file)


def test_unknown_variable_passes_through(fixture_bundle):
    client = LingvaClient.from_bundle(fixture_bundle)
    # {name} is known but {extra} is not — {extra} should remain
    result = client.t("welcome.title", name="Bob")
    assert result == "Welcome, Bob."
