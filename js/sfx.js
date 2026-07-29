/**
 * OMRET — sound.
 *
 * Every effect is synthesised at play time from oscillators, envelopes and
 * filtered noise. Nothing is loaded, so there are no audio files to license or
 * host, no extra requests, and the whole thing costs a few kilobytes.
 *
 * The palette follows the game's logic rather than decorating it. Pitch carries
 * meaning: a dead letter lands low and dull, an amber letter sits in the middle,
 * a locked letter rings high and hard because it is the dangerous one. The
 * cornered sequence works downward into sub-bass, and winning is the only place
 * a major arpeggio appears, so relief is audibly different from everything else.
 */

let ctx = null;
let master = null;
let enabled = true;

/** Created lazily: constructing an AudioContext before a gesture is refused. */
function audio() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
  return ctx;
}

/** Browsers keep the context suspended until the player interacts. */
export function unlock() {
  const c = audio();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}

export function setEnabled(on) {
  enabled = Boolean(on);
  if (enabled) unlock();
}

/**
 * One oscillator with an attack/decay envelope, optionally gliding in pitch.
 * Everything tonal in the game is built from this.
 */
function tone({
  freq, to, dur = 0.12, type = 'sine',
  gain = 0.2, delay = 0, attack = 0.004,
}) {
  const c = audio();
  if (!c || !enabled) return;

  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const env = c.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);

  env.gain.setValueAtTime(0.0001, t0);
  env.gain.linearRampToValueAtTime(gain, t0 + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  osc.connect(env).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

/** A burst of noise swept through a lowpass: impacts, air, texture. */
function noise({ dur = 0.2, gain = 0.2, delay = 0, from = 1200, to = 200 }) {
  const c = audio();
  if (!c || !enabled) return;

  const t0 = c.currentTime + delay;
  const frames = Math.max(1, Math.ceil(c.sampleRate * dur));
  const buffer = c.createBuffer(1, frames, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;

  const src = c.createBufferSource();
  src.buffer = buffer;

  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(from, t0);
  filter.frequency.exponentialRampToValueAtTime(Math.max(40, to), t0 + dur);

  const env = c.createGain();
  env.gain.setValueAtTime(gain, t0);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  src.connect(filter).connect(env).connect(master);
  src.start(t0);
  src.stop(t0 + dur);
}

/** Pitch and timbre per mark, so a row is legible with your eyes shut. */
const REVEAL = {
  banned:      { freq: 196, type: 'sine',     gain: 0.10, dur: 0.11 },
  spent:       { freq: 233, type: 'sine',     gain: 0.08, dur: 0.11 },
  required:    { freq: 392, type: 'triangle', gain: 0.13, dur: 0.15 },
  locked:      { freq: 523, type: 'square',   gain: 0.11, dur: 0.17 },
  placeholder: { freq: 233, type: 'sine',     gain: 0.06, dur: 0.09 },
};

export const sfx = {
  /** A letter lands. Rises slightly across the row so typing has shape. */
  key(slot = 0) {
    tone({ freq: 330 + slot * 22, dur: 0.05, type: 'triangle', gain: 0.11 });
  },

  /** A locked slot accepting the one letter it wants. */
  keyLocked(slot = 0) {
    tone({ freq: 392 + slot * 22, dur: 0.07, type: 'square', gain: 0.10 });
  },

  back() {
    tone({ freq: 240, to: 170, dur: 0.07, type: 'triangle', gain: 0.11 });
  },

  /** A keystroke the board refuses outright. */
  refuse() {
    tone({ freq: 190, to: 95, dur: 0.2, type: 'sawtooth', gain: 0.14 });
    noise({ dur: 0.13, gain: 0.05, from: 900, to: 180 });
  },

  /** A complete word the rules reject. Heavier than a single bad keystroke. */
  reject() {
    tone({ freq: 150, to: 82, dur: 0.26, type: 'square', gain: 0.12 });
    noise({ dur: 0.18, gain: 0.05, from: 700, to: 120 });
  },

  submit() {
    tone({ freq: 300, to: 460, dur: 0.1, type: 'sine', gain: 0.08 });
  },

  reveal(mark, slot = 0) {
    const v = REVEAL[mark] || REVEAL.banned;
    tone({ ...v, freq: v.freq * (1 + slot * 0.013) });
  },

  /** The pool shrinking. Bigger losses fall further and last longer. */
  poolDrop(lost, left) {
    if (!(lost > 0)) return;
    const depth = Math.min(1, Math.log10(1 + lost) / 3.4);
    tone({
      freq: 720,
      to: 280 - depth * 130,
      dur: 0.18 + depth * 0.22,
      type: 'sine',
      gain: 0.09,
    });
    // A low knell once the trap is genuinely close.
    if (left <= 12) tone({ freq: 116, dur: 0.34, type: 'sine', gain: 0.1, delay: 0.06 });
  },

  /** The pause before the trap spells the word out. */
  dread() {
    tone({ freq: 72, to: 58, dur: 1.25, type: 'sine', gain: 0.17 });
    noise({ dur: 1.0, gain: 0.04, from: 380, to: 70 });
  },

  /** Each forced letter hitting the board. */
  slam(slot = 0) {
    const f = 92 + slot * 15;
    tone({ freq: f * 3, to: f, dur: 0.16, type: 'square', gain: 0.15 });
    noise({ dur: 0.12, gain: 0.11, from: 1900, to: 190 });
  },

  /** Letters turning red, one after another. */
  ignite(slot = 0) {
    tone({ freq: 300 + slot * 78, dur: 0.13, type: 'sawtooth', gain: 0.09 });
  },

  /** The trap closed. */
  boom() {
    tone({ freq: 116, to: 41, dur: 1.15, type: 'sine', gain: 0.23 });
    noise({ dur: 0.8, gain: 0.13, from: 1100, to: 55 });
  },

  /** The only major arpeggio in the game. */
  win() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      tone({ freq: f, dur: 0.42, type: 'triangle', gain: 0.12, delay: i * 0.11 });
    });
    tone({ freq: 261.63, dur: 0.95, type: 'sine', gain: 0.09, delay: 0.33 });
  },

  open() {
    noise({ dur: 0.16, gain: 0.05, from: 500, to: 2600 });
    tone({ freq: 420, to: 620, dur: 0.13, type: 'sine', gain: 0.06 });
  },

  close() {
    noise({ dur: 0.14, gain: 0.05, from: 2400, to: 400 });
    tone({ freq: 560, to: 360, dur: 0.11, type: 'sine', gain: 0.06 });
  },

  toggle(on = true) {
    tone({ freq: on ? 520 : 380, dur: 0.06, type: 'square', gain: 0.09 });
  },

  confirm() {
    tone({ freq: 587.33, dur: 0.1, type: 'triangle', gain: 0.11 });
    tone({ freq: 880, dur: 0.16, type: 'triangle', gain: 0.09, delay: 0.08 });
  },

  tick() {
    tone({ freq: 640, dur: 0.04, type: 'sine', gain: 0.07 });
  },
};
