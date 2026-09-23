#!/usr/bin/env node
/** Render real, timestamped Computer Use frames as masked, captioned walkthroughs. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { maskAccount } from './process-connected-captures.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'public/videos');
const rawRoot = resolve(root, 'evidence/raw-video');
const clips = {
  'connected-basket-ticket': {
    raw: 'basket-ticket', route: '/baskets → /markets',
    chapters: [
      { frame: 0, title: 'Choose a basket', text: 'The connected AI Labs basket shows its index in points. Predict opens a devnet Window; Cover needs two member tokens in this wallet; Hold starts a separate desk draft.', focus: [480, 460], zoom: 1 },
      { frame: 15, title: 'Open the live Window', text: 'Predict opens the AI Labs 24/7 Window. Read the opening line, remaining time and price source before choosing a side.', focus: [565, 450], zoom: 1 },
      { frame: 42, title: 'Choose Down', text: 'Down is selected in the ticket. This is only a choice on the page; no order has been sent.', focus: [850, 410], zoom: 1.13, pointer: [983, 304] },
      { frame: 55, title: 'Preview a quote', text: 'Enter 5 tUSDC and compare current cost, return and maximum loss. The recording stops before Buy and before any wallet signature.', focus: [850, 510], zoom: 1.18, pointer: [868, 572] },
    ],
  },
  'connected-portfolio': {
    raw: 'portfolio', route: '/portfolio',
    chapters: [
      { frame: 0, title: 'Read the balances', text: 'The connected Portfolio separates ready-to-bet tUSDC from the Private balance held elsewhere.', focus: [565, 400], zoom: 1 },
      { frame: 11, title: 'Open Trading Balance', text: 'Expand Trading Balance to see wallet funds, available balance, grants and deposit or withdraw controls. No funds move in this recording.', focus: [565, 525], zoom: 1.1, pointer: [542, 610] },
      { frame: 34, title: 'Open History', text: 'History shows settled results and receipt links. A win marked Paid automatically needs no manual claim.', focus: [565, 525], zoom: 1.1, pointer: [829, 405] },
    ],
  },
  'connected-practice-desk': {
    raw: 'desk', route: '/desk',
    chapters: [
      { frame: 0, title: 'Read a practice desk', text: 'The connected Frontier AI desk shows a paper value chart and its next real-price check. Practice spends no money.', focus: [565, 440], zoom: 1 },
      { frame: 18, title: 'Inspect Activity', text: 'Each check has a reason and opens a full decision record. These paper records are not on-chain seals.', focus: [565, 530], zoom: 1.1, pointer: [377, 396] },
      { frame: 45, title: 'Inspect Rules', text: 'Rule cards say which limits the future on-chain program enforces and which the desk runner enforces.', focus: [565, 530], zoom: 1.1, pointer: [497, 396] },
      { frame: 65, title: 'Read the promise', text: 'The promise copy currently describes live on-chain sealing even on this practice page. Practice itself has no chain transaction; this mismatch is reported.', focus: [565, 450], zoom: 1.1, pointer: [481, 438] },
    ],
  },
};

function clock(seconds) {
  const hour = Math.floor(seconds / 3600), minute = Math.floor(seconds % 3600 / 60), second = Math.floor(seconds % 60), milli = Math.round((seconds % 1) * 1000);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}.${String(milli).padStart(3, '0')}`;
}
function escapeXml(s) { return String(s).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&apos;', '"': '&quot;' })[c]); }

await mkdir(out, { recursive: true });
for (const [name, config] of Object.entries(clips)) {
  const sourceDir = resolve(rawRoot, config.raw);
  const record = JSON.parse(await readFile(resolve(sourceDir, 'frames.json'), 'utf8'));
  const renderDir = resolve(sourceDir, 'rendered');
  await mkdir(renderDir, { recursive: true });
  const concat = ['ffconcat version 1.0'];
  for (let index = 0; index < record.frames.length; index++) {
    const frame = record.frames[index];
    const chapter = [...config.chapters].reverse().find(item => item.frame <= index);
    const zoom = chapter.zoom;
    const cropW = Math.round(1130 / zoom), cropH = Math.round(798 / zoom);
    const left = Math.max(0, Math.min(1130 - cropW, Math.round(chapter.focus[0] - cropW / 2)));
    const top = Math.max(0, Math.min(798 - cropH, Math.round(chapter.focus[1] - cropH / 2)));
    const screenshot = await maskAccount(await readFile(resolve(sourceDir, frame.file)));
    const view = sharp(screenshot).extract({ left, top, width: cropW, height: cropH }).resize(1130, 798);
    const pointer = chapter.pointer && index < chapter.frame + 15;
    const position = pointer ? [(chapter.pointer[0] - left) * 1130 / cropW, (chapter.pointer[1] - top) * 798 / cropH] : null;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1130" height="798"><rect x="20" y="135" width="${Math.min(650, chapter.title.length * 17 + 225)}" height="46" rx="9" fill="#171714" fill-opacity=".84"/><text x="35" y="164" fill="#fffaf2" font-family="Arial,sans-serif" font-size="18" font-weight="700">${escapeXml(chapter.title)}</text><text x="1092" y="164" fill="#c23f1c" text-anchor="end" font-family="Arial,sans-serif" font-size="12" font-weight="700">AGARI · CONNECTED</text>${position ? `<circle cx="${position[0]}" cy="${position[1]}" r="26" fill="none" stroke="#fffaf2" stroke-width="8"/><circle cx="${position[0]}" cy="${position[1]}" r="26" fill="none" stroke="#c23f1c" stroke-width="4"/>` : ''}</svg>`;
    const rendered = resolve(renderDir, `${String(index).padStart(4, '0')}.jpg`);
    await view.composite([{ input: Buffer.from(svg) }]).jpeg({ quality: 88, mozjpeg: true }).toFile(rendered);
    const next = record.frames[index + 1];
    const duration = next ? Math.max(0.07, (next.ms - frame.ms) / 1000) : 0.25;
    concat.push(`file '${rendered}'`, `duration ${duration.toFixed(3)}`);
  }
  const concatPath = resolve(renderDir, 'frames.ffconcat');
  await writeFile(concatPath, `${concat.join('\n')}\n`);
  const movie = resolve(out, `${name}-2026-09-23.mp4`);
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', concatPath, '-vf', 'fps=12,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '22', '-movflags', '+faststart', movie]);
  const cues = config.chapters.map((item, index) => {
    const start = record.frames[item.frame].ms / 1000;
    const end = index + 1 < config.chapters.length ? record.frames[config.chapters[index + 1].frame].ms / 1000 : record.frames.at(-1).ms / 1000 + 0.25;
    return `${index + 1}\n${clock(start)} --> ${clock(end)}\n${item.title}. ${item.text}\n`;
  });
  await writeFile(resolve(out, `${name}-2026-09-23.vtt`), `WEBVTT\n\n${cues.join('\n')}`);
  await writeFile(resolve(out, `${name}-2026-09-23.json`), JSON.stringify({ source: record.source, route: config.route, capturedAt: record.capturedAt, frameCount: record.frames.length, durationMs: record.frames.at(-1).ms, method: 'Real Computer Use browser screenshots sampled with timestamps; account label masked; chapter labels, detail zoom and pointer rings added as separate layers; no transaction submitted.', chapters: config.chapters.map((chapter) => ({ title: chapter.title, atMs: record.frames[chapter.frame].ms })) }, null, 2) + '\n');
  console.log(`${name}: ${record.frames.length} real frames, ${(record.frames.at(-1).ms / 1000).toFixed(1)}s`);
}
