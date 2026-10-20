#!/usr/bin/env bash
# بناء حزمة Snap من WZAKER
#  - على Ubuntu: snapcraft pack مباشرة
#  - على باقي التوزيعات (Fedora وغيرها): حاوية ubuntu:24.04 عبر podman
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
DIST="$HERE/../../dist"

echo "=== بناء WZAKER snap ==="
if [ "${1:-}" = "--local" ]; then
  # بناء داخل حاوية Ubuntu ( snapcraft ما بيبنيش حزم Ubuntu غير على Ubuntu )
  podman run --rm --privileged \
    -v "$HOME":"$HOME" \
    -v /var/lib/snapd:/var/lib/snapd \
    -w "$HERE" \
    docker.io/library/ubuntu:24.04 \
    bash -c "export DEBIAN_FRONTEND=noninteractive; apt-get update -qq && apt-get install -y -qq snapcraft python3 git curl ca-certificates >/dev/null 2>&1 && snapcraft pack"
else
  (cd "$HERE" && snapcraft pack)
fi

SNAP="$(ls -t "$HERE"/wzaker_*.snap 2>/dev/null | head -1)"
if [ -n "$SNAP" ]; then
  mkdir -p "$DIST"
  cp -f "$SNAP" "$DIST/"
  echo
  echo "✓ جاهز: $DIST/$(basename "$SNAP")"
  echo "  للنشر: snapcraft login && snapcraft upload --release \"3.6.4\" $(basename "$SNAP")"
else
  echo "! ما اتعملش snap — شوف السجل فوق"
  exit 1
fi
