/**
 * The one language-model client the workspace shares (web's Sensei and ops' agent runner): a model
 * resolved from configuration, one structured read per Window, and the decide step that turns a
 * read into a `Decision` through the core's deterministic gate. Nothing here can sign or send.
 */
export const BRAIN_PACKAGE = "@masayume/brain" as const;

export * from "./agent-decide";
export * from "./agent-read";
export * from "./model";
