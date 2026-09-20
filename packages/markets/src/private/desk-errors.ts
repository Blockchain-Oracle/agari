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

/** The program's own error name out of a refused send (`Error Code: BelowMinQuantity`), or null when the chain named none. */
export function refusalName(error: unknown): string | null {
  const text = error instanceof Error ? `${error.message}\n${error.cause instanceof Error ? error.cause.message : ""}` : String(error);
  return /Error Code: (\w+)/.exec(text)?.[1] ?? null;
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
