#!/usr/bin/env bash
# بناء Flatpak + Snap لتطبيق وذكر
# المتطلبات: flatpak-builder (Flatpak) + snapcraft (Snap)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== Flatpak ==="
if command -v flatpak-builder >/dev/null 2>&1; then
  mkdir -p build-flatpak
  flatpak-builder build-flatpak packaging/flatpak/io.github.ahmedmohamedh10.wzaker.yaml \
    --install --user --force-clean
  flatpak build-bundle ~/.var/app repo-build wzaker.flatpak io.github.ahmedmohamedh10.wzaker
  echo "✓ Flatpak bundle: $ROOT/repo-build/wzaker.flatpak"
else
  echo "✗ flatpak-builder غير مثبّت — ثبّته: sudo apt install flatpak-builder"
fi

echo "=== Snap ==="
if command -v snapcraft >/dev/null 2>&1; then
  snapcraft --use-lxd 2>/dev/null || snapcraft
  echo "✓ Snap: $ROOT/wzaker_*.snap"
else
  echo "✗ snapcraft غير مثبّت — ثبّته: sudo apt install snapcraft"
fi
