#!/usr/bin/env node
/** Rebuild public, account-masked guide images from local Computer Use captures. */
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const raw = resolve(root, 'evidence/raw-captures');
const output = resolve(root, 'public/captures');
const captures = {
  'wallet-funds-connected': 'chrome-funding-dialog.png',
  'portfolio-connected': 'chrome-portfolio-connected.png',
  'portfolio-balance-connected': 'chrome-balance-open-full.png',
  'portfolio-history-connected': 'chrome-portfolio-history.png',
  'baskets-connected': 'chrome-baskets-cards.png',
  'basket-quote-connected': 'chrome-basket-quote.png',
  'desk-overview-connected': 'chrome-desk-overview.png',
  'desk-activity-connected': 'chrome-desk-activity.png',
  'desk-rules-connected': 'chrome-desk-rules.png',
  'earn-maker-connected': 'chrome-earn-connected.png',
  'earn-range-connected': 'chrome-earn-range.png',
  'strategies-connected': 'chrome-copy-catalogue.png',
  'strategy-copy-connected': 'chrome-copy-drawer.png',
  'short-connected': 'chrome-short-connected.png',
  'proof-feed-connected': 'chrome-proof-feed.png',
  'basket-proof-connected': 'chrome-basket-proof.png',
};

export async function maskAccount(input, { funding = false } = {}) {
  const regions = [{ left: 980, top: 76, width: 128, height: 40 }];
  if (funding) regions.push({ left: 613, top: 231, width: 131, height: 32 });
  const layers = await Promise.all(regions.map(async ({ left, top, width, height }) => ({
    input: await sharp(input).extract({ left, top, width, height }).blur(22).png().toBuffer(),
    left, top,
  })));
  return sharp(input).composite(layers).toBuffer();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await mkdir(output, { recursive: true });
  for (const [name, source] of Object.entries(captures)) {
    const input = await readFile(resolve(raw, source));
    const masked = await maskAccount(input, { funding: name === 'wallet-funds-connected' });
    await sharp(masked).jpeg({ quality: 88, mozjpeg: true }).toFile(resolve(output, `${name}-2026-09-23.jpg`));
    console.log(`${name}: 1130 × 798, account label masked`);
  }
}
