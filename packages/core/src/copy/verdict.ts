export type VerdictOutcome = "win" | "loss" | "void";

export interface VerdictStrings {
  kanji: string;
  romaji: string;
  translation: string;
  /** The subline printed under the stamp. */
  line: string;
}

const VERDICTS: Record<VerdictOutcome, VerdictStrings> = {
  win: { kanji: "上がり", romaji: "agari", translation: "it came in", line: "agari — it came in." },
  loss: { kanji: "放銃", romaji: "hōjū", translation: "dealt in", line: "hōjū — it dealt in." },
  void: { kanji: "無効", romaji: "mukō", translation: "void", line: "no reliable print — both sides pay 0.5" },
};

export function verdictStrings(outcome: VerdictOutcome): VerdictStrings {
  return VERDICTS[outcome];
}

/** The one-time screen-reader announcement for a Verdict; `pnlText` is already signed and formatted. */
export function verdictAnnouncement(outcome: VerdictOutcome, pnlText: string): string {
  switch (outcome) {
    case "win":
      return `Agari — it came in. Won ${pnlText}.`;
    case "loss":
      return `Hōjū — it dealt in. Lost ${pnlText}.`;
    case "void":
      return `Void — no reliable print, both sides pay 0.5. Returned ${pnlText}.`;
  }
}
