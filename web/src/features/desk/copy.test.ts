import { findHardBannedWords } from "@agari/core/desk";
import { describe, expect, it } from "vitest";
import { BASKETS, DESK_NEVER, DESK_PROGRAM_ENFORCES, DESK_STEPS } from "../how-it-works/content";
import { HOW_IT_WORKS } from "../how-it-works/copy";
import { CONTROLS, DESK_ERRORS_UI, GO_LIVE, MONEY } from "./copy-controls";
import { DESK, DESK_ADVICE } from "./copy";
import { RECORD } from "./copy-record";

/** Sample arguments so every copy function is exercised; the words under test are the template's, not the sample's. */
const SAMPLE: unknown[] = ["OpenAI", "$50", 6, 4, "1.4%", "buy", "OpenAI", "$1,000"];

function* strings(value: unknown, path: string): Generator<[string, string]> {
  if (typeof value === "string") yield [path, value];
  else if (typeof value === "function") {
    const out = (value as (...args: unknown[]) => unknown)(...SAMPLE);
    yield* strings(out, `${path}()`);
  } else if (Array.isArray(value)) for (const [i, v] of value.entries()) yield* strings(v, `${path}[${i}]`);
  else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) yield* strings(v, `${path}.${k}`);
}

/** The words the plan bans on these screens beyond core's hard list (§5.1): "hedge", "exposure", "tokenized stocks", rockets. */
const SCREEN_BANNED: [RegExp, string][] = [
  [/\bhedg(e|es|ed|ing)\b/i, "hedge"],
  [/\bexposure\b/i, "exposure"],
  [/\btokeni[sz]ed stocks?\b/i, "tokenized stock"],
  [/🚀/u, "rocket"],
  [/\bguaranteed?\b/i, "guaranteed"],
];

describe("desk copy", () => {
  it("uses none of the hard banned words and none of the plan's screen words", () => {
    const offenders: string[] = [];
    const howItWorks = { BASKETS, DESK_STEPS, DESK_PROGRAM_ENFORCES, DESK_NEVER, lead: HOW_IT_WORKS.deskLead, kinds: HOW_IT_WORKS.deskKinds, network: HOW_IT_WORKS.deskNetwork };
    for (const table of [DESK, CONTROLS, MONEY, GO_LIVE, DESK_ERRORS_UI, RECORD, { advice: DESK_ADVICE }, howItWorks]) {
      for (const [path, text] of strings(table, "")) {
        for (const word of findHardBannedWords(text)) offenders.push(`${path}: ${word}`);
        for (const [pattern, name] of SCREEN_BANNED) if (pattern.test(text)) offenders.push(`${path}: ${name}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
