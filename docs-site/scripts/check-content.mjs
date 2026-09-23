#!/usr/bin/env node
/** Verify the docs' local contract and the reviewed Agari source revision. */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { legacyRedirects } from '../lib/legacy-redirects.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(process.env.AGARI_SOURCE_DIR || resolve(root, '../agari-wt/w1'));
const content = resolve(root, 'content/docs');
const expected = 'c412501';
const failures = [];
let pages = 0, links = 0, media = 0, appRoutes = 0;

function fail(message) { failures.push(message); }
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(resolve(dir, entry.name)) : [resolve(dir, entry.name)]);
}
function git(...args) {
  try { return execFileSync('git', ['-C', source, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return null; }
}
function docRoute(path) {
  const route = path.split('#')[0].replace(/\/$/, '') || '/';
  if (route === '/') return resolve(content, 'index.mdx');
  return resolve(content, `${route.slice(1)}.mdx`);
}
function appRoute(path) {
  return resolve(source, 'web/src/app', path.slice(1), 'page.tsx');
}

if (!existsSync(source)) fail(`Agari checkout missing: ${source}`);
else {
  const branch = git('branch', '--show-current');
  const head = git('rev-parse', '--short=7', 'HEAD');
  if (branch !== 'integration/w1') fail(`Expected integration/w1, got ${branch ?? 'unknown'}`);
  if (head !== expected) fail(`Source moved: expected ${expected}, found ${head ?? 'unknown'}. Review changes and update the docs before changing this pin.`);
  for (const path of ['packages/core/src/market/baskets.ts', 'packages/core/src/desk/gate.ts', 'anchor/programs/agari-desk/src/lib.rs', 'docs/plan/acceptance.md']) {
    if (!existsSync(resolve(source, path))) fail(`Source path missing: ${path}`);
  }
}

const mdx = files(content).filter(path => path.endsWith('.mdx'));
const redirectSources = new Set();
for (const [from, to] of legacyRedirects) {
  if (redirectSources.has(from)) fail(`Duplicate redirect source: ${from}`);
  redirectSources.add(from);
  if (existsSync(docRoute(from))) fail(`Redirect shadows a docs page: ${from}`);
  if (!existsSync(docRoute(to))) fail(`Redirect destination missing: ${from} → ${to}`);
}
for (const [, to] of legacyRedirects) if (redirectSources.has(to)) fail(`Redirect chain: ${to}`);
for (const path of mdx) {
  pages++;
  const body = readFileSync(path, 'utf8');
  const label = relative(root, path);
  for (const [, route] of body.matchAll(/\]\((\/[^)\s]+)\)/g)) {
    links++;
    if (route.startsWith('/captures/') || route.startsWith('/videos/')) {
      media++;
      if (!existsSync(resolve(root, 'public', route.slice(1)))) fail(`${label}: missing media ${route}`);
    } else if (!existsSync(docRoute(route))) fail(`${label}: missing docs page ${route}`);
  }
  for (const [, route] of body.matchAll(/<AppLink\s+href="(\/[^"]+)"/g)) {
    appRoutes++;
    if (!existsSync(appRoute(route))) fail(`${label}: missing app route ${route}`);
  }
  for (const [, name] of body.matchAll(/<GuideCapture\s+name="([^"]+)"/g)) {
    media++;
    if (!['markets', 'phone', 'portfolio', 'baskets', 'studio', 'limits', 'testRead'].includes(name)) fail(`${label}: unknown capture ${name}`);
  }
}

for (const path of files(content).filter(path => path.endsWith('meta.json'))) {
  const label = relative(root, path);
  let meta;
  try { meta = JSON.parse(readFileSync(path, 'utf8')); }
  catch { fail(`${label}: invalid JSON`); continue; }
  for (const page of meta.pages || []) {
    if (page.startsWith('---')) continue;
    const target = resolve(dirname(path), page);
    if (!existsSync(`${target}.mdx`) && !existsSync(resolve(target, 'meta.json'))) fail(`${label}: missing nav entry ${page}`);
  }
}

const captures = JSON.parse(readFileSync(resolve(root, 'public/captures/provenance-2026-09-23.json'), 'utf8'));
for (const { file } of captures.captures) {
  media++;
  if (!existsSync(resolve(root, 'public/captures', file))) fail(`Missing capture ${file}`);
}
for (const path of [captures.video.file, captures.video.captions]) {
  media++;
  if (!existsSync(resolve(root, 'public/captures', path))) fail(`Missing tour asset ${path}`);
}

console.log(`Content: ${pages} pages, ${links} docs links, ${appRoutes} app links, ${media} media references, ${legacyRedirects.length} redirects`);
if (failures.length) { for (const item of failures) console.error(`✗ ${item}`); process.exitCode = 1; }
else console.log(`✓ source ${expected}, navigation, links and media`);
