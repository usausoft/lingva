from pathlib import Path

import pytest

_native_cli = pytest.importorskip("lingva_cli._launcher")


def test_resolve_binary_honors_explicit_override(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    binary = tmp_path / "lingva"
    binary.write_bytes(b"binary")
    binary.chmod(0o755)
    monkeypatch.setenv("LINGVA_CLI_BINARY", str(binary))

    assert _native_cli.resolve_binary() == binary


def test_target_maps_supported_python_platform(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(_native_cli.platform, "system", lambda: "Linux")
    monkeypatch.setattr(_native_cli.platform, "machine", lambda: "x86_64")

    assert _native_cli._target() == ("x86_64-unknown-linux-musl", "tar.gz")


def test_asset_base_uses_the_public_npm_binary_channel(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("LINGVA_CLI_ASSET_BASE_URL", raising=False)

    assert (
        _native_cli._asset_base_url("1.2.3")
        == "https://unpkg.com/@lingva/cli@1.2.3/assets"
    )


def test_main_never_falls_back_to_python_cli(monkeypatch: pytest.MonkeyPatch) -> None:
    def missing_binary() -> Path:
        raise RuntimeError("native binary unavailable")

    monkeypatch.setattr(_native_cli, "resolve_binary", missing_binary)

    with pytest.raises(SystemExit) as error:
        _native_cli.main()
    assert error.value.code == 1
