#!/usr/bin/env bash
# بناء كل حزم لينكس (Tauri + Rust): deb / rpm / AppImage + توقيع GPG
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export JAVA_HOME="${JAVA_HOME:-$HOME/.sdkman/candidates/java/21.0.12+1.1-tem}"
export PATH="$JAVA_HOME/bin:$HOME/.cargo/bin:$PATH"
export GNUPGHOME="${GNUPGHOME:-$HOME/.gnupg}"
VER=3.6.4
KEY_ID="${SIGNING_KEY_ID:-EC5E1EC44ED65B7AFD33F17018A7EB1880C9F89E}"
DIST="$ROOT/dist"
STAGE="$ROOT/build/stage"
APPIMAGETOOL="$ROOT/tools/appimagetool"
FPM="${FPM:-/home/mohamedzaitoon/.cache/electron-builder/fpm/fpm-1.9.3-2.3.1-linux-x86_64/fpm}"
export LD_LIBRARY_PATH="/tmp/opencode/wzaker/extralibs/x64/usr/lib64:${LD_LIBRARY_PATH:-}"

echo "▶ 1/5 بناء الـ binary (Rust)"
(cd src-tauri && cargo build --release)
BIN="$ROOT/src-tauri/target/release/wzaker"

echo "▶ 2/5 تجهيز حزمة الملفات"
rm -rf "$STAGE"
mkdir -p "$STAGE/usr/lib/wzaker" "$STAGE/usr/bin" "$STAGE/usr/share/applications"
mkdir -p "$STAGE/usr/share/icons/hicolor/48x48/apps" "$STAGE/usr/share/icons/hicolor/64x64/apps"
mkdir -p "$STAGE/usr/share/icons/hicolor/128x128/apps" "$STAGE/usr/share/icons/hicolor/256x256/apps"
install -m755 "$BIN" "$STAGE/usr/lib/wzaker/wzaker"

# مُشغّل في /usr/bin (يفتح التطبيق كبرنامج كامل، بدون نافذة طرفية)
cat > "$STAGE/usr/bin/wzaker" <<'EOF'
#!/bin/sh
# WZAKER launcher
export GDK_BACKEND="${GDK_BACKEND:-wayland}"
export NO_AT_BRIDGE=1
exec /usr/lib/wzaker/wzaker "$@"
EOF
chmod 755 "$STAGE/usr/bin/wzaker"

cat > "$STAGE/usr/share/applications/wzaker.desktop" <<'EOF'
[Desktop Entry]
Type=Application
Version=1.0
Name=ذكر
Name[en]=WZAKER
GenericName=سبحة وأذكار
Comment=سبحة إلكترونية وأذكار وقرآن وأوقات صلاة
Comment[en]=Tasbih, azkar, Quran and prayer times
Exec=wzaker
Icon=wzaker
Terminal=false
StartupNotify=true
Categories=Utility;Spirituality;
Keywords=tasbih;azkar;quran;prayer;dhikr;ذكر;أذكار;قرآن;صلاة;
StartupWMClass=wzaker
EOF

for s in 48 64 128 256; do
  python3 - "$s" <<'PY'
import sys
from PIL import Image
size=int(sys.argv[1])
im=Image.open("src-tauri/icons/128x128.png").convert("RGBA").resize((size,size), Image.LANCZOS)
im.save(f"build/stage/usr/share/icons/hicolor/{size}x{size}/apps/wzaker.png")
PY
done

echo "▶ 3/5 بناء الحزم"
cd /tmp/opencode
"$FPM" -s dir -t deb -n wzaker -v $VER --architecture amd64 \
  --description "ذكر — سبحة إلكترونية وأذكار وقرآن وأوقات صلاة (Linux)" \
  --maintainer "AhmedMohamedH10 <ahmedmohamedh10@users.noreply.github.com>" \
  --depends "libwebkit2gtk-4.1-0" --depends "libgtk-3-0" --prefix / -C "$STAGE" . 2>&1 | tail -1
mv "wzaker_${VER}_amd64.deb" "$DIST/WZAKER-${VER}-linux-amd64.deb"

# rpm (spec من المستودع)
cp "$ROOT/packaging/wzaker.spec" ~/rpmbuild/SPECS/wzaker.spec
rm -rf ~/rpmbuild/BUILD/wzaker-${VER}-build ~/rpmbuild/BUILDROOT/wzaker-${VER}
rpmbuild -bb ~/rpmbuild/SPECS/wzaker.spec >/dev/null 2>&1
cp "$(ls -t ~/rpmbuild/RPMS/x86_64/wzaker-${VER}-1*.rpm | head -1)" "$DIST/WZAKER-${VER}-linux-x86_64.rpm"

# AppImage
WORK="$ROOT/build/appimage-work"
rm -rf "$WORK"; mkdir -p "$WORK/AppDir/usr/bin" "$WORK/AppDir/usr/share/applications" "$WORK/AppDir/usr/share/icons/hicolor/256x256/apps"
install -m755 "$BIN" "$WORK/AppDir/usr/bin/wzaker"
cp "$STAGE/usr/share/applications/wzaker.desktop" "$WORK/AppDir/wzaker.desktop"
cp "$STAGE/usr/share/applications/wzaker.desktop" "$WORK/AppDir/usr/share/applications/wzaker.desktop"
cp "$STAGE/usr/share/icons/hicolor/256x256/apps/wzaker.png" "$WORK/AppDir/wzaker.png"
cp "$STAGE/usr/share/icons/hicolor/256x256/apps/wzaker.png" "$WORK/AppDir/usr/share/icons/hicolor/256x256/apps/wzaker.png"
cat > "$WORK/AppDir/AppRun" <<'EOF'
#!/bin/sh
HERE="$(dirname "$(readlink -f "${0}")")"
export NO_AT_BRIDGE=1
exec "$HERE/usr/bin/wzaker" "$@"
EOF
chmod +x "$WORK/AppDir/AppRun"
(cd "$WORK" && "$APPIMAGETOOL" --sign AppDir "$DIST/WZAKER-${VER}-linux-x86_64.AppImage" 2>&1 | grep -iE "signing|Success" | head -2)

echo "▶ 4/5 توقيع الحزم (GPG)"
python3 "$ROOT/scripts/rpm-sign.py" "$DIST/WZAKER-${VER}-linux-x86_64.rpm" "$KEY_ID" | tail -1
cd "$DIST"
for f in WZAKER-${VER}-linux-amd64.deb WZAKER-${VER}-linux-x86_64.rpm WZAKER-${VER}-linux-x86_64.pkg.tar.zst \
         WZAKER-${VER}-linux-x86_64.apk WZAKER-${VER}-linux-x86_64.txz WZAKER-${VER}-linux-x86_64.pet \
         WZAKER-${VER}-linux-x86_64.tar WZAKER-${VER}-linux-x86_64.zip; do
  [ -f "$f" ] && gpg --batch --yes --local-user "$KEY_ID" --armor --detach-sign --output "$f.asc" "$f"
done

echo "▶ 5/5 تحقق"
rpm --define "_dbpath $HOME/.local/share/rpmdb" -Kv "$DIST/WZAKER-${VER}-linux-x86_64.rpm" 2>&1 | head -4
gpg --verify "WZAKER-${VER}-linux-amd64.deb.asc" "WZAKER-${VER}-linux-amd64.deb" 2>&1 | grep -E "Good" | head -1
echo "✓ جاهز في $DIST"
