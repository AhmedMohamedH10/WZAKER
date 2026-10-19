#!/usr/bin/env bash
# توقيع كل حزم لينكس بمفتاح GPG (mohamedzaitoon)
# AppImage: توقيع مدمج (gpgme) | RPM: توقيع مدمج (rpmsign) | الباقي: .asc منفصل
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export GNUPGHOME="${GNUPGHOME:-$HOME/.gnupg}"
KEY="${SIGNING_KEY:-Mohamed Zaitoon}"
KEY_ID="${SIGNING_KEY_ID:-EC5E1EC44ED65B7AFD33F17018A7EB1880C9F89E}"
DIST="$ROOT/dist"
APPIMAGETOOL="$ROOT/tools/appimagetool"

echo "=== AppImage (توقيع مدمج) ==="
APPDIR="${APPDIR:-$ROOT/build/appimage-work/AppDir}"
if [ -x "$APPIMAGETOOL" ] && [ -d "$APPDIR" ]; then
  (cd "$APPDIR/.." && "$APPIMAGETOOL" --sign AppDir "$DIST/WZAKER-3.6.4-linux-x86_64.AppImage")
else
  echo "! AppDir غير موجود — AppImage لن يُوقّع"
fi

echo "=== RPM (توقيع مدمج عبر rpmsign) ==="
# توقيع مدمج بدون rpmsign (سكربت داخلي)
python3 "$ROOT/scripts/rpm-sign.py" "$DIST/WZAKER-3.6.4-linux-x86_64.rpm" "$KEY_ID"
rpm -Kv "$DIST/WZAKER-3.6.4-linux-x86_64.rpm" | head -5

echo "=== توقيعات منفصلة (.asc) لكل الحزم ==="
cd "$DIST"
for f in WZAKER-3.6.4-linux-amd64.deb WZAKER-3.6.4-linux-x86_64.rpm \
         WZAKER-3.6.4-linux-x86_64.pkg.tar.zst WZAKER-3.6.4-linux-x86_64.apk \
         WZAKER-3.6.4-linux-x86_64.txz WZAKER-3.6.4-linux-x86_64.pet \
         WZAKER-3.6.4-linux-x86_64.tar WZAKER-3.6.4-linux-x86_64.zip; do
  [ -f "$f" ] || continue
  gpg --batch --yes --local-user "$KEY" --armor --detach-sign --output "$f.asc" "$f"
  echo "  ✓ $f.asc"
done

echo "=== التحقق ==="
gpg --verify WZAKER-3.6.4-linux-amd64.deb.asc WZAKER-3.6.4-linux-amd64.deb 2>&1 | grep -E "Good|Bad" | head -2
