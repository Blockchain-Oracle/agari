// Renders web's game music bed (web/src/features/games/bed.ts) to a seamless WAV loop for the app.
//
// Web sequences the bed live on the Web Audio clock; React Native has no oscillators, so the app plays this render of
// the same score instead: the same chords, arpeggio and motif, bass, detuned pad and kit, with the same envelopes and
// filters, computed sample by sample. Notes that ring past the loop's end wrap to its start, so it loops without a seam.
// Run: node mobile/scripts/render-bed.mjs  →  mobile/assets/sounds/bed.wav
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RATE = 32_000;
const BPM = 112;
const STEP_SEC = 60 / BPM / 4;
const STEPS = 8 * 16;
const LEN = Math.round(STEPS * STEP_SEC * RATE);

const CHORDS = [
  { root: 57, third: 3 },
  { root: 53, third: 4 },
  { root: 48, third: 4 },
  { root: 55, third: 4 },
];
const ARP = [0, 1, 2, 1, 0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1];
const MOTIF = [3, null, 2, null, 1, 2, null, 3, null, null, 2, 1, 0, null, 1, null];
const BASS = [0, 12, 0, 12, 0, 12, 7, 12];
const KIT = "kh.hsh.hkh.hshhh";
const midiHz = (note) => 440 * 2 ** ((note - 69) / 12);

const lead = new Float64Array(LEN);
const pad = new Float64Array(LEN);
const dry = new Float64Array(LEN);

// A deterministic noise source, so a re-render is byte-identical.
let seed = 0x2f6b9d1;
const noise = () => ((seed = (seed * 1_664_525 + 1_013_904_223) >>> 0) / 0x1_0000_0000) * 2 - 1;

const wave = {
  square: (p) => (p % 1 < 0.5 ? 1 : -1),
  triangle: (p) => 1 - 4 * Math.abs((p % 1) - 0.5),
  sawtooth: (p) => 2 * (p % 1) - 1,
};

/** bed.ts tone(): 8 ms attack to `gain`, release from 80 % of `dur` with a 12 % time constant, stopped at dur + 50 ms. */
function tone(type, hz, atSec, dur, gain, bus, detuneCents = 0) {
  const f = hz * 2 ** (detuneCents / 1200);
  const start = Math.round(atSec * RATE);
  const n = Math.round((dur + 0.05) * RATE);
  const releaseAt = dur * 0.8;
  const tc = dur * 0.12;
  for (let i = 0; i < n; i += 1) {
    const t = i / RATE;
    let env = t < 0.008 ? (gain * t) / 0.008 : gain;
    if (t > releaseAt) env *= Math.exp(-(t - releaseAt) / tc);
    bus[(start + i) % LEN] += wave[type](f * t) * env;
  }
}

/** RBJ biquad over a whole buffer (the Web Audio BiquadFilterNode's shapes, Q 1). */
function biquad(buffer, type, freq, q = 1) {
  const w = (2 * Math.PI * freq) / RATE;
  const alpha = Math.sin(w) / (2 * q);
  const cos = Math.cos(w);
  let b0, b1, b2;
  if (type === "lowpass") [b0, b1, b2] = [(1 - cos) / 2, 1 - cos, (1 - cos) / 2];
  else if (type === "highpass") [b0, b1, b2] = [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2];
  else [b0, b1, b2] = [alpha, 0, -alpha];
  const a0 = 1 + alpha;
  const a1 = -2 * cos;
  const a2 = 1 - alpha;
  const out = new Float64Array(buffer.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < buffer.length; i += 1) {
    const x = buffer[i];
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    out[i] = y;
    [x2, x1, y2, y1] = [x1, x, y1, y];
  }
  return out;
}

/** bed.ts hit(): the sine kick with its pitch drop, the band-passed snare, the high-passed hats. */
function hit(atSec, kind) {
  const start = Math.round(atSec * RATE);
  if (kind === "k") {
    let phase = 0;
    const n = Math.round(0.2 * RATE);
    for (let i = 0; i < n; i += 1) {
      const t = i / RATE;
      const hz = t < 0.11 ? 150 * (42 / 150) ** (t / 0.11) : 42;
      phase += hz / RATE;
      const env = t < 0.16 ? 0.55 * (0.001 / 0.55) ** (t / 0.16) : 0;
      dry[(start + i) % LEN] += Math.sin(2 * Math.PI * phase) * env;
    }
    return;
  }
  const snare = kind === "s";
  const peak = snare ? 0.32 : kind === "H" ? 0.14 : 0.08;
  const dur = snare ? 0.12 : 0.04;
  const n = Math.round((dur + 0.02) * RATE);
  const burst = biquad(Float64Array.from({ length: n }, noise), snare ? "bandpass" : "highpass", snare ? 1_800 : 7_500);
  for (let i = 0; i < n; i += 1) {
    const t = i / RATE;
    const env = t < dur ? peak * (0.001 / peak) ** (t / dur) : 0;
    dry[(start + i) % LEN] += burst[i] * env;
  }
}

for (let index = 0; index < STEPS; index += 1) {
  const at = index * STEP_SEC;
  const bar = Math.floor(index / 16);
  const sixteenth = index % 16;
  const chord = CHORDS[bar % 4];
  const tones = [chord.root + 12, chord.root + 12 + chord.third, chord.root + 19, chord.root + 24];
  const pick = (bar < 4 ? ARP : MOTIF)[sixteenth];
  if (pick !== null) tone("square", midiHz(tones[pick]), at, STEP_SEC * 0.9, 0.07, lead);
  if (sixteenth % 2 === 0) tone("triangle", midiHz(chord.root - 12 + BASS[sixteenth / 2]), at, STEP_SEC * 1.8, 0.22, dry);
  if (sixteenth === 0) {
    for (const note of [chord.root, chord.root + chord.third, chord.root + 7]) {
      tone("sawtooth", midiHz(note), at, STEP_SEC * 16, 0.028, pad, -6);
      tone("sawtooth", midiHz(note), at, STEP_SEC * 16, 0.028, pad, 6);
    }
  }
  const beat = KIT[sixteenth];
  if (beat !== ".") hit(at, beat);
  if (bar === 7 && sixteenth >= 12 && beat === ".") hit(at, "h");
}

const leadOut = biquad(lead, "lowpass", 3_200);
const padOut = biquad(pad, "lowpass", 900);
const pcm = Buffer.alloc(44 + LEN * 2);
let peak = 0;
for (let i = 0; i < LEN; i += 1) peak = Math.max(peak, Math.abs(leadOut[i] + padOut[i] + dry[i]));
// Only scale down if the mix would clip; the app's player volume sets the level (web's 0.3 × the music slider).
const scale = peak > 0.98 ? 0.98 / peak : 1;
for (let i = 0; i < LEN; i += 1) pcm.writeInt16LE(Math.round((leadOut[i] + padOut[i] + dry[i]) * scale * 32_767), 44 + i * 2);
pcm.write("RIFF", 0);
pcm.writeUInt32LE(36 + LEN * 2, 4);
pcm.write("WAVEfmt ", 8);
pcm.writeUInt32LE(16, 16);
pcm.writeUInt16LE(1, 20);
pcm.writeUInt16LE(1, 22);
pcm.writeUInt32LE(RATE, 24);
pcm.writeUInt32LE(RATE * 2, 28);
pcm.writeUInt16LE(2, 32);
pcm.writeUInt16LE(16, 34);
pcm.write("data", 36);
pcm.writeUInt32LE(LEN * 2, 40);
const out = join(dirname(fileURLToPath(import.meta.url)), "../assets/sounds/bed.wav");
writeFileSync(out, pcm);
console.log(`bed.wav: ${(LEN / RATE).toFixed(3)} s, peak ${peak.toFixed(3)}, scale ${scale.toFixed(3)}`);
