#!/usr/bin/env bash
# توقيع إصدار Tauri updater + إنشاء latest.json ل GitHub Releases
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BIN="$ROOT/src-tauri/target/release/wzaker"
OUT="$ROOT/dist"
APPIMAGE="$OUT/WZAKER-3.6.4-alpha01-linux-x86_64.AppImage"
PRIV_KEY="$ROOT/src-tauri/keys/updater.key"
PUB_KEY="$ROOT/src-tauri/keys/updater.key.pub"
PASSWORD="${TAUPDATER_PASSWORD:-wzaker-updater-2026}"

echo "=== signing AppImage ==="
TAURI_SIGNING_PRIVATE_KEY_PATH="$PRIV_KEY" \
TAURI_SIGNING_PRIVATE_KEY_PASSWORD="$PASSWORD" \
tauri signer sign --file "$APPIMAGE" 2>&1 | tail -3

echo "=== creating latest.json ==="
# Tauri updater format for GitHub Releases (AppImage)
cat > "$OUT/latest.json" <<EOF
{
  "version": "3.6.4-alpha01",
  "pub_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "platforms": {
    "linux-x86_64": {
      "signature": "$(cat "$APPIMAGE.sig" 2>/dev/null || echo '')",
      "url": "https://github.com/AhmedMohamedH10/WZAKER/releases/download/v3.6.4-alpha01/WZAKER-3.6.4-alpha01-linux-x86_64.AppImage"
    }
  }
}
EOF

echo "✓ Signed: $APPIMAGE"
echo "✓ latest.json: $OUT/latest.json"
echo "Upload both to the GitHub Release (v3.6.4-alpha01)."
