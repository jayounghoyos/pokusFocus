use std::sync::Arc;
use std::time::Duration;

use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tauri_plugin_notification::NotificationExt;

/// Cadence and behavior settings for the scheduler. Persisted via tauri-plugin-store
/// at the frontend; the Rust side just receives full updates.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SchedulerConfig {
    pub work_secs: u32,
    pub short_break_secs: u32,
    pub long_break_secs: u32,
    pub long_break_every: u32,
    pub micro_break_enabled: bool,
    pub micro_break_interval_secs: u32,
    pub micro_break_duration_secs: u32,
    #[serde(default = "default_true")]
    pub auto_advance: bool,
    #[serde(default)]
    pub strict_mode: bool,
    #[serde(default = "default_true")]
    pub sound_enabled: bool,
    #[serde(default = "default_true")]
    pub auto_check_tasks: bool,
    #[serde(default = "default_true")]
    pub pre_break_warning_enabled: bool,
    #[serde(default = "default_pre_warning_secs")]
    pub pre_break_warning_secs: u32,
}

fn default_true() -> bool { true }
fn default_pre_warning_secs() -> u32 { 30 }

impl Default for SchedulerConfig {
    fn default() -> Self {
        Self {
            work_secs: 25 * 60,
            short_break_secs: 5 * 60,
            long_break_secs: 15 * 60,
            long_break_every: 4,
            micro_break_enabled: true,
            micro_break_interval_secs: 10 * 60,
            micro_break_duration_secs: 20,
            auto_advance: true,
            strict_mode: false,
            sound_enabled: true,
            auto_check_tasks: true,
            pre_break_warning_enabled: true,
            pre_break_warning_secs: 30,
        }
    }
}

/// The phase currently emitted to the UI. `MicroBreak` is a transient
/// interruption layered on top of a `Work` phase.
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "PascalCase")]
pub enum Phase {
    Idle,
    Work,
    ShortBreak,
    LongBreak,
    MicroBreak,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TickEvent {
    pub phase: Phase,
    pub remaining_secs: u32,
    pub total_secs: u32,
    pub cycle: u32,
}

/// Internal state. `micro` is layered on top of `main` — when active,
/// the UI sees the micro break but the main timer is paused under it.
struct State {
    config: SchedulerConfig,
    running: bool,
    cycle: u32,
    main_phase: Phase,
    main_remaining: u32,
    main_total: u32,
    secs_since_last_micro: u32,
    micro_active: bool,
    micro_remaining: u32,
    /// If the user postpones a break, we go back to a brief Work phase
    /// and remember the break to restore once that brief Work ends.
    postponed_break: Option<(Phase, u32)>,
}

impl State {
    fn new(config: SchedulerConfig) -> Self {
        let total = config.work_secs;
        Self {
            config,
            running: false,
            cycle: 0,
            main_phase: Phase::Idle,
            main_remaining: total,
            main_total: total,
            secs_since_last_micro: 0,
            micro_active: false,
            micro_remaining: 0,
            postponed_break: None,
        }
    }

    fn enter_work(&mut self) {
        self.main_phase = Phase::Work;
        self.main_total = self.config.work_secs;
        self.main_remaining = self.config.work_secs;
        self.secs_since_last_micro = 0;
    }

    fn enter_short_break(&mut self) {
        self.main_phase = Phase::ShortBreak;
        self.main_total = self.config.short_break_secs;
        self.main_remaining = self.config.short_break_secs;
    }

    fn enter_long_break(&mut self) {
        self.main_phase = Phase::LongBreak;
        self.main_total = self.config.long_break_secs;
        self.main_remaining = self.config.long_break_secs;
    }

    fn enter_idle(&mut self) {
        self.main_phase = Phase::Idle;
        self.main_total = self.config.work_secs;
        self.main_remaining = self.config.work_secs;
        self.cycle = 0;
        self.secs_since_last_micro = 0;
        self.micro_active = false;
    }

    fn advance_after_main_end(&mut self) {
        match self.main_phase {
            Phase::Work => {
                if let Some((break_phase, break_total)) = self.postponed_break.take() {
                    self.main_phase = break_phase;
                    self.main_total = break_total;
                    self.main_remaining = break_total;
                    return;
                }
                self.cycle += 1;
                if self.cycle % self.config.long_break_every == 0 {
                    self.enter_long_break();
                } else {
                    self.enter_short_break();
                }
            }
            Phase::ShortBreak | Phase::LongBreak => {
                self.enter_work();
            }
            Phase::Idle | Phase::MicroBreak => {
                self.enter_work();
            }
        }
    }

    fn snapshot_tick(&self) -> TickEvent {
        if self.micro_active {
            TickEvent {
                phase: Phase::MicroBreak,
                remaining_secs: self.micro_remaining,
                total_secs: self.config.micro_break_duration_secs,
                cycle: self.cycle,
            }
        } else {
            TickEvent {
                phase: self.main_phase,
                remaining_secs: self.main_remaining,
                total_secs: self.main_total,
                cycle: self.cycle,
            }
        }
    }
}

pub struct Scheduler {
    state: Mutex<State>,
    app: AppHandle,
}

impl Scheduler {
    pub fn new(app: AppHandle, config: SchedulerConfig) -> Self {
        Self {
            state: Mutex::new(State::new(config)),
            app,
        }
    }

    pub fn spawn(self: &Arc<Self>) {
        let me = Arc::clone(self);
        tauri::async_runtime::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(1));
            interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
            loop {
                interval.tick().await;
                me.tick();
            }
        });
    }

    fn tick(&self) {
        let snapshot = {
            let mut s = self.state.lock();
            if s.running {
                self.step(&mut s);
            }
            s.snapshot_tick()
        };
        let _ = self.app.emit("scheduler://tick", snapshot);
    }

    fn step(&self, s: &mut State) {
        if s.micro_active {
            if s.micro_remaining > 0 {
                s.micro_remaining -= 1;
            }
            if s.micro_remaining == 0 {
                s.micro_active = false;
                let _ = self.app.emit("scheduler://micro-end", ());
            }
            return;
        }

        if s.main_remaining > 0 {
            s.main_remaining -= 1;
        }

        if s.main_phase == Phase::Work
            && s.config.micro_break_enabled
            && s.main_remaining > s.config.micro_break_duration_secs + 5
        {
            s.secs_since_last_micro += 1;
            if s.secs_since_last_micro >= s.config.micro_break_interval_secs {
                s.secs_since_last_micro = 0;
                s.micro_active = true;
                s.micro_remaining = s.config.micro_break_duration_secs;
                let _ = self.app.emit("scheduler://micro-start", ());
            }
        }

        if s.main_phase == Phase::Work
            && s.config.pre_break_warning_enabled
            && s.main_remaining == s.config.pre_break_warning_secs
            && s.main_remaining > 0
        {
            let _ = self.app.emit("scheduler://pre-break", ());
            let _ = self
                .app
                .notification()
                .builder()
                .title("Break coming up")
                .body(format!(
                    "Break in {} seconds",
                    s.config.pre_break_warning_secs
                ))
                .show();
        }

        if s.main_remaining == 0 {
            let ending = s.main_phase;
            let was_postponed = ending == Phase::Work && s.postponed_break.is_some();
            s.advance_after_main_end();
            if !s.config.auto_advance {
                s.running = false;
            }
            let _ = self
                .app
                .emit("scheduler://phase-end", PhaseEndPayload {
                    ended: ending,
                    started: s.main_phase,
                    is_postponed: was_postponed,
                });
        }
    }

    pub fn start(&self) {
        let mut s = self.state.lock();
        if s.main_phase == Phase::Idle {
            s.enter_work();
        }
        s.running = true;
    }

    pub fn pause(&self) {
        self.state.lock().running = false;
    }

    pub fn skip(&self) {
        let mut s = self.state.lock();
        if s.config.strict_mode
            && matches!(
                s.main_phase,
                Phase::ShortBreak | Phase::LongBreak
            )
            && !s.micro_active
        {
            return;
        }
        if s.micro_active {
            s.micro_active = false;
            s.micro_remaining = 0;
            let _ = self.app.emit("scheduler://micro-end", ());
            return;
        }
        let ending = s.main_phase;
        let was_postponed = ending == Phase::Work && s.postponed_break.is_some();
        s.advance_after_main_end();
        let _ = self.app.emit(
            "scheduler://phase-end",
            PhaseEndPayload {
                ended: ending,
                started: s.main_phase,
                is_postponed: was_postponed,
            },
        );
    }

    pub fn reset(&self) {
        let mut s = self.state.lock();
        s.running = false;
        s.postponed_break = None;
        s.enter_idle();
    }

    pub fn postpone(&self, secs: u32) {
        let mut s = self.state.lock();
        if !matches!(s.main_phase, Phase::ShortBreak | Phase::LongBreak) {
            return;
        }
        let break_phase = s.main_phase;
        let break_total = s.main_total;
        s.postponed_break = Some((break_phase, break_total));
        s.main_phase = Phase::Work;
        s.main_total = secs;
        s.main_remaining = secs;
        s.secs_since_last_micro = 0;
        let _ = self.app.emit(
            "scheduler://phase-end",
            PhaseEndPayload {
                ended: break_phase,
                started: Phase::Work,
                is_postponed: true,
            },
        );
    }

    pub fn config(&self) -> SchedulerConfig {
        self.state.lock().config.clone()
    }

    pub fn update_config(&self, config: SchedulerConfig) {
        let mut s = self.state.lock();
        s.config = config;
    }
}

#[derive(Clone, Serialize)]
struct PhaseEndPayload {
    ended: Phase,
    started: Phase,
    is_postponed: bool,
}

/// Thin Tauri-managed wrapper around `Arc<Scheduler>`.
pub struct SchedulerHandle(pub Arc<Scheduler>);

impl SchedulerHandle {
    pub fn start(&self) { self.0.start(); }
    pub fn pause(&self) { self.0.pause(); }
    pub fn skip(&self) { self.0.skip(); }
    pub fn reset(&self) { self.0.reset(); }
    pub fn postpone(&self, secs: u32) { self.0.postpone(secs); }
    pub fn config(&self) -> SchedulerConfig { self.0.config() }
    pub fn update_config(&self, c: SchedulerConfig) { self.0.update_config(c); }
}
