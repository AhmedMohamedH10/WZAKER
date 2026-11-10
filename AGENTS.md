# WZAKER Project Analysis & Agent Documentation

## 1. Project Overview
**WZAKER** is a cross-platform digital Tasbih (prayer counter) and Dhikr application featuring prayer times and Quran recitation.
- **Core Framework:** Tauri (Rust backend + Web frontend)
- **Current Version:** 3.6.10
- **License:** MIT
- **Primary Authors:** AhmedMohamedH10 (Original), Mohamed Zaitoon (Linux Port)

## 2. Technology Stack

### Frontend
- **Framework:** React / Vite (Standard Tauri setup)
- **Language:** JavaScript/TypeScript
- **Styling:** Custom CSS/Tailwind
- **State Management:** LocalStorage + Custom State Logic (`~/.config/WZAKER/state.json`)

### Backend (Rust)
- **Runtime:** Tauri Core
- **Key Crates:** `tauri`, `serde`, `serde_json`
- **System Integration:** 
  - Global Hotkeys (`Ctrl+Alt+W`)
  - Filesystem Access (for backups/config)
  - Window Management (Always-on-top, Mini-mode)
  - Input Event Listening (Global scroll for counting on Wayland/X11 via `evdev`)

## 3. Architecture & Key Features

### Core Modules
1. **Tasbih Engine:** Handles counting logic, persistence, and visual feedback.
2. **Dhikr Manager:** Manages lists of prayers from "Hisn al-Muslim".
3. **Notification System:** Draggable notifications that can be pinned above the Tasbih.
4. **Mini Mode:** Collapsible sidebar mode with edge-snapping behavior.
5. **Input Handler:** Listens to global mouse wheel events (requires udev rules on Linux).

### Platform Specifics
- **Windows:** Standard installer (`.exe`), registry shortcuts.
- **Linux:** 
  - Multi-distro support (deb, rpm, apk, tar, appimage, etc.).
  - Auto-installer script with GPG verification.
  - **Udev Rules:** Installs `/etc/udev/rules.d/99-wzaker-input.rules` to allow raw input reading without root.
  - **Wayland/X11 Compatibility:** Uses direct evdev reading for global scrolling.

## 4. Build & Deployment Strategy

### Build Environment
- **Tooling:** `cargo`, `npm/yarn`, `snapcraft` (attempted), `flatpak` (source available).
- **Target Architectures:** amd64 (primary), arm64 (potential).

### Release Workflow
1. **Versioning:** Semantic versioning (e.g., 3.6.10).
2. **Signing:** GPG signing for Linux packages (Key: Mohamed Zaitoon).
3. **Distribution:** GitHub Releases.
4. **Installation:** 
   - Windows: Direct executable.
   - Linux: One-line curl script (`curl ... | sudo bash`) that detects distro and installs the correct package.

## 5. Known Constraints & Solutions

| Constraint | Solution Implemented |
| :--- | :--- |
| **Global Scroll on Linux** | Direct `evdev` reading + Udev rule installation. |
| **Snap Build Failures** | Deferred due to Ubuntu environment complexity in CI; covered by Deb/RPM/AppImage. |
| **Config Persistence** | Explicit backup/restore logic during updates in `~/.config/WZAKER/`. |
| **Cross-Distro Support** | Dynamic package detection in installer script. |

## 6. Agent Instructions (For Future AI Agents)

When working on this codebase, adhere to the following:

### A. Code Style
- **Rust:** Follow standard `rustfmt` conventions. Prioritize safety in FFI or system calls.
- **JS/TS:** Use functional components for React. Keep state logic isolated.
- **Comments:** Use English for code comments, Arabic for user-facing strings (or i18n keys).

### B. Critical Paths
- **Do not break:** The global hotkey registration (`Ctrl+Alt+W`).
- **Do not remove:** The udev rule generation logic for Linux builds.
- **Testing:** Always verify the "Mini Mode" snap behavior and notification dragging before merging UI changes.

### C. Build Commands
- **Dev:** `npm run tauri dev`
- **Build:** `npm run tauri build`
- **Linux Package Gen:** Scripts located in `packaging/`.

### D. File Structure Reference
- `src-tauri/`: Rust backend logic.
- `src/`: Frontend React code.
- `packaging/`: Distribution scripts (Flatpak, Snap, RPM, DEB).
- `build/`: Build artifacts (usually ignored in git).

## 7. Future Roadmap Items
- [ ] Resolve Snap build pipeline for automated store upload.
- [ ] Enhance Flatpak build automation (currently source-ready).
- [ ] Add mobile synchronization (optional future feature).
- [ ] Expand i18n support beyond Arabic/English.

---
*Generated automatically based on codebase analysis v3.6.10*
