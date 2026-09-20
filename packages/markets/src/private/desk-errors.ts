/** The first line only: an RPC error's message can carry the endpoint and request body, which anonymous callers never see. */
export function publicReason(technical: string): string {
  return technical.split("\n")[0]?.trim() || "the desk could not complete this";
}

/** A send whose landing is not known: the request timed out or was aborted before a confirmation came back. */
export function isUnknownLanding(error: unknown): boolean {
  for (let e: unknown = error, depth = 0; e instanceof Error && depth < 8; e = e.cause, depth += 1) {
    if (e.name === "TimeoutError" || e.name === "AbortError" || /timed? ?out|aborted/i.test(e.message)) return true;
  }
  return false;
}

function textOf(error: unknown): string {
  const parts: string[] = [];
  for (let e: unknown = error, depth = 0; e instanceof Error && depth < 8; e = e.cause, depth += 1) parts.push(e.message);
  return parts.length > 0 ? parts.join("\n") : String(error);
}

/**
 * What the chain said, in the program's own words: `BelowMinQuantity (6022): the book fills fewer contracts than the
 * owner's guard`. A refused send's first line is the transport's boilerplate about a failed simulation, which tells an
 * owner nothing; the Anchor log line underneath it is the reason. Falls back to the first line when no program spoke.
 */
export function refusalTechnical(error: unknown): string {
  const text = textOf(error);
  const anchor = /Error Code: (\w+)\. Error Number: (\d+)\. Error Message: ([^\n]*?)\.?\s*$/m.exec(text);
  return anchor ? `${anchor[1]} (${anchor[2]}): ${anchor[3]}` : publicReason(text);
}

/** The program's own error name out of a refused send (`Error Code: BelowMinQuantity`), or null when the chain named none. */
export function refusalName(error: unknown): string | null {
  return /Error Code: (\w+)/.exec(textOf(error))?.[1] ?? null;
}

export function refusalWords(name: string | null): string {
  switch (name) {
    case "BelowMinQuantity":
      return "The book moved under your quote. Your stake is back in your private balance. Quote again.";
    case "NothingFilled":
      return "Nobody is on the other side at this size right now. Your stake is back in your private balance.";
    case "WindowNotTrading":
    case "TooLate":
    case "WindowPredatesDesk":
      return "That Window is no longer taking private entries. Your stake is back in your private balance.";
    case "StakeOutsideBand":
      return "That stake is outside what private bets allow. Your stake is back in your private balance.";
    default:
      return "The desk could not place this bet. Your stake is back in your private balance.";
  }
}
