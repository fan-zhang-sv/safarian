#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

VERSION="$(node -e "const fs=require('fs'); const m=JSON.parse(fs.readFileSync('manifest.json','utf8')); process.stdout.write(m.version);")"
ZIP_PATH="dist/safarian-${VERSION}-cws.zip"
STAGE="$(mktemp -d)"

cleanup() {
  rm -rf "$STAGE"
}
trap cleanup EXIT

node --check src/newtab.js
node -e "const fs=require('fs'); const m=JSON.parse(fs.readFileSync('manifest.json','utf8')); if (m.manifest_version !== 3) throw new Error('manifest_version must be 3'); if (!m.chrome_url_overrides || m.chrome_url_overrides.newtab !== 'newtab.html') throw new Error('newtab override missing'); if (m.host_permissions?.length) throw new Error('required host permissions are not allowed'); if (JSON.stringify(m.optional_host_permissions) !== JSON.stringify(['https://generativelanguage.googleapis.com/*'])) throw new Error('Gemini must be the only optional host permission');"

require_size() {
  local path="$1"
  local width="$2"
  local height="$3"
  local actual
  actual="$(sips -g pixelWidth -g pixelHeight "$path" | awk '/pixelWidth/{w=$2}/pixelHeight/{h=$2}END{print w "x" h}')"
  if [[ "$actual" != "${width}x${height}" ]]; then
    echo "Expected $path to be ${width}x${height}, got $actual" >&2
    exit 1
  fi
}

require_size assets/icons/icon-16.png 16 16
require_size assets/icons/icon-32.png 32 32
require_size assets/icons/icon-48.png 48 48
require_size assets/icons/icon-128.png 128 128
require_size store-assets/safarian-promo-440x280.png 440 280
require_size store-assets/safarian-screenshot-1280x800.png 1280 800
require_size store-assets/safarian-screenshot-640x400.png 640 400

mkdir -p "$STAGE/src" "$STAGE/assets/icons" dist
cp manifest.json newtab.html "$STAGE/"
cp src/newtab.js src/styles.css "$STAGE/src/"
cp assets/icons/icon-16.png \
  assets/icons/icon-32.png \
  assets/icons/icon-48.png \
  assets/icons/icon-128.png \
  "$STAGE/assets/icons/"

rm -f "$ZIP_PATH"
(
  cd "$STAGE"
  COPYFILE_DISABLE=1 zip -qr "$ROOT/$ZIP_PATH" . -x "*.DS_Store" "__MACOSX/*"
)

unzip -t "$ZIP_PATH" >/dev/null
echo "$ZIP_PATH"
