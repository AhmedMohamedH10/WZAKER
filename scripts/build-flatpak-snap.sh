#!/usr/bin/env bash
# بناء Flatpak + Snap لتطبيق وذكر
# المتطلبات: flatpak-builder (Flatpak) + snapcraft (Snap)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

APP_ID="io.github.mohamed_zaitoon.wzaker"
FLATPAK_MANIFEST="packaging/flatpak/${APP_ID}.yaml"

echo "=== Flatpak ==="
if command -v flatpak-builder >/dev/null 2>&1; then
  rm -rf build-flatpak repo-build
  flatpak-builder --user --force-clean --repo=repo-build build-flatpak "$FLATPAK_MANIFEST"
  flatpak build-bundle repo-build wzaker.flatpak "$APP_ID"
  echo "✓ Flatpak bundle: $ROOT/wzaker.flatpak"
else
  echo "✗ flatpak-builder غير مثبّت — ثبّته: sudo dnf install flatpak-builder"
fi

echo "=== Snap ==="
if command -v snapcraft >/dev/null 2>&1; then
  (cd packaging/snap && snapcraft)
  echo "✓ Snap: $ROOT/packaging/snap/wzaker_*.snap"
else
  echo "✗ snapcraft غير مثبّت — ثبّته: sudo snap install snapcraft --classic"
fi
