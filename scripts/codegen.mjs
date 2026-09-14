#!/usr/bin/env node
// Generates the Codama kit client for every Anchor program IDL (plan §6 Clients).
// Run: pnpm codegen   (after `pnpm anchor:build`; gate: `pnpm codegen && git diff --exit-code packages/clients`)
// A fresh build's anchor/target/idl/<program>.json is copied to packages/clients/<program>/idl.json, which is checked in,
// so the client and the published IDL regenerate from the repo alone. Output: packages/clients/<program>/src/generated.

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { rootNodeFromAnchor } from "@codama/nodes-from-anchor";
import { renderVisitor } from "@codama/renderers-js";
import { createFromRoot, updateDefinedTypesVisitor } from "codama";

const BUILD_IDLS = "anchor/target/idl";
const CLIENTS = "packages/clients";

for (const file of existsSync(BUILD_IDLS) ? readdirSync(BUILD_IDLS).filter((f) => f.endsWith(".json")) : []) {
  const program = file.replace(/\.json$/, "").replaceAll("_", "-");
  mkdirSync(join(CLIENTS, program), { recursive: true });
  copyFileSync(join(BUILD_IDLS, file), join(CLIENTS, program, "idl.json"));
}

const programs = readdirSync(CLIENTS).filter((name) => existsSync(join(CLIENTS, name, "idl.json")));
if (programs.length === 0) {
  console.log("codegen: no program IDLs (build with `pnpm anchor:build`); nothing to generate.");
  process.exit(0);
}

/** Codama names every type X's encoder input `XArgs`, so a program type `XArgs` next to `X` collides: render it as `XInput`. */
function argsCollisions(root) {
  const names = new Set(root.program.definedTypes.map((t) => t.name));
  const stems = [...names].filter((n) => n.endsWith("Args") && names.has(n.slice(0, -4)));
  return Object.fromEntries(stems.map((n) => [n, { name: `${n.slice(0, -4)}Input` }]));
}

for (const program of programs) {
  const idl = JSON.parse(readFileSync(join(CLIENTS, program, "idl.json"), "utf8"));
  const generatedFolder = `${program}/src/generated`;
  const codama = createFromRoot(rootNodeFromAnchor(idl));
  codama.update(updateDefinedTypesVisitor(argsCollisions(codama.getRoot())));
  // rootOnly: every import comes from @solana/kit (incl. its program-client-core subpath), the one chain dependency.
  await codama.accept(
    renderVisitor(CLIENTS, { generatedFolder, kitImportStrategy: "rootOnly", syncPackageJson: false }),
  );
  console.log(`codegen: ${program}/idl.json -> ${CLIENTS}/${generatedFolder}`);
}
