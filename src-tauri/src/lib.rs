mod scheduler;

use std::sync::Arc;

use scheduler::{Phase, Scheduler, SchedulerConfig, SchedulerHandle, TickEvent};
use serde::Deserialize;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Listener, Manager, WebviewUrl, WebviewWindowBuilder};
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
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .setup(|app| {
            build_tray(app.handle())?;

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
            scheduler_config,
            scheduler_update_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
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
            "show" => {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.set_focus();
                }
            }
            "pause" => {
                if let Some(h) = app.try_state::<SchedulerHandle>() {
                    h.pause();
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
        Phase::MicroBreak => "micro break",
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
    .title("micro-break")
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
