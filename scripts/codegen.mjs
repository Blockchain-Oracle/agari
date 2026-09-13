#!/usr/bin/env node
// Generates the Codama kit client for every Anchor program IDL (plan §6 Clients).
// Run: pnpm codegen   (after `pnpm anchor:build`)
// Reads anchor/target/idl/<program>.json and writes packages/clients/<program>/src/generated.
// Until S2 builds the first program there are no IDLs, and this exits cleanly. S2 adds the Codama
// packages (codama, @codama/nodes-from-anchor, @codama/renderers-js) after checking their docs in Context7.

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const IDL_DIR = "anchor/target/idl";
const idls = existsSync(IDL_DIR) ? readdirSync(IDL_DIR).filter((f) => f.endsWith(".json")) : [];

if (idls.length === 0) {
  console.log("codegen: no program IDLs yet (anchor/target/idl is empty); nothing to generate.");
  process.exit(0);
}

const [{ createFromRoot }, { rootNodeFromAnchor }, { renderVisitor }] = await Promise.all([
  import("codama"),
  import("@codama/nodes-from-anchor"),
  import("@codama/renderers-js"),
]);
const { readFileSync } = await import("node:fs");

for (const file of idls) {
  const program = file.replace(/\.json$/, "").replaceAll("_", "-");
  const idl = JSON.parse(readFileSync(join(IDL_DIR, file), "utf8"));
  const out = join("packages", "clients", program, "src", "generated");
  createFromRoot(rootNodeFromAnchor(idl)).accept(renderVisitor(out));
  console.log(`codegen: ${file} -> ${out}`);
}
