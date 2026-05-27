export type ChimeStyle = "soft" | "bell" | "digital" | "wind";

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

interface Tone {
  freq: number;
  durationMs: number;
  type?: OscillatorType;
  delayMs?: number;
  volumeMul?: number;
}

const STYLES: Record<ChimeStyle, Tone[]> = {
  soft:    [{ freq: 528, durationMs: 1400, type: "sine" }],
  bell:    [
    { freq: 880, durationMs: 1500, type: "sine" },
    { freq: 1320, durationMs: 1200, type: "sine", delayMs: 30, volumeMul: 0.4 },
  ],
  digital: [
    { freq: 880, durationMs: 120, type: "square" },
    { freq: 880, durationMs: 120, type: "square", delayMs: 200 },
    { freq: 1100, durationMs: 180, type: "square", delayMs: 400 },
  ],
  wind:    [
    { freq: 523.25, durationMs: 1800, type: "sine" },
    { freq: 659.25, durationMs: 1600, type: "sine", delayMs: 120, volumeMul: 0.7 },
    { freq: 783.99, durationMs: 1400, type: "sine", delayMs: 260, volumeMul: 0.5 },
  ],
};

function playTone(tone: Tone, baseGain: number) {
  const audio = getCtx();
  const start = audio.currentTime + (tone.delayMs ?? 0) / 1000;
  const dur = tone.durationMs / 1000;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = tone.type ?? "sine";
  osc.frequency.setValueAtTime(tone.freq, start);
  const peak = Math.max(0.0001, baseGain * (tone.volumeMul ?? 1));
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain).connect(audio.destination);
  osc.start(start);
  osc.stop(start + dur);
}

interface PlayOptions {
  style?: ChimeStyle;
  /** 0..1 master volume */
  volume?: number;
  /** total times to play (>=1) */
  repeat?: number;
  /** ms between repeats */
  spacingMs?: number;
}

const handles: number[] = [];

export function playChime(opts: PlayOptions = {}) {
  const style = opts.style ?? "soft";
  const volume = Math.max(0, Math.min(1, opts.volume ?? 0.3));
  const repeat = Math.max(1, Math.floor(opts.repeat ?? 1));
  const spacingMs = opts.spacingMs ?? 1500;

  if (volume === 0) return;

  for (let i = 0; i < repeat; i++) {
    const id = window.setTimeout(() => {
      try {
        for (const tone of STYLES[style]) playTone(tone, volume);
      } catch (e) {
        console.warn("chime failed", e);
      }
    }, i * spacingMs);
    handles.push(id);
  }
}

export function stopAllChimes() {
  while (handles.length) {
    const id = handles.pop();
    if (id !== undefined) window.clearTimeout(id);
  }
}
