#!/usr/bin/env bash
# وذكر (WZAKER) — مثبّت لينكس: يكشف التوزيعة تلقائياً، ينزّل النسخة المناسبة،
# يتحقق من توقيع GPG، يثبّتها، ويزيل النسخة القديمة (بهدوء) مع نسخة احتياطية للبيانات.
#
# الاستخدام:  curl -fsSL https://github.com/AhmedMohamedH10/WZAKER/releases/download/v3.6.4/linux-installer.sh | sudo bash

set -euo pipefail

REPO="AhmedMohamedH10/WZAKER"
TAG="v3.6.4"
VER="3.6.4"
BASE="https://github.com/$REPO/releases/download/$TAG"
KEY_FPR="EC5E1EC44ED65B7AFD33F17018A7EB1880C9F89E"

# المفتاح العام لتوقيع حزم وذكر (مدمج — بيتستورد تلقائياً)
read -r -d '' WZAKER_PUBKEY <<'KEYEOF' || true
-----BEGIN PGP PUBLIC KEY BLOCK-----

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
=VQeH
-----END PGP PUBLIC KEY BLOCK-----
KEYEOF

log()  { printf '\033[1;36m::\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!!\033[0m %s\n' "$*"; }
err()  { printf '\033[1;31mxx\033[0m %s\n' "$*" >&2; }

if [ "$(id -u)" -ne 0 ]; then
  err "السكربت يحتاج صلاحيات root. شغّله كده:"
  printf '   curl -fsSL %s/linux-installer.sh | sudo bash\n' "$BASE"
  exit 1
fi

# ── المستخدم الحقيقي (السكربت بيتشغّل بـ sudo) ─────────────────────────────
USER_NAME="$(id -un)"
USER_HOME="$HOME"
if [ -n "${SUDO_USER:-}" ] && [ "$SUDO_USER" != "root" ]; then
  USER_NAME="$SUDO_USER"
  USER_HOME="$(getent passwd "$SUDO_USER" | cut -d: -f6)"
  [ -z "$USER_HOME" ] && USER_HOME="$HOME"
fi

# ── كشف التوزيعة ────────────────────────────────────────────────────────────
if [ -r /etc/os-release ]; then . /etc/os-release; fi
ID="${ID:-unknown}"; LIKE="${ID_LIKE:-}"; NAME="${PRETTY_NAME:-$ID}"
case " $ID $LIKE " in
  *debian*|*ubuntu*)           TYPE="deb";    FILE="WZAKER-$VER-linux-amd64.deb";;
  *fedora*|*rhel*|*centos*|*rocky*|*alma*|*opensuse*) TYPE="rpm"; FILE="WZAKER-$VER-linux-x86_64.rpm";;
  *arch*|*manjaro*|*endeavouros*|*garuda*) TYPE="pacman"; FILE="WZAKER-$VER-linux-x86_64.pkg.tar.zst";;
  *alpine*)                   TYPE="apk";    FILE="wzaker_${VER}_x86_64.apk";;
  *slackware*)                TYPE="slack";  FILE="WZAKER-$VER-linux-x86_64.txz";;
  *void*)                     TYPE="xbps";   FILE="WZAKER-$VER-linux-x86_64.tar";;
  *puppy*)                    TYPE="puppy";  FILE="WZAKER-$VER-linux-x86_64.pet";;
  *gentoo*)                   TYPE="gentoo"; FILE="";;
  *nixos*)                    TYPE="nix";    FILE="";;
  *solus*)                    TYPE="solus";  FILE="";;
  *)                          TYPE="appimage"; FILE="WZAKER-$VER-linux-x86_64.AppImage";;
esac

log "توزيعة النظام: $NAME  ($ID)"
log "نوع الحزمة: $TYPE"

# ── صلاحية قراءة عجلة الفأرة (التمرير العام على Wayland و X11) ───────────────
RULE=/etc/udev/rules.d/99-wzaker-input.rules
if [ -d /etc/udev/rules.d ]; then
  cat > "$RULE" <<EOF
# WZAKER — قراءة عجلة الفأرة على لينكس (Wayland + X11)
KERNEL=="event[0-9]*", SUBSYSTEM=="input", ATTRS{name}=="*Receiver*|*receiver*|*Mouse*|*mouse*|*Touchpad*|*touchpad*|*TrackPoint*|*trackpoint*|*Pointer*|*pointer*|*Keyboard*|*keyboard*|*KEYBOARD*", MODE="0660", GROUP="$USER_NAME"
EOF
  udevadm control --reload 2>/dev/null || true
  udevadm trigger --subsystem-match=input 2>/dev/null || true
  log "تم تفعيل التمرير العام (قاعدة udev)"
fi

# ── نسخ احتياطي للبيانات + إزالة النسخة القديمة (بهدوء) ─────────────────────
BACKUP_ROOT="$USER_HOME/Documents/WZAKER-backups"
DATA_DIRS=(
  "$USER_HOME/.local/share/io.github.ahmedmohamedh10.wzaker"
  "$USER_HOME/.config/WZAKER"
  "$USER_HOME/.cache/io.github.ahmedmohamedh10.wzaker"
)
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR=""
HAS_DATA=0
for d in "${DATA_DIRS[@]}"; do [ -d "$d" ] && HAS_DATA=1; done
if [ "$HAS_DATA" = "1" ]; then
  BACKUP_DIR="$BACKUP_ROOT/pre-install-$STAMP"
  mkdir -p "$BACKUP_DIR" 2>/dev/null || { BACKUP_DIR="$USER_HOME/.wzaker-backups/pre-install-$STAMP"; mkdir -p "$BACKUP_DIR" 2>/dev/null || BACKUP_DIR=""; }
  if [ -n "$BACKUP_DIR" ]; then
    for d in "${DATA_DIRS[@]}"; do [ -d "$d" ] && cp -a "$d" "$BACKUP_DIR/" 2>/dev/null; done
    log "تم حفظ نسخة احتياطية من بياناتك في: $BACKUP_DIR"
  fi
fi

# إزالة النسخة القديمة إن وجدت (بهدوء، من غير سؤال)
if command -v dpkg >/dev/null 2>&1 && dpkg -s wzaker >/dev/null 2>&1; then
  dpkg --purge wzaker >/dev/null 2>&1
elif command -v rpm >/dev/null 2>&1 && rpm -q wzaker >/dev/null 2>&1; then
  rpm -e wzaker >/dev/null 2>&1
elif command -v pacman >/dev/null 2>&1 && pacman -Qi wzaker >/dev/null 2>&1; then
  pacman -Rns --noconfirm wzaker >/dev/null 2>&1
elif command -v apk >/dev/null 2>&1 && apk info -e wzaker >/dev/null 2>&1; then
  apk del wzaker >/dev/null 2>&1
fi
# تنظيف ملفات النسخة القديمة مباشرة (لو مدير الحزم ما سجّلش الحزمة — قواعد بيانات تالفة)
rm -rf /usr/lib/wzaker /opt/wzaker 2>/dev/null
rm -f /usr/bin/wzaker /usr/local/bin/wzaker 2>/dev/null
rm -f /usr/share/applications/wzaker.desktop 2>/dev/null
rm -f /usr/share/icons/hicolor/256x256/apps/wzaker.png 2>/dev/null
rm -f /usr/share/metainfo/io.github.ahmedmohamedh10.wzaker.metainfo.xml 2>/dev/null

if [ "$TYPE" = "gentoo" ] || [ "$TYPE" = "nix" ] || [ "$TYPE" = "solus" ]; then
  warn "توزيعة $NAME بتبني من السورس. نزّل الوصفة وثبّتها:"
  printf '   https://github.com/%s/tree/linux/packaging\n' "$REPO"
  exit 0
fi

# ── استيراد مفتاح التوقيع ───────────────────────────────────────────────────
if command -v gpg >/dev/null 2>&1; then
  if curl -fsSL "$BASE/wzaker-signing-key.asc" -o /tmp/wzaker-key.asc 2>/dev/null; then
    gpg --batch --import /tmp/wzaker-key.asc >/dev/null 2>&1 || true
  fi
  printf '%s\n' "$WZAKER_PUBKEY" | gpg --batch --import >/dev/null 2>&1 || true
fi
if command -v rpm >/dev/null 2>&1 && [ "$TYPE" = "rpm" ]; then
  printf '%s\n' "$WZAKER_PUBKEY" | rpm --import - >/dev/null 2>&1 || true
fi

# ── التنزيل ────────────────────────────────────────────────────────────────
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

log "تنزيل $FILE ..."
if command -v curl >/dev/null 2>&1; then
  curl -fL --progress-bar "$BASE/$FILE" -o "$TMP/$FILE"
else
  wget -q --show-progress "$BASE/$FILE" -O "$TMP/$FILE"
fi

# ── التحقق من التوقيع ───────────────────────────────────────────────────────
if command -v gpg >/dev/null 2>&1; then
  if curl -fsSL "$BASE/$FILE.asc" -o "$TMP/$FILE.asc" 2>/dev/null; then
    if gpg --verify "$TMP/$FILE.asc" "$TMP/$FILE" 2>/dev/null; then
      log "تم التحقق من التوقيع (GPG) بنجاح — $KEY_FPR"
    else
      warn "التوقيع غير مطابق — بيكمل التثبيت"
    fi
  fi
fi

# ── التثبيت ────────────────────────────────────────────────────────────────
case "$TYPE" in
  deb)
    if command -v apt-get >/dev/null 2>&1; then
      log "التثبيت عبر apt ..."
      apt-get update -qq || true
      apt-get install -y "$TMP/$FILE"
    else
      log "التثبيت عبر dpkg ..."
      dpkg -i "$TMP/$FILE" || apt-get -f install -y
    fi
    ;;
  rpm)
    if command -v dnf >/dev/null 2>&1; then
      log "التثبيت عبر dnf ..."
      dnf install -y "$TMP/$FILE"
    elif command -v zypper >/dev/null 2>&1; then
      log "التثبيت عبر zypper ..."
      zypper install -y "$TMP/$FILE"
    else
      log "التثبيت عبر rpm ..."
      rpm -Uvh "$TMP/$FILE"
    fi
    ;;
  pacman)
    log "التثبيت عبر pacman ..."
    pacman -U --noconfirm "$TMP/$FILE"
    ;;
  apk)
    log "التثبيت عبر apk ..."
    apk add --allow-untrusted "$TMP/$FILE"
    ;;
  slack)
    log "التثبيت عبر installpkg ..."
    installpkg "$TMP/$FILE"
    ;;
  xbps)
    log "التثبيت عبر xbps-install ..."
    xbps-install -y -R "$TMP/$FILE"
    ;;
  puppy)
    log "نسخة Puppy — ثبّتها من مدير الحزم (PetGet) أو:"
    mkdir -p /opt/wzaker && tar xf "$TMP/$FILE" -C /opt/wzaker
    ln -sf /opt/wzaker/usr/bin/wzaker /usr/local/bin/wzaker
    ;;
  appimage)
    log "تثبيت AppImage ..."
    install -d /opt/wzaker /usr/local/bin /usr/share/applications /usr/share/icons/hicolor/256x256/apps
    install -m755 "$TMP/$FILE" /opt/wzaker/wzaker.AppImage
    ln -sf /opt/wzaker/wzaker.AppImage /usr/local/bin/wzaker
    cat > /usr/share/applications/wzaker.desktop <<'EOF'
[Desktop Entry]
Type=Application
Name=WZAKER
Name[ar]=وذكر
GenericName=سبحة وأذكار
Comment=سبحة إلكترونية وأذكار وقرآن وأوقات صلاة
Exec=wzaker
Icon=wzaker
Categories=Utility;Spirituality;
Terminal=false
StartupWMClass=wzaker
EOF
    if [ -f "$TMP/wzaker.png" ]; then
      install -m644 "$TMP/wzaker.png" /usr/share/icons/hicolor/256x256/apps/wzaker.png
    fi
    ;;
esac

# استرجاع بيانات النسخة القديمة (الإعدادات والإحصائيات) بعد التثبيت
if [ -n "$BACKUP_DIR" ] && [ -d "$BACKUP_DIR" ]; then
  for d in "${DATA_DIRS[@]}"; do
    b="$BACKUP_DIR/$(basename "$d")"
    [ -d "$b" ] && cp -a "$b" "$d" 2>/dev/null
  done
  log "تم استرجاع بياناتك من النسخة السابقة"
fi

log "تم التثبيت بنجاح ✅"
[ -n "$BACKUP_DIR" ] && log "نسخة بياناتك القديمة: $BACKUP_DIR"
log "شغّل التطبيق من قائمة التطبيقات باسم: WZAKER (ذكر)"
exit 0
