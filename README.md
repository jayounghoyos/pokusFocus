# pokusFocus

Personal desktop pomodoro that combines focus timing with stretch-break reminders — replacing Pomofocus and Stretchly side by side, with a single coordinated schedule.

## Features

- Pomodoro timer with configurable focus / short break / long break
- Coordinated micro-breaks (Stretchly-style 20 s eye-rest), suppressed during pomodoro breaks
- Task list with pomodoro count, drag-drop reorder, auto-check + auto-advance
- Markdown notes per task with interactive checkboxes and expand-to-modal
- System tray with live countdown, hide-on-close, autostart on login
- Fullscreen overlay for breaks with postpone / skip
- Six accent palettes (Crimson · Mist · Forest · Plum · Amber · Slate)
- Keyboard shortcuts: Space (start/pause), Ctrl+N (skip), Esc and P in overlay
- 4 synthesized chime styles with volume + repeat
- Strict mode, pre-break notifications
- Local-only — no login, no cloud sync

## Install

```bash
sudo apt install ./pokus-focus_0.1.0_amd64.deb
```

Or run the `.AppImage` directly, no install needed.

## Build from source

Linux deps:

```bash
sudo apt install libwebkit2gtk-4.1-dev libayatana-appindicator3-dev patchelf libxdo-dev
```

Then:

```bash
npm install
npm run tauri dev       # development with HMR
npm run tauri build     # release bundle in src-tauri/target/release/bundle/
```

Requires Node 20+ and Rust 1.77+.

## Data

All state is local, in `~/.local/share/com.jayoungh.pokusfocus/`. To share between machines, symlink that folder into Dropbox / Syncthing / Nextcloud — no code change needed.

## Stack

Tauri 2 (Rust) + React + TypeScript + Tailwind. ~10 MB binary, ~50 MB idle RAM.
