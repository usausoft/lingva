#!/bin/sh
set -eu

VERSION="${LINGVA_CLI_VERSION:-latest}"
INSTALL_DIR="${LINGVA_CLI_INSTALL_DIR:-$HOME/.local/bin}"
ASSET_BASE_URL="${LINGVA_CLI_ASSET_BASE_URL:-https://unpkg.com/@lingva/cli@${VERSION}/assets}"

case "$(uname -s)-$(uname -m)" in
  Linux-x86_64) target="x86_64-unknown-linux-musl" ;;
  Linux-aarch64|Linux-arm64) target="aarch64-unknown-linux-gnu" ;;
  Darwin-x86_64) target="x86_64-apple-darwin" ;;
  Darwin-arm64|Darwin-aarch64) target="aarch64-apple-darwin" ;;
  *) echo "Unsupported Lingva CLI platform: $(uname -s) $(uname -m)" >&2; exit 1 ;;
esac

asset="lingva-${target}.tar.gz"
tmp="$(mktemp -d)"
staging=""
lock=""
cleanup() {
  rm -rf "$tmp"
  [ -z "$staging" ] || rm -rf "$staging"
  [ -z "$lock" ] || rmdir "$lock"
}
trap cleanup EXIT
trap 'exit 1' HUP INT TERM
curl --proto '=https' --proto-redir '=https' --tlsv1.2 --max-filesize 209715200 --connect-timeout 30 --max-time 120 --fail --location --silent --show-error "${ASSET_BASE_URL}/${asset}" --output "$tmp/$asset"
curl --proto '=https' --proto-redir '=https' --tlsv1.2 --max-filesize 1048576 --connect-timeout 30 --max-time 120 --fail --location --silent --show-error "${ASSET_BASE_URL}/SHA256SUMS" --output "$tmp/SHA256SUMS"
expected="$(awk -v name="$asset" '{ file=$2; sub(/^\*/, "", file); if (file == name) { count++; digest=$1; fields=NF } } END { if (count != 1 || fields != 2 || length(digest) != 64 || digest ~ /[^0-9a-fA-F]/) exit 1; print tolower(digest) }' "$tmp/SHA256SUMS")" || { echo "Missing, duplicate, or malformed checksum for $asset" >&2; exit 1; }
if command -v sha256sum >/dev/null 2>&1; then
  actual="$(sha256sum "$tmp/$asset" | awk '{ print $1 }')"
else
  actual="$(shasum -a 256 "$tmp/$asset" | awk '{ print $1 }')"
fi
[ "$actual" = "$expected" ] || { echo "Checksum mismatch for $asset" >&2; exit 1; }
mkdir -p "$INSTALL_DIR"
# Never extract archive paths. Require exactly one regular entry and stream its
# bytes into a same-filesystem staging file before replacing the live binary.
[ "$(tar -tzf "$tmp/$asset")" = "lingva" ] || { echo "Archive must contain one regular Lingva executable" >&2; exit 1; }
tar -tvzf "$tmp/$asset" | awk 'NR == 1 && substr($0, 1, 1) == "-" && !index($0, " link to ") && !index($0, " -> ") { valid=1 } END { exit !(valid && NR == 1) }' || { echo "Archive must contain one regular Lingva executable" >&2; exit 1; }
mkdir "$INSTALL_DIR/.lingva-install.lock" 2>/dev/null || { echo "Another installation holds $INSTALL_DIR/.lingva-install.lock; remove it only if that installer has stopped" >&2; exit 1; }
lock="$INSTALL_DIR/.lingva-install.lock"
staging="$(mktemp -d "$INSTALL_DIR/.lingva-install.XXXXXX")"
tar -xOzf "$tmp/$asset" lingva > "$staging/lingva"
[ -s "$staging/lingva" ] || { echo "Archive contains an empty Lingva executable" >&2; exit 1; }
chmod 755 "$staging/lingva"
mv -f "$staging/lingva" "$INSTALL_DIR/lingva"
echo "Installed Lingva CLI to $INSTALL_DIR/lingva"
