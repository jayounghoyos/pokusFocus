mod scheduler;

use std::sync::Arc;

use scheduler::{Phase, Scheduler, SchedulerConfig, SchedulerHandle, TickEvent};
use serde::Deserialize;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Listener, Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent};
use tauri_plugin_autostart::MacosLauncher;

const TRAY_ID: &str = "pokus-focus-tray";
const OVERLAY_LABEL: &str = "overlay";
const TOAST_LABEL: &str = "toast";

#[tauri::command]
fn scheduler_start(handle: tauri::State<'_, SchedulerHandle>) {
    handle.start();
}

#[tauri::command]
fn scheduler_pause(handle: tauri::State<'_, SchedulerHandle>) {
    handle.pause();
}

#[tauri::command]
fn scheduler_skip(handle: tauri::State<'_, SchedulerHandle>) {
    handle.skip();
}

#[tauri::command]
fn scheduler_reset(handle: tauri::State<'_, SchedulerHandle>) {
    handle.reset();
}

#[tauri::command]
fn scheduler_postpone(handle: tauri::State<'_, SchedulerHandle>, secs: u32) {
    handle.postpone(secs);
}

#[tauri::command]
fn scheduler_config(handle: tauri::State<'_, SchedulerHandle>) -> SchedulerConfig {
    handle.config()
}

#[tauri::command]
fn scheduler_update_config(
    handle: tauri::State<'_, SchedulerHandle>,
    config: SchedulerConfig,
) {
    handle.update_config(config);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Must be registered first: a second launch (e.g. from the app menu while
        // the autostarted copy sits in the tray) focuses the running instance
        // instead of spawning a second scheduler + tray icon.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            toggle_main_window(app, true);
        }))
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    let _ = window.hide();
                    api.prevent_close();
                }
            }
        })
        .setup(|app| {
            build_tray(app.handle())?;
            heal_autostart_entry(app.handle());

            let started_minimized = std::env::args().any(|a| a == "--minimized");
            if !started_minimized {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.set_focus();
                }
            }

            let app_handle = app.handle().clone();
            let scheduler = Arc::new(Scheduler::new(app_handle.clone(), SchedulerConfig::default()));
            scheduler.spawn();
            app.manage(SchedulerHandle(scheduler));

            wire_event_listeners(&app_handle);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            scheduler_start,
            scheduler_pause,
            scheduler_skip,
            scheduler_reset,
            scheduler_postpone,
            scheduler_config,
            scheduler_update_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// The autostart plugin records `current_exe()` only at the moment the user
/// toggles it on. If that happened under `tauri dev`, the login entry points at
/// the debug binary, which loads its UI from the (not running) Vite dev server
/// and boots into a dead window. Release builds re-register on every launch so
/// the entry always targets the binary that is actually installed. Debug builds
/// never rewrite it, so a dev session can't re-break a working install.
fn heal_autostart_entry(app: &AppHandle) {
    #[cfg(not(debug_assertions))]
    {
        use tauri_plugin_autostart::ManagerExt;
        let launcher = app.autolaunch();
        if launcher.is_enabled().unwrap_or(false) {
            if let Err(e) = launcher.enable() {
                eprintln!("failed to refresh autostart entry: {e}");
            }
        }
    }
    #[cfg(debug_assertions)]
    let _ = app;
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Show window", true, None::<&str>)?;
    let pause = MenuItem::with_id(app, "pause", "Pause / Resume", true, None::<&str>)?;
    let skip = MenuItem::with_id(app, "skip", "Skip phase", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &pause, &skip, &sep, &quit])?;

    TrayIconBuilder::with_id(TRAY_ID)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("pokusFocus — idle")
        .icon(app.default_window_icon().cloned().expect("no default icon"))
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => toggle_main_window(app, true),
            "pause" => {
                if let Some(h) = app.try_state::<SchedulerHandle>() {
                    h.toggle();
                }
            }
            "skip" => {
                if let Some(h) = app.try_state::<SchedulerHandle>() {
                    h.skip();
                }
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                toggle_main_window(tray.app_handle(), false);
            }
        })
        .build(app)?;

    Ok(())
}

fn wire_event_listeners(app: &AppHandle) {
    let tick_app = app.clone();
    app.listen("scheduler://tick", move |event| {
        if let Ok(tick) = serde_json::from_str::<TickEvent>(event.payload()) {
            update_tray_tooltip(&tick_app, &tick);
        }
    });

    let phase_app = app.clone();
    app.listen("scheduler://phase-end", move |event| {
        #[derive(Deserialize)]
        struct PhaseEnd { ended: Phase, started: Phase }
        let Ok(p) = serde_json::from_str::<PhaseEnd>(event.payload()) else { return };

        if matches!(p.ended, Phase::ShortBreak | Phase::LongBreak) {
            close_window(&phase_app, OVERLAY_LABEL);
        }
        if matches!(p.started, Phase::ShortBreak | Phase::LongBreak) {
            open_overlay(&phase_app);
        }
    });

    let micro_start_app = app.clone();
    app.listen("scheduler://micro-start", move |_| {
        open_toast(&micro_start_app);
    });

    let micro_end_app = app.clone();
    app.listen("scheduler://micro-end", move |_| {
        close_window(&micro_end_app, TOAST_LABEL);
    });
}

fn update_tray_tooltip(app: &AppHandle, tick: &TickEvent) {
    let Some(tray) = app.tray_by_id(TRAY_ID) else { return };
    let mins = tick.remaining_secs / 60;
    let secs = tick.remaining_secs % 60;
    let phase = match tick.phase {
        Phase::Idle => "idle",
        Phase::Work => "focus",
        Phase::ShortBreak => "short break",
        Phase::LongBreak => "long break",
        Phase::MicroBreak => "water break",
    };
    let _ = tray.set_tooltip(Some(format!("pokusFocus — {phase} {mins:02}:{secs:02}")));
}

fn open_overlay(app: &AppHandle) {
    if app.get_webview_window(OVERLAY_LABEL).is_some() {
        return;
    }
    let result = WebviewWindowBuilder::new(
        app,
        OVERLAY_LABEL,
        WebviewUrl::App("index.html#/overlay".into()),
    )
    .title("pokusFocus break")
    .fullscreen(true)
    .always_on_top(true)
    .decorations(false)
    .skip_taskbar(true)
    .resizable(false)
    .build();

    if let Err(e) = result {
        eprintln!("failed to open overlay window: {e}");
    }
}

fn open_toast(app: &AppHandle) {
    if app.get_webview_window(TOAST_LABEL).is_some() {
        return;
    }
    let result = WebviewWindowBuilder::new(
        app,
        TOAST_LABEL,
        WebviewUrl::App("index.html#/toast".into()),
    )
    .title("water break")
    .inner_size(320.0, 80.0)
    .position(40.0, 40.0)
    .always_on_top(true)
    .decorations(false)
    .skip_taskbar(true)
    .resizable(false)
    .focused(false)
    .transparent(true)
    .build();

    if let Err(e) = result {
        eprintln!("failed to open toast window: {e}");
    }
}

fn close_window(app: &AppHandle, label: &str) {
    if let Some(win) = app.get_webview_window(label) {
        let _ = win.close();
    }
}

fn toggle_main_window(app: &AppHandle, force_show: bool) {
    let Some(win) = app.get_webview_window("main") else { return };
    let visible = win.is_visible().unwrap_or(false);
    if visible && !force_show {
        let _ = win.hide();
    } else {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
    }
}
