"""Install and launch the pinned Rust engine, never Python command logic.

Downloads are authenticated against release checksums. Extraction never follows
archive paths or links. Per-target locks and same-filesystem atomic replacement
prevent interrupted/concurrent installs from making a partial executable usable.
"""

from __future__ import annotations

from contextlib import contextmanager
import hashlib
import json
import os
import platform
import re
import shutil
import stat
import subprocess
import sys
import tarfile
import tempfile
import time
import urllib.request
import zipfile
from pathlib import Path

ENGINE_VERSION = "0.1.5"
WINDOWS_SYSTEM_NAME = "Windows"
DEFAULT_ASSET_BASE_URL = "https://unpkg.com/@lingva/cli"
MAX_ASSET_BYTES = 200 * 1024 * 1024
TARGETS = {
    ("darwin", "arm64"): ("aarch64-apple-darwin", "tar.gz"),
    ("darwin", "aarch64"): ("aarch64-apple-darwin", "tar.gz"),
    ("darwin", "x86_64"): ("x86_64-apple-darwin", "tar.gz"),
    ("linux", "arm64"): ("aarch64-unknown-linux-gnu", "tar.gz"),
    ("linux", "aarch64"): ("aarch64-unknown-linux-gnu", "tar.gz"),
    ("linux", "amd64"): ("x86_64-unknown-linux-musl", "tar.gz"),
    ("linux", "x86_64"): ("x86_64-unknown-linux-musl", "tar.gz"),
    ("windows", "amd64"): ("x86_64-pc-windows-msvc", "zip"),
    ("windows", "x86_64"): ("x86_64-pc-windows-msvc", "zip"),
}


def _target() -> tuple[str, str]:
    key = (platform.system().lower(), platform.machine().lower())
    try:
        return TARGETS[key]
    except KeyError as exc:
        raise RuntimeError(f"No standalone Lingva CLI binary supports {key[0]}/{key[1]}.") from exc


def _version(value: str) -> str:
    if re.fullmatch(r"\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?", value) is None:
        raise RuntimeError("LINGVA_CLI_VERSION must be a semantic version, not a path or tag.")
    return value


def _cache_path(version: str) -> Path:
    root = Path(os.environ.get("LINGVA_CLI_CACHE_DIR", Path.home() / ".cache" / "lingva" / "cli"))
    target, extension = _target()
    return root / _version(version) / target / ("lingva.exe" if extension == "zip" else "lingva")


def _asset_base_url(version: str) -> str:
    return os.environ.get("LINGVA_CLI_ASSET_BASE_URL", f"{DEFAULT_ASSET_BASE_URL}@{_version(version)}/assets").rstrip("/")


def _digest(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _valid_cache(binary: Path) -> bool:
    try:
        if binary.is_symlink() or not binary.is_file() or binary.stat().st_size == 0:
            return False
        if os.name != "nt" and not os.access(binary, os.X_OK):
            return False
        manifest = json.loads(binary.with_suffix(".integrity.json").read_text(encoding="utf-8"))
        return manifest == {"sha256": _digest(binary), "engineVersion": binary.parent.parent.name, "target": binary.parent.name}
    except (OSError, ValueError, TypeError):
        return False


@contextmanager
def _install_lock(directory: Path):
    directory.mkdir(parents=True, exist_ok=True)
    with (directory / ".install.lock").open("a+b") as lock:
        if lock.tell() == 0:
            lock.write(b"\0")
            lock.flush()
        deadline = time.monotonic() + 60
        while True:
            try:
                if os.name == "nt":
                    import msvcrt
                    lock.seek(0)
                    msvcrt.locking(lock.fileno(), msvcrt.LK_NBLCK, 1)
                else:
                    import fcntl
                    fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except (BlockingIOError, OSError):
                if time.monotonic() >= deadline:
                    raise RuntimeError("Timed out waiting for another Lingva CLI installation.")
                time.sleep(0.1)
        try:
            yield
        finally:
            if os.name == "nt":
                import msvcrt
                lock.seek(0)
                msvcrt.locking(lock.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                import fcntl
                fcntl.flock(lock.fileno(), fcntl.LOCK_UN)


def _fetch(url: str, output: Path, limit: int = MAX_ASSET_BYTES) -> None:
    with urllib.request.urlopen(url, timeout=30) as response, output.open("wb") as destination:
        size = 0
        while True:
            chunk = response.read(1024 * 1024)
            if not chunk:
                break
            size += len(chunk)
            if size > limit:
                raise RuntimeError("Lingva CLI download exceeds the maximum asset size.")
            destination.write(chunk)


def _checksum(source: str, asset: str) -> str:
    matches = []
    for line in source.splitlines():
        fields = line.split()
        if len(fields) == 2 and fields[1].lstrip("*") == asset:
            matches.append(fields[0])
    if len(matches) != 1 or re.fullmatch(r"[a-fA-F0-9]{64}", matches[0]) is None:
        raise RuntimeError(f"Missing, duplicate, or malformed checksum for {asset}.")
    return matches[0].lower()


def _extract(archive: Path, extension: str, output: Path) -> None:
    if extension == "zip":
        with zipfile.ZipFile(archive) as package:
            entries = package.infolist()
            if len(entries) != 1 or entries[0].filename != "lingva.exe" or entries[0].is_dir() or stat.S_ISLNK(entries[0].external_attr >> 16):
                raise RuntimeError("Archive must contain one regular Lingva executable.")
            if entries[0].file_size > MAX_ASSET_BYTES:
                raise RuntimeError("Lingva executable exceeds the maximum asset size.")
            with package.open(entries[0]) as source, output.open("wb") as destination:
                shutil.copyfileobj(source, destination)
    else:
        with tarfile.open(archive, "r:gz") as package:
            entries = package.getmembers()
            if len(entries) != 1 or entries[0].name != "lingva" or not entries[0].isreg():
                raise RuntimeError("Archive must contain one regular Lingva executable.")
            if entries[0].size > MAX_ASSET_BYTES:
                raise RuntimeError("Lingva executable exceeds the maximum asset size.")
            source = package.extractfile(entries[0])
            if source is None:
                raise RuntimeError("Archive does not contain a Lingva executable.")
            with source, output.open("wb") as destination:
                shutil.copyfileobj(source, destination)
    if output.stat().st_size == 0:
        raise RuntimeError("Archive contains an empty Lingva executable.")
    if os.name != "nt":
        output.chmod(0o755)


def _download(version: str) -> Path:
    destination = _cache_path(version)
    target, extension = _target()
    asset = f"lingva-{target}.{extension}"
    base = _asset_base_url(version)
    destination.parent.mkdir(parents=True, exist_ok=True)
    # Stage on the same filesystem as the final cache; os.replace is atomic.
    with tempfile.TemporaryDirectory(prefix=".install-", dir=destination.parent) as directory:
        staging = Path(directory)
        archive = staging / asset
        checksums = staging / "SHA256SUMS"
        _fetch(f"{base}/{asset}", archive)
        _fetch(f"{base}/SHA256SUMS", checksums, 1024 * 1024)
        if _digest(archive) != _checksum(checksums.read_text(encoding="utf-8"), asset):
            raise RuntimeError(f"Checksum verification failed for {asset}.")
        binary = staging / destination.name
        _extract(archive, extension, binary)
        integrity = staging / "integrity.json"
        integrity.write_text(json.dumps({"sha256": _digest(binary), "engineVersion": version, "target": target}), encoding="utf-8")
        with binary.open("r+b") as source:
            os.fsync(source.fileno())
        os.replace(binary, destination)
        os.replace(integrity, destination.with_suffix(".integrity.json"))
    return destination


def resolve_binary() -> Path:
    override = os.environ.get("LINGVA_CLI_BINARY")
    if override:
        binary = Path(override).expanduser().resolve()
        if not binary.is_file() or (os.name != "nt" and not os.access(binary, os.X_OK)):
            raise RuntimeError(f'LINGVA_CLI_BINARY points to a missing or non-executable file "{binary}".')
        return binary
    version = _version(os.environ.get("LINGVA_CLI_VERSION", ENGINE_VERSION))
    binary = _cache_path(version)
    with _install_lock(binary.parent):
        if _valid_cache(binary):
            return binary
        return _download(version)


def main() -> None:
    try:
        binary = resolve_binary()
        os.environ.setdefault("LINGVA_CLI_INSTALL_CHANNEL", "python")
        if platform.system() == WINDOWS_SYSTEM_NAME:
            # Windows exec starts a replacement process rather than retaining
            # the caller's process handle. Wait explicitly for output and the
            # actual engine status instead of letting the wrapper exit early.
            result = subprocess.run([str(binary), *sys.argv[1:]], check=False)
            raise SystemExit(result.returncode)
        os.execv(binary, [str(binary), *sys.argv[1:]])
    except (OSError, RuntimeError, ValueError, tarfile.TarError, zipfile.BadZipFile) as error:
        print(f"lingva-cli: {error}. Reinstall lingva-cli or set LINGVA_CLI_BINARY to a verified standalone engine.", file=sys.stderr)
        raise SystemExit(1) from error
