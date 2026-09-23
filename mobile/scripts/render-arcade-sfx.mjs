// Renders web's arcade voices (web/src/features/games/arcade/arcade-sfx.ts) to small WAV files for the app.
//
// Web builds each cue live from Web Audio oscillators, noise, biquad filters and exponential envelopes; React Native
// has no synth, so the app plays these renders of the same graphs instead, computed sample by sample with Web Audio's
// automation rules (setValueAtTime / exponentialRampToValueAtTime) and its filter shapes. Two voices move with the run:
// the hop's "tuiing" climbs with the streak (a fifth across forty gaps, then held) and the ride's milestone tick rises
// a semitone per whole multiplier (an octave cap). Those are rendered as steps: nine for the hop (every fifth gap) and
// thirteen for the tick (every semitone), so what the phone plays is the pitch web would have played.
// Run: node mobile/scripts/render-arcade-sfx.mjs  →  mobile/assets/sounds/arcade-*.wav
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RATE = 44_100;
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "../assets/sounds");

const HOP_BASE_HZ = 783.99;
const HOP_CLIMB_OCTAVES = 0.75;
const HOP_STREAK_CAP = 40;
const HOP_STEPS = 9;
const BLOOM_HZ = [440, 523.25, 659.25, 880];
const TUMBLE_HZ = [880, 783.99, 659.25, 523.25, 440];
const MILESTONE_BASE_HZ = 1046.5;
const MILESTONE_STEPS = 13;

// Deterministic noise, so a re-render is byte-identical (web fills one second of Math.random()).
let seed = 0x5eed_a11;
const noiseSample = () => ((seed = (seed * 1_664_525 + 1_013_904_223) >>> 0) / 0x1_0000_0000) * 2 - 1;
const NOISE = Float64Array.from({ length: RATE }, noiseSample);

/** A Web Audio AudioParam: set/exponential-ramp events, read at any time. */
function param(initial) {
  const events = [];
  return {
    set(value, t) {
      events.push({ kind: "set", value, t });
      return this;
    },
    exp(value, t) {
      events.push({ kind: "exp", value, t });
      return this;
    },
    at(time) {
      let value = initial;
      let from = { value: initial, t: 0 };
      for (const event of events) {
        if (event.t <= time) {
          value = event.value;
          from = event;
          continue;
        }
        if (event.kind === "exp") {
          const span = event.t - from.t;
          const k = span > 0 ? (time - from.t) / span : 1;
          return from.value * (event.value / from.value) ** k;
        }
        return value;
      }
      return value;
    },
  };
}

const WAVE = {
  sine: (p) => Math.sin(2 * Math.PI * p),
  square: (p) => (p % 1 < 0.5 ? 1 : -1),
  triangle: (p) => 1 - 4 * Math.abs((p % 1) - 0.5),
  sawtooth: (p) => 2 * (p % 1) - 1,
};

/** An oscillator from `start` to `stop`, its frequency a param, into `bus` sample by sample. */
function osc(bus, { type, freq, detune = 0, start, stop, gain }) {
  let phase = 0;
  const cents = 2 ** (detune / 1200);
  for (let i = Math.round(start * RATE); i < Math.min(bus.length, Math.round(stop * RATE)); i += 1) {
    const t = i / RATE;
    phase += (freq.at(t) * cents) / RATE;
    bus[i] += WAVE[type](phase) * (gain ? gain.at(t) : 1);
  }
}

/** RBJ biquad with a per-sample cutoff (Web Audio's shapes: lowpass/highpass Q in dB, bandpass Q linear). */
function biquad(input, { type, freq, q = 1 }) {
  const out = new Float64Array(input.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  const qLinear = type === "bandpass" ? q : 10 ** (q / 20);
  for (let i = 0; i < input.length; i += 1) {
    const w = (2 * Math.PI * Math.min(freq.at(i / RATE), RATE / 2 - 1)) / RATE;
    const alpha = Math.sin(w) / (2 * qLinear);
    const cos = Math.cos(w);
    let b0;
    let b1;
    let b2;
    if (type === "lowpass") [b0, b1, b2] = [(1 - cos) / 2, 1 - cos, (1 - cos) / 2];
    else if (type === "highpass") [b0, b1, b2] = [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2];
    else [b0, b1, b2] = [alpha, 0, -alpha];
    const a0 = 1 + alpha;
    const x = input[i];
    const y = (b0 * x + b1 * x1 + b2 * x2 + 2 * cos * y1 - (1 - alpha) * y2) / a0;
    out[i] = y;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
  }
  return out;
}

const mixInto = (bus, part, gain) => {
  for (let i = 0; i < bus.length; i += 1) bus[i] += part[i] * (gain ? gain.at(i / RATE) : 1);
};

/** arcade-sfx.ts tone(): one oscillator, 8 ms attack to `peak`, exponential release to `at + dur`. */
function tone(bus, type, hz, at, dur, peak, detune = 0) {
  const gain = param(0).set(0.0001, at).exp(peak, at + 0.008).exp(0.0001, at + dur);
  osc(bus, { type, freq: param(hz), detune, start: at, stop: at + dur + 0.02, gain });
}

/** arcade-sfx.ts sweep(): filtered noise with a cutoff glide and a swell. */
function sweep(bus, type, fromHz, toHz, at, dur, peak) {
  const src = new Float64Array(bus.length);
  for (let i = Math.round(at * RATE); i < Math.min(bus.length, Math.round((at + dur + 0.05) * RATE)); i += 1) src[i] = NOISE[i % RATE];
  const filtered = biquad(src, { type, freq: param(fromHz).set(fromHz, at).exp(toHz, at + dur * 0.8), q: 0.7 });
  mixInto(bus, filtered, param(0).set(0.0001, at).exp(peak, at + dur * 0.3).exp(0.0001, at + dur));
}

/** arcade-sfx.ts thud(): a sine falling 170 → 40 Hz under a short swell. */
function thud(bus, t, peak) {
  const gain = param(0).set(0.0001, t).exp(peak, t + 0.02).exp(0.0001, t + 0.55);
  osc(bus, { type: "sine", freq: param(170).set(170, t).exp(40, t + 0.45), start: t, stop: t + 0.58, gain });
}

const VOICES = {};

for (let step = 0; step < HOP_STEPS; step += 1) {
  VOICES[`arcade-hop-score-${step}`] = [0.2, (bus) => {
    const climb = Math.min(step * 5, HOP_STREAK_CAP) / HOP_STREAK_CAP;
    const hz = HOP_BASE_HZ * 2 ** (HOP_CLIMB_OCTAVES * climb);
    const gain = param(0).set(0.0001, 0).exp(0.12, 0.008).exp(0.0001, 0.16);
    osc(bus, { type: "triangle", freq: param(hz * 0.86).set(hz * 0.86, 0).exp(hz, 0.05), start: 0, stop: 0.18, gain });
    tone(bus, "sine", hz * 2, 0.012, 0.1, 0.04);
  }];
}

VOICES["arcade-hop-crash"] = [0.7, (bus) => {
  const saws = new Float64Array(bus.length);
  for (const [hz, detune] of [[330, -7], [494, 7]]) {
    osc(saws, { type: "sawtooth", freq: param(hz).set(hz, 0).exp(hz * 0.66, 0.5), detune, start: 0, stop: 0.64 });
  }
  const filtered = biquad(saws, { type: "lowpass", freq: param(1_800).set(1_800, 0).exp(260, 0.55) });
  mixInto(bus, filtered, param(0).set(0.0001, 0).exp(0.2, 0.02).exp(0.0001, 0.62));
  thud(bus, 0, 0.22);
}];

VOICES["arcade-ride-start"] = [0.72, (bus) => {
  sweep(bus, "bandpass", 300, 2_600, 0, 0.6, 0.08);
  BLOOM_HZ.forEach((hz, i) => tone(bus, "sine", hz, 0.05 + i * 0.06, 0.5, 0.06));
}];

VOICES["arcade-ride-crash"] = [0.7, (bus) => {
  thud(bus, 0, 0.26);
  TUMBLE_HZ.forEach((hz, i) => tone(bus, "sine", hz, 0.04 + i * 0.07, 0.3, 0.07));
  sweep(bus, "lowpass", 2_600, 300, 0, 0.55, 0.06);
}];

for (let steps = 0; steps < MILESTONE_STEPS; steps += 1) {
  VOICES[`arcade-milestone-${steps}`] = [0.12, (bus) => {
    const hz = MILESTONE_BASE_HZ * 2 ** (steps / 12);
    tone(bus, "square", hz, 0, 0.09, 0.05);
    tone(bus, "sine", hz * 2, 0.01, 0.07, 0.03);
  }];
}

VOICES["arcade-regain"] = [0.09, (bus) => tone(bus, "triangle", 440, 0, 0.06, 0.05)];

function wav(samples) {
  const pcm = Buffer.alloc(44 + samples.length * 2);
  for (let i = 0; i < samples.length; i += 1) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    pcm.writeInt16LE(Math.round(s * 32_767), 44 + i * 2);
  }
  pcm.write("RIFF", 0);
  pcm.writeUInt32LE(36 + samples.length * 2, 4);
  pcm.write("WAVEfmt ", 8);
  pcm.writeUInt32LE(16, 16);
  pcm.writeUInt16LE(1, 20);
  pcm.writeUInt16LE(1, 22);
  pcm.writeUInt32LE(RATE, 24);
  pcm.writeUInt32LE(RATE * 2, 28);
  pcm.writeUInt16LE(2, 32);
  pcm.writeUInt16LE(16, 34);
  pcm.write("data", 36);
  pcm.writeUInt32LE(samples.length * 2, 40);
  return pcm;
}

// Levels are web's own (the app's player applies web's 0.6 × the effects slider on top), so nothing is normalised.
for (const [name, [seconds, render]] of Object.entries(VOICES)) {
  const bus = new Float64Array(Math.round(seconds * RATE));
  render(bus);
  const peak = bus.reduce((max, v) => Math.max(max, Math.abs(v)), 0);
  writeFileSync(join(OUT_DIR, `${name}.wav`), wav(bus));
  console.log(`${name}.wav  ${seconds.toFixed(2)} s  peak ${peak.toFixed(3)}`);
}
