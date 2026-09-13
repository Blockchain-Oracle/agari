import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { finding } from "./report.mjs";
import { walkFiles } from "./walk.mjs";

const FOREIGN_LOCKFILES = ["package-lock.json", "npm-shrinkwrap.json", "yarn.lock", "bun.lock", "bun.lockb"];

/** pnpm is the only package manager (user preference): root pin, no foreign lockfiles, Anchor uses pnpm. */
export function pnpmOnly(rule, ctx) {
  const findings = [];
  const pkg = JSON.parse(readFileSync(join(ctx.root, "package.json"), "utf8"));
  if (!String(pkg.packageManager ?? "").startsWith("pnpm@")) {
    findings.push(finding(rule, `root packageManager must be pnpm@…, got ${pkg.packageManager ?? "none"}`, "package.json"));
  }
  for (const { rel } of walkFiles(ctx.root, ".", FOREIGN_LOCKFILES)) {
    findings.push(finding(rule, "non-pnpm lockfile", rel));
  }
  const anchorToml = join(ctx.root, "anchor/Anchor.toml");
  if (existsSync(anchorToml) && !/^\s*package_manager\s*=\s*"pnpm"/m.test(readFileSync(anchorToml, "utf8"))) {
    findings.push(finding(rule, 'Anchor.toml [toolchain] must set package_manager = "pnpm"', "anchor/Anchor.toml"));
  }
  return findings;
}
