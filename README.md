# pokusFocus

Personal desktop pomodoro that combines focus timing with stretch-break reminders — replacing Pomofocus and Stretchly side by side, with a single coordinated schedule.

Tauri 2 + React + TypeScript + Tailwind. ~10 MB binary, ~50 MB idle RAM. Linux only.

---

## Install — `.deb` (recommended)

### 1. Install runtime system deps (one-time)

```bash
sudo apt update
sudo apt install -y libwebkit2gtk-4.1-0 libayatana-appindicator3-1
```

### 2. Get the `.deb`

Either grab `pokusFocus_0.3.0_amd64.deb` from a release, or build it locally (see [Build from source](#build-from-source)).

### 3. Install it

Copy to `/tmp/` first so apt doesn't complain about sandbox permissions, then install:

```bash
cp pokusFocus_0.3.0_amd64.deb /tmp/
sudo apt install /tmp/pokusFocus_0.3.0_amd64.deb
```

### 4. Launch

Open it from your app launcher (search **pokusFocus** in GNOME Activities), or open the app and toggle **Settings → System → Start at login** so it auto-starts to your tray on boot.

### Uninstall

```bash
sudo apt remove pokus-focus           # keeps your tasks/notes
sudo apt purge  pokus-focus           # also wipes your data
```

---

## Install — `.AppImage` (portable, no install)

For non-Debian systems or when you don't want to install anything:

```bash
chmod +x pokusFocus_0.3.0_amd64.AppImage
./pokusFocus_0.3.0_amd64.AppImage
```

Self-contained binary. Drop it anywhere, double-click or run from terminal.

---

## Features

- Pomodoro timer with configurable focus / short break / long break, and a ladder showing where you are before the long break
- Water-break reminders (default every 30 m of focus, 30 s), counted across sessions and suppressed during pomodoro breaks
- **Today** — the clock and the task you're on, *Up next*, *Today so far* (focused time, breaks taken, water breaks), and the **Day strip**: today's planned calendar blocks against the focus you actually logged
- **Week** — 7-day × 24h calendar with done/planned pomodoros per day; click an hour to plan a block, drag a block to move it (time and day), drag its bottom edge to resize; a day-by-day agenda on narrow windows
- **Recurring blocks** — repeat on chosen weekdays; each day gets its own instance in Today
- Task lists with pomodoro counts, auto-check + auto-advance; drag *Anytime* tasks into the order the clock should take them
- Markdown notes per task in a side panel (full-screen on narrow windows), with interactive checkboxes
- Session log (kept 60 days) — only focus sessions that run out earn a pomodoro; skipped ones don't
- System tray with live countdown, Pause/Resume, hide-on-close, start at login (single instance)
- Fullscreen break screen with suggested stretches, postpone / skip — or neither, in strict mode
- Dark, light or follow-the-system mode; four background tones; six preset focus colours or any colour you pick; any colour per task
- 4 synthesized chime styles with volume + repeat; pre-break notifications
- Local-only — no login, no cloud sync

## Keyboard shortcuts

| Action | Shortcut |
|---|---|
| Start / Pause | `Space` |
| Skip phase | `Ctrl+N` |
| Reset | `Ctrl+R` |
| Skip break (in overlay) | `Esc` |
| Postpone break (in overlay) | `P` |
| Save edit (tasks) | `Enter` |
| Cancel edit (tasks) | `Esc` |

---

## Build from source

Required: Node 20+, Rust 1.77+, and Linux dev deps:

```bash
sudo apt install libwebkit2gtk-4.1-dev libayatana-appindicator3-dev \
                 patchelf libxdo-dev librsvg2-dev
```

Then:

```bash
git clone git@github.com:jayounghoyos/pocusFocus.git
cd pocusFocus
npm install
npm run tauri dev       # development with HMR (its data is separate from the installed app's)
npx vite                # UI only, in a browser, with a simulated scheduler; add ?demo for sample data
npm run tauri build     # produces .deb + .AppImage in src-tauri/target/release/bundle/
```

Generated artifacts:

```
src-tauri/target/release/bundle/deb/pokusFocus_0.3.0_amd64.deb
src-tauri/target/release/bundle/appimage/pokusFocus_0.3.0_amd64.AppImage
```

---

## Data location

All state — tasks, notes, session log, settings, active task, colour — lives in the app's webview storage under:

```
~/.local/share/com.jayoungh.pokusfocus/
```

Survives reboots and `apt remove`. Only `apt purge` deletes it.

To share state between machines, symlink that folder into Dropbox / Syncthing / Nextcloud. No code change needed, no servers involved.
