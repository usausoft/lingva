"""Adapter edge cases use local archives; no registry or cloud dependency."""

from concurrent.futures import ThreadPoolExecutor
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
from types import SimpleNamespace
import tarfile
import time
import zipfile

import pytest
from lingva_cli import _launcher as launcher


@pytest.fixture
def cache(tmp_path, monkeypatch):
    monkeypatch.delenv("LINGVA_CLI_BINARY", raising=False)
    monkeypatch.setenv("LINGVA_CLI_CACHE_DIR", str(tmp_path / "cache"))
    monkeypatch.setattr(launcher, "_target", lambda: ("test-target", "tar.gz"))
    monkeypatch.setenv("LINGVA_CLI_VERSION", "1.2.3")
    return tmp_path


def assets(root, monkeypatch, *, extension="tar.gz", content=b"#!/bin/sh\nexit 0\n", kind="regular"):
    root.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(launcher, "_target", lambda: ("test-target", extension))
    name = f"lingva-test-target.{extension}"
    archive = root / name
    if extension == "zip":
        with zipfile.ZipFile(archive, "w") as package:
            package.writestr("lingva.exe", content)
    else:
        with tarfile.open(archive, "w:gz") as package:
            info = tarfile.TarInfo("lingva" if kind != "traversal" else "../lingva")
            if kind == "symlink":
                info.type = tarfile.SYMTYPE
                info.linkname = "/tmp/unsafe-lingva"
                package.addfile(info)
            else:
                info.size = len(content)
                package.addfile(info, io.BytesIO(content))
    checksum = hashlib.sha256(archive.read_bytes()).hexdigest()
    (root / "SHA256SUMS").write_text(f"{checksum}  {name}\n")
    monkeypatch.setenv("LINGVA_CLI_ASSET_BASE_URL", root.as_uri())
    return archive


@pytest.mark.parametrize("system,machine,target,extension", [
    ("Darwin", "arm64", "aarch64-apple-darwin", "tar.gz"),
    ("Darwin", "x86_64", "x86_64-apple-darwin", "tar.gz"),
    ("Linux", "aarch64", "aarch64-unknown-linux-gnu", "tar.gz"),
    ("Linux", "arm64", "aarch64-unknown-linux-gnu", "tar.gz"),
    ("Linux", "x86_64", "x86_64-unknown-linux-musl", "tar.gz"),
    ("Windows", "AMD64", "x86_64-pc-windows-msvc", "zip"),
])
def test_supported_targets(monkeypatch, system, machine, target, extension):
    monkeypatch.setattr(launcher.platform, "system", lambda: system)
    monkeypatch.setattr(launcher.platform, "machine", lambda: machine)
    assert launcher._target() == (target, extension)


def test_unsupported_target_has_actionable_error(monkeypatch):
    monkeypatch.setattr(launcher.platform, "system", lambda: "Linux")
    monkeypatch.setattr(launcher.platform, "machine", lambda: "riscv64")
    with pytest.raises(RuntimeError, match="linux/riscv64"):
        launcher._target()


@pytest.mark.parametrize("version", ["../bad", "latest", "1.2.3/other", "", "v1.2.3"])
def test_version_cannot_be_a_path_or_unpinned_tag(version):
    with pytest.raises(RuntimeError, match="semantic version"):
        launcher._version(version)


@pytest.mark.parametrize("extension", ["tar.gz", "zip"])
def test_install_verifies_archive_and_reuses_integrity_checked_cache(cache, monkeypatch, extension):
    assets(cache / "assets", monkeypatch, extension=extension)
    binary = launcher.resolve_binary()
    assert binary.is_file()
    assert launcher._valid_cache(binary)
    monkeypatch.setattr(launcher, "_download", lambda version: pytest.fail("valid cache downloaded again"))
    assert launcher.resolve_binary() == binary


def test_truncated_and_non_executable_caches_are_repaired(cache, monkeypatch):
    assets(cache / "assets", monkeypatch)
    binary = launcher.resolve_binary()
    original = binary.read_bytes()
    binary.write_bytes(b"partial")
    assert not launcher._valid_cache(binary)
    assert launcher.resolve_binary().read_bytes() == original
    if os.name != "nt":
        binary.chmod(0o600)
        assert not launcher._valid_cache(binary)
        assert launcher.resolve_binary().stat().st_mode & 0o111


def test_checksum_mismatch_never_creates_cache_binary(cache, monkeypatch):
    archive = assets(cache / "assets", monkeypatch)
    archive.write_bytes(b"tampered")
    with pytest.raises(RuntimeError, match="Checksum verification failed"):
        launcher.resolve_binary()
    assert not launcher._cache_path("1.2.3").exists()
    assert not list(launcher._cache_path("1.2.3").parent.glob(".install-*"))


@pytest.mark.parametrize("source", ["", "bad  asset\n", f"{'a'*64}  asset\n{'a'*64}  asset\n"])
def test_missing_malformed_duplicate_checksums_are_rejected(source):
    with pytest.raises(RuntimeError, match="checksum"):
        launcher._checksum(source, "asset")


@pytest.mark.parametrize("kind", ["symlink", "traversal"])
def test_archive_links_and_paths_are_not_extracted(cache, monkeypatch, kind):
    assets(cache / "assets", monkeypatch, kind=kind)
    with pytest.raises(RuntimeError, match="regular Lingva executable"):
        launcher.resolve_binary()
    assert not launcher._cache_path("1.2.3").exists()
    assert not (cache / "lingva").exists()


def test_empty_executable_is_rejected(cache, monkeypatch):
    assets(cache / "assets", monkeypatch, content=b"")
    with pytest.raises(RuntimeError, match="empty"):
        launcher.resolve_binary()


def test_interrupted_install_does_not_replace_a_valid_binary(cache, monkeypatch):
    assets(cache / "assets", monkeypatch)
    binary = launcher.resolve_binary()
    original = binary.read_bytes()

    def interrupted(*args):
        raise OSError("interrupted extraction")

    monkeypatch.setattr(launcher, "_extract", interrupted)
    with pytest.raises(OSError, match="interrupted"):
        launcher._download("1.2.3")
    assert binary.read_bytes() == original
    assert launcher._valid_cache(binary)


def test_concurrent_installs_download_once(cache, monkeypatch):
    assets(cache / "assets", monkeypatch)
    download = launcher._download
    calls = []

    def slow_download(version):
        calls.append(version)
        time.sleep(0.05)
        return download(version)

    monkeypatch.setattr(launcher, "_download", slow_download)
    with ThreadPoolExecutor(max_workers=4) as workers:
        binaries = list(workers.map(lambda _: launcher.resolve_binary(), range(4)))
    assert len(set(binaries)) == 1
    assert calls == ["1.2.3"]


def test_platform_is_part_of_cache_identity(cache, monkeypatch):
    first = launcher._cache_path("1.2.3")
    monkeypatch.setattr(launcher, "_target", lambda: ("other-target", "tar.gz"))
    assert launcher._cache_path("1.2.3") != first


def test_missing_explicit_override_never_downloads(cache, monkeypatch):
    monkeypatch.setenv("LINGVA_CLI_BINARY", str(cache / "missing"))
    monkeypatch.setattr(launcher, "_download", lambda version: pytest.fail("override fell back"))
    with pytest.raises(RuntimeError, match="missing or non-executable"):
        launcher.resolve_binary()


def test_main_forwards_arguments_and_never_falls_back(cache, monkeypatch, capsys):
    monkeypatch.setattr(launcher.platform, "system", lambda: "Linux")
    binary = cache / "lingva"
    binary.write_bytes(b"binary")
    binary.chmod(0o755)
    monkeypatch.setenv("LINGVA_CLI_BINARY", str(binary))
    monkeypatch.setattr(sys, "argv", ["lingva", "pull", "--locale", "ru"])
    calls = []
    monkeypatch.setattr(os, "execv", lambda binary, argv: calls.append((binary, argv)))
    launcher.main()
    assert os.environ["LINGVA_CLI_INSTALL_CHANNEL"] == "python"
    assert calls == [(binary, [str(binary), "pull", "--locale", "ru"])]
    monkeypatch.setenv("LINGVA_CLI_BINARY", str(cache / "missing"))
    with pytest.raises(SystemExit) as error:
        launcher.main()
    assert error.value.code == 1
    assert "lingva-cli:" in capsys.readouterr().err


@pytest.mark.parametrize("extension", ["tar.gz", "zip"])
def test_ambiguous_or_extra_archive_members_are_rejected(cache, monkeypatch, extension):
    archive = assets(cache / "assets", monkeypatch, extension=extension)
    if extension == "zip":
        with zipfile.ZipFile(archive, "a") as package:
            package.writestr("../outside", b"unexpected")
    else:
        with tarfile.open(archive, "w:gz") as package:
            for name in ["lingva", "../outside"]:
                info = tarfile.TarInfo(name)
                info.size = 6
                package.addfile(info, io.BytesIO(b"engine"))
    with pytest.raises(RuntimeError, match="one regular"):
        launcher._extract(archive, extension, cache / "binary")
    assert not (cache / "binary").exists()


def test_explicit_channel_override_is_preserved(cache, monkeypatch):
    monkeypatch.setattr(launcher.platform, "system", lambda: "Linux")
    binary = cache / "lingva"
    binary.write_bytes(b"binary")
    binary.chmod(0o755)
    monkeypatch.setenv("LINGVA_CLI_BINARY", str(binary))
    monkeypatch.setenv("LINGVA_CLI_INSTALL_CHANNEL", "standalone")
    monkeypatch.setattr(os, "execv", lambda *args: None)
    launcher.main()
    assert os.environ["LINGVA_CLI_INSTALL_CHANNEL"] == "standalone"


@pytest.mark.skipif(os.name == "nt", reason="Unix fixture executable")
def test_engine_exit_status_is_preserved(cache):
    binary = cache / "lingva"
    binary.write_text('#!/bin/sh\nprintf "%s\\n" "$@"\nexit 23\n')
    binary.chmod(0o755)
    result = subprocess.run([sys.executable, "-c", "from lingva_cli._launcher import main; main()", "check", "--format", "json"],
        env={**os.environ, "LINGVA_CLI_BINARY": str(binary)}, capture_output=True, text=True)
    assert result.returncode == 23
    assert result.stdout == "check\n--format\njson\n"


@pytest.mark.parametrize("status", [0, 23])
def test_windows_waits_for_engine_and_preserves_status_and_arguments(cache, monkeypatch, status):
    binary = cache / "lingva.exe"
    monkeypatch.setattr(launcher, "resolve_binary", lambda: binary)
    monkeypatch.setattr(launcher.platform, "system", lambda: "Windows")
    monkeypatch.setattr(sys, "argv", ["lingva", "check", "--format", "json"])
    calls = []
    def run(argv, *, check):
        calls.append((argv, check))
        return subprocess.CompletedProcess(argv, status)
    monkeypatch.setattr(launcher.subprocess, "run", run)
    with pytest.raises(SystemExit) as error:
        launcher.main()
    assert error.value.code == status
    assert calls == [([str(binary), "check", "--format", "json"], False)]


def test_windows_spawn_failure_reports_adapter_diagnostic(cache, monkeypatch, capsys):
    monkeypatch.setattr(launcher, "resolve_binary", lambda: cache / "lingva.exe")
    monkeypatch.setattr(launcher.platform, "system", lambda: "Windows")
    def fail(*args, **kwargs):
        raise OSError("engine start failed")
    monkeypatch.setattr(launcher.subprocess, "run", fail)
    with pytest.raises(SystemExit) as error:
        launcher.main()
    assert error.value.code == 1
    assert "engine start failed" in capsys.readouterr().err


def test_real_engine_process_delivers_delayed_output_and_nonzero_status():
    program = 'import sys,time; time.sleep(0.05); print("{\\"complete\\": true}", flush=True); sys.exit(23)'
    result = subprocess.run(
        [sys.executable, "-c", "from lingva_cli._launcher import main; main()", "-c", program],
        env={**os.environ, "LINGVA_CLI_BINARY": sys.executable}, capture_output=True, text=True,
    )
    assert result.returncode == 23
    assert json.loads(result.stdout) == {"complete": True}


@pytest.mark.parametrize("manifest", ["not json", "null", "[]", '{"sha256":"wrong"}'])
def test_malformed_integrity_manifest_never_trusts_cached_binary(cache, monkeypatch, manifest):
    assets(cache / "assets", monkeypatch)
    binary = launcher.resolve_binary()
    binary.with_suffix(".integrity.json").write_text(manifest)
    assert not launcher._valid_cache(binary)
    assert launcher.resolve_binary() == binary
    assert launcher._valid_cache(binary)


def test_fetch_enforces_stream_limit_before_writing_overflow(tmp_path, monkeypatch):
    monkeypatch.setattr(launcher.urllib.request, "urlopen", lambda *args, **kwargs: io.BytesIO(b"too large"))
    output = tmp_path / "download"
    with pytest.raises(RuntimeError, match="maximum asset size"):
        launcher._fetch("https://example.test/archive", output, limit=3)
    assert output.read_bytes() == b""


def test_checksum_ignores_blank_unrelated_lines_and_normalizes_binary_marker():
    checksum = "ABCDEF01" * 8
    source = f"\ncomment\n{'b' * 64}  unrelated\n{checksum}  *asset\n"
    assert launcher._checksum(source, "asset") == checksum.lower()


@pytest.mark.parametrize("extension", ["tar.gz", "zip"])
def test_extracted_engine_size_is_limited_independently_of_archive_size(cache, monkeypatch, extension):
    archive = assets(cache / "assets", monkeypatch, extension=extension, content=b"oversized engine")
    monkeypatch.setattr(launcher, "MAX_ASSET_BYTES", 3)
    output = cache / "binary"
    with pytest.raises(RuntimeError, match="executable exceeds"):
        launcher._extract(archive, extension, output)
    assert not output.exists()


def test_zip_symlink_and_missing_engine_are_rejected(tmp_path):
    for kind in ["symlink", "missing"]:
        archive = tmp_path / f"{kind}.zip"
        with zipfile.ZipFile(archive, "w") as package:
            info = zipfile.ZipInfo("lingva.exe" if kind == "symlink" else "other.exe")
            if kind == "symlink":
                info.create_system = 3
                info.external_attr = 0o120777 << 16
            package.writestr(info, b"/tmp/unsafe")
        output = tmp_path / "binary"
        with pytest.raises(RuntimeError, match="regular Lingva executable"):
            launcher._extract(archive, "zip", output)
        assert not output.exists()


def test_tar_missing_extract_stream_is_rejected(cache, monkeypatch):
    archive = assets(cache / "assets", monkeypatch)
    monkeypatch.setattr(tarfile.TarFile, "extractfile", lambda *args: None)
    with pytest.raises(RuntimeError, match="does not contain a Lingva executable"):
        launcher._extract(archive, "tar.gz", cache / "binary")


def test_empty_zip_engine_is_rejected(cache, monkeypatch):
    archive = assets(cache / "assets", monkeypatch, extension="zip", content=b"")
    with pytest.raises(RuntimeError, match="empty"):
        launcher._extract(archive, "zip", cache / "binary")


class WindowsOSProxy:
    """Patch only the launcher's OS view; pathlib keeps the host platform."""

    name = "nt"

    def __getattr__(self, name):
        return getattr(os, name)


def test_windows_lock_retry_and_unlock_use_one_byte_without_global_os_patch(tmp_path, monkeypatch):
    monkeypatch.setattr(launcher, "os", WindowsOSProxy())
    calls = []

    def locking(fd, operation, size):
        calls.append((fd, operation, size))
        if len(calls) == 1:
            raise OSError("lock busy")

    monkeypatch.setitem(sys.modules, "msvcrt", SimpleNamespace(LK_NBLCK=1, LK_UNLCK=2, locking=locking))
    clock = iter([0, 1])
    sleeps = []
    monkeypatch.setattr(launcher, "time", SimpleNamespace(monotonic=lambda: next(clock), sleep=sleeps.append))
    with launcher._install_lock(tmp_path / "windows-cache"):
        assert len(calls) == 2
    assert [call[1:] for call in calls] == [(1, 1), (1, 1), (2, 1)]
    assert sleeps == [0.1]
    assert (tmp_path / "windows-cache" / ".install.lock").read_bytes() == b"\0"


def test_unix_contended_lock_timeout_is_bounded(tmp_path, monkeypatch):
    # A module proxy also makes this test portable to Windows CI.
    monkeypatch.setattr(launcher, "os", SimpleNamespace(name="posix"))

    def busy(*args):
        raise BlockingIOError("lock busy")

    monkeypatch.setitem(sys.modules, "fcntl", SimpleNamespace(LOCK_EX=1, LOCK_NB=2, flock=busy))
    clock = iter([0, 60])
    monkeypatch.setattr(launcher, "time", SimpleNamespace(monotonic=lambda: next(clock), sleep=lambda _: pytest.fail("slept after deadline")))
    with pytest.raises(RuntimeError, match="Timed out waiting"):
        with launcher._install_lock(tmp_path / "locked-cache"):
            pytest.fail("contended lock acquired")


def test_windows_extraction_cache_and_override_do_not_require_unix_permissions(cache, monkeypatch):
    assets(cache / "assets", monkeypatch, extension="zip")
    monkeypatch.setattr(launcher, "os", WindowsOSProxy())
    monkeypatch.setitem(sys.modules, "msvcrt", SimpleNamespace(LK_NBLCK=1, LK_UNLCK=2, locking=lambda *args: None))
    binary = launcher.resolve_binary()
    binary.chmod(0o600)
    assert launcher._valid_cache(binary)
    monkeypatch.setenv("LINGVA_CLI_BINARY", str(binary))
    assert launcher.resolve_binary() == binary


def test_install_fsync_uses_a_writable_binary_handle_for_windows_compatibility(cache, monkeypatch):
    assets(cache / "assets", monkeypatch)
    original_open = Path.open
    handles = {}
    modes = []

    def observed_open(path, mode="r", *args, **kwargs):
        handle = original_open(path, mode, *args, **kwargs)
        if path.name == "lingva" and mode == "r+b":
            handles[handle.fileno()] = handle
            modes.append(mode)
        return handle

    calls = []

    def observed_fsync(fd):
        assert fd in handles, "fsync did not use the expected writable binary descriptor"
        assert handles[fd].writable(), "Windows fsync requires a writable descriptor"
        calls.append(fd)

    monkeypatch.setattr(Path, "open", observed_open)
    monkeypatch.setattr(launcher.os, "fsync", observed_fsync)
    binary = launcher._download("1.2.3")
    assert binary.is_file()
    assert modes == ["r+b"]
    assert len(calls) == 1
    assert launcher._valid_cache(binary)
