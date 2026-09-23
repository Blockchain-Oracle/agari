#!/usr/bin/env node
/** Verify the docs' local contract and the Agari source revision they were reviewed against. */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { legacyRedirects } from '../lib/legacy-redirects.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// The docs live in the app's own repository at docs-site/, so the app source is the parent directory.
const source = resolve(process.env.AGARI_SOURCE_DIR || resolve(root, '..'));
const content = resolve(root, 'content/docs');
// One pin: `site.revision` in lib/site.ts is the app commit every page was last checked against.
const pinned = readFileSync(resolve(root, 'lib/site.ts'), 'utf8').match(/revision:\s*'([0-9a-f]{7,40})'/)?.[1] ?? null;
const appPaths = ['web', 'packages', 'services', 'anchor'];
const failures = [];
const warnings = [];
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
/** An app route exists when each segment matches a folder, a literal one first, else a `[param]` one. */
function appRouteExists(path) {
  let dir = resolve(source, 'web/src/app');
  for (const segment of path.split(/[?#]/)[0].split('/').filter(Boolean)) {
    if (existsSync(resolve(dir, segment))) { dir = resolve(dir, segment); continue; }
    const param = readdirSync(dir, { withFileTypes: true }).find(entry => entry.isDirectory() && /^\[[^.\]]+\]$/.test(entry.name));
    if (!param) return false;
    dir = resolve(dir, param.name);
  }
  return existsSync(resolve(dir, 'page.tsx'));
}

if (!pinned) fail('lib/site.ts has no revision to check against');
else if (!existsSync(resolve(source, 'web/src/app'))) fail(`Agari source missing: ${source}`);
else if (git('cat-file', '-e', `${pinned}^{commit}`) === null) fail(`Pinned revision ${pinned} is not in ${source}'s history`);
else if (git('merge-base', '--is-ancestor', pinned, 'HEAD') === null) fail(`Pinned revision ${pinned} is not an ancestor of HEAD: the docs were reviewed against a different line of history`);
else {
  for (const path of ['packages/core/src/market/baskets.ts', 'packages/core/src/desk/gate.ts', 'anchor/programs/agari-desk/src/lib.rs', 'docs/plan/acceptance.md', 'services/ops/config/price-sources.json']) {
    if (!existsSync(resolve(source, path))) fail(`Source path missing: ${path}`);
  }
  // App changes since the review are a reason to re-read the guides, not a broken build.
  const since = git('log', '--format=%h %s', `${pinned}..HEAD`, '--', ...appPaths)?.split('\n').filter(Boolean) ?? [];
  if (since.length) warnings.push(`${since.length} app commit(s) since the reviewed revision ${pinned}; review them, update the guides, then advance site.revision:`, ...since.slice(0, 15).map(line => `  ${line.slice(0, 120)}`), ...(since.length > 15 ? [`  … and ${since.length - 15} more`] : []));
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
    if (!appRouteExists(route)) fail(`${label}: missing app route ${route}`);
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
for (const item of warnings) console.warn(item.startsWith('  ') ? item : `! ${item}`);
if (failures.length) { for (const item of failures) console.error(`✗ ${item}`); process.exitCode = 1; }
else console.log(`✓ source ${pinned}, navigation, links and media`);
