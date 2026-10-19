#!/usr/bin/env bash
# توقيع كل حزم لينكس بمفتاح GPG (mohamedzaitoon)
# AppImage: توقيع مدمج (gpgme) | RPM: توقيع مدمج (rpmsign) | الباقي: .asc منفصل
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export GNUPGHOME="${GNUPGHOME:-$HOME/.gnupg}"
KEY="${SIGNING_KEY:-mohamedzaitoon}"
DIST="$ROOT/dist"
APPIMAGETOOL="$ROOT/tools/appimagetool"

echo "=== AppImage (توقيع مدمج) ==="
if [ -x "$APPIMAGETOOL" ] && [ -d "$ROOT/build/appimage-work/AppDir" ]; then
  (cd "$ROOT/build/appimage-work" && "$APPIMAGETOOL" --sign AppDir "$DIST/WZAKER-3.6.4-linux-x86_64.AppImage")
else
  echo "! AppDir غير موجود — AppImage لن يُوقّع"
fi

echo "=== RPM (توقيع مدمج عبر rpmsign) ==="
if command -v rpmsign >/dev/null 2>&1; then
  rpmsign --define "_gpg_name $KEY" --define "_gpg_path $GNUPGHOME" \
    --addsign "$DIST/WZAKER-3.6.4-linux-x86_64.rpm"
  rpm -Kv "$DIST/WZAKER-3.6.4-linux-x86_64.rpm" | head -4
else
  echo "! rpmsign غير مثبّت — للتوقيع المدمج: sudo dnf install rpm-sign"
  echo "  (التوقيع المنفصل .asc تم إنشاؤه)"
fi

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
