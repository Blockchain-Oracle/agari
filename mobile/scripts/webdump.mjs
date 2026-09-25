// Dumps web's rendered phone layout as an indented tree of computed styles — the fidelity source for native ports.
// usage: node mobile/scripts/webdump.mjs <url> [dark|light] [rootSelector=main] [--shot out.png] [--wait ms]
// Each line: tag.class "text" [x,y w×h] then only the properties that differ from the parent (inherited noise dropped).
import { spawn } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const shot = flag("--shot");
const wait = Number(flag("--wait") ?? 7000);
const [url, theme = "dark", root = "main"] = args;
if (!url) { console.error("usage: webdump.mjs <url> [dark|light] [rootSelector] [--shot out.png] [--wait ms]"); process.exit(1); }

const port = 9200 + Math.floor(Math.random() * 600);
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=/tmp/webdump-${port}`, "--no-first-run", "--hide-scrollbars"], { stdio: "ignore", detached: true });
// Chrome's helpers outlive a kill of the main process; its whole group goes on every exit, and a hung page ends the run.
const reap = () => { try { process.kill(-chrome.pid, "SIGKILL"); } catch {} rmSync(`/tmp/webdump-${port}`, { recursive: true, force: true }); };
process.on("exit", reap);
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => process.exit(1));
setTimeout(() => { console.error("webdump: timed out"); process.exit(1); }, 60_000 + wait).unref();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
for (let i = 0; i < 60 && !ws; i++) {
  try { ws = (await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json()).webSocketDebuggerUrl; } catch { await sleep(200); }
}
const sock = new WebSocket(ws);
await new Promise((r) => sock.addEventListener("open", r));
let id = 0; const pending = new Map();
sock.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); sock.send(JSON.stringify({ id: i, method, params })); });

await send("Emulation.setDeviceMetricsOverride", { width: 402, height: 874, deviceScaleFactor: 2, mobile: true });
await send("Emulation.setTouchEmulationEnabled", { enabled: true });
await send("Page.navigate", { url }); await sleep(2500);
await send("Runtime.evaluate", { expression: `localStorage.setItem('agari_theme','${theme}');localStorage.setItem('agari.tutorialSeen','1')` });
await send("Page.navigate", { url }); await sleep(wait);

const PROPS = ["display", "flex-direction", "align-items", "justify-content", "flex-wrap", "gap", "position", "width", "height", "padding", "margin",
  "background-color", "background-image", "color", "border-top", "border-right", "border-bottom", "border-left", "border-radius", "box-shadow", "opacity",
  "font-family", "font-size", "font-weight", "font-style", "line-height", "letter-spacing", "text-transform", "text-align", "text-decoration-line", "overflow", "transform"];
const INHERITED = new Set(["color", "font-family", "font-size", "font-weight", "font-style", "line-height", "letter-spacing", "text-transform", "text-align"]);
const SKIP = new Set(["none", "normal", "auto", "0px", "static", "rgba(0, 0, 0, 0)", "visible", "row", "nowrap", "stretch", "start", "flex-start", "1", "0px none rgb(0, 0, 0)"]);

const expr = `(() => {
  const PROPS = ${JSON.stringify(PROPS)}, INH = new Set(${JSON.stringify([...INHERITED])}), SKIP = new Set(${JSON.stringify([...SKIP])});
  const out = [];
  const walk = (el, depth, parentCs) => {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(" ").trim();
    const cls = typeof el.className === "string" ? el.className.trim().split(/\\s+/).filter(Boolean).slice(0, 3).join(".") : "";
    const diffs = [];
    for (const p of PROPS) {
      const v = cs.getPropertyValue(p);
      if (INH.has(p) ? (parentCs && parentCs.getPropertyValue(p) === v) : SKIP.has(v)) continue;
      if (p.startsWith("border-") && p !== "border-radius" && /^0px/.test(v)) continue;
      if ((p === "width" || p === "height") ) continue;
      diffs.push(p + ":" + v);
    }
    const tag = el.tagName.toLowerCase();
    const label = tag === "svg" ? "svg" : tag + (cls ? "." + cls : "");
    out.push("  ".repeat(depth) + label + (own ? ' "' + own.slice(0, 70) + '"' : "") + " [" + [r.x, r.y + scrollY, r.width, r.height].map((n) => Math.round(n)).join(",") + "] " + diffs.join("; "));
    if (tag === "svg") return;
    for (const c of el.children) walk(c, depth + 1, cs);
  };
  const rootEl = document.querySelector(${JSON.stringify(root)});
  if (!rootEl) return "no element matches " + ${JSON.stringify(root)};
  walk(rootEl, 0, rootEl.parentElement ? getComputedStyle(rootEl.parentElement) : null);
  return out.join("\\n");
})()`;
const res = await send("Runtime.evaluate", { expression: expr, returnByValue: true });
console.log(res.result.result.value);
if (shot) {
  const img = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  writeFileSync(shot, Buffer.from(img.result.data, "base64"));
}
sock.close(); process.exit(0);
