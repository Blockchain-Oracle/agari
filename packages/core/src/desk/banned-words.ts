/**
 * Words the desk never uses (plan §5.1 and PreStocks' own terms). A PreStocks token is a claim on an SPV, never a
 * share of the company, and nothing here may read as a promise of gain.
 *
 * Two lists, because they carry different weight. HARD words make an answer unusable: a promise, or a description that
 * is untrue. If the model writes one, its whole answer is thrown away and the desk does nothing that hour (it fails
 * closed). STYLE words are only the product's voice: a sound judgment is kept and the word is noted in the record.
 *
 * Whole words only: "alpha" must not catch Alphabet, "moon" must not catch "moonshot" (a game on the venue). The same
 * lists run over our own copy in `copy.test.ts`.
 */
const HARD: [RegExp, string][] = [
  [/\bprofit(s|able|ability)?\b/i, "profit"],
  [/\bguarantee[sd]?\b/i, "guaranteed"],
  [/\bbeat(s|ing)? the market\b/i, "beat the market"],
  [/\bshares? of\b/i, 'shares of (a PreStocks token is a claim on an SPV, not a share)'],
  [/\bstock in\b/i, 'stock in (write "a PreStocks token of")'],
  [/\bpre-?ipo stocks?\b/i, 'pre-IPO stock (write "pre-IPO name" or "PreStocks token")'],
];

const STYLE: [RegExp, string][] = [
  [/\balpha\b/i, "alpha"],
  [/\bsignals?\b/i, "signal"],
  [/\bmoon\b/i, "moon"],
  [/\bdegens?\b/i, "degen"],
  [/🚀/u, "rocket emoji"],
];

const BANNED: [RegExp, string][] = [...HARD, ...STYLE];

const find = (list: [RegExp, string][], text: string): string[] => list.filter(([pattern]) => pattern.test(text)).map(([, name]) => name);

/** Every banned word in a text, named once each. Empty means the text is clean. Used on OUR OWN copy. */
export const findBannedWords = (text: string): string[] => find(BANNED, text);

/** Words that make an answer unusable: a promise, or a description we are not allowed to give. */
export const findHardBannedWords = (text: string): string[] => find(HARD, text);

/** Words that are only the product's voice. Worth noting, never worth losing a decision over. */
export const findStyleWords = (text: string): string[] => find(STYLE, text);
