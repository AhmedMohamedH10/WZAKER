#!/bin/sh
# Launch wrapper for the Flatpak build.
#
# The app needs an X11 (XWayland) connection: it positions itself in the
# corner of the screen and sets an X11 SHAPE input region so that mouse
# clicks pass through everything except the beads. Under a native Wayland
# connection neither is possible, so prefer X11 whenever a display is
# available (Flatpak always provides one with --socket=x11).
if [ -n "${DISPLAY:-}" ]; then
    export GDK_BACKEND=x11
fi

exec /app/bin/wzaker-bin "$@"
