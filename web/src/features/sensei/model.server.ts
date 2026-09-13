/**
 * Which model answers as Sensei — server only. The resolver moved to `@masayume/brain` so the ops
 * agent runner and this route share one client; Sensei's contract is unchanged.
 */
export { DEFAULT_AI_MODEL, missingCredentialHint, resolveModel, type ResolvedModel } from "@masayume/brain";
