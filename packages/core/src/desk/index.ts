/**
 * `@agari/core/desk` (S21, D-126): the desk's pure arithmetic, schemas and words. The ops runner (C4), the web (C5) and
 * the markets desk layer (C3) import from here; nothing here touches the chain, the network or a clock.
 */
export * from "./banned-words";
export * from "./copy";
export * from "./deferral";
export * from "./gate";
export * from "./grade";
export * from "./hashing";
export * from "./mandate";
export * from "./market";
export * from "./needs";
export * from "./paper";
export * from "./plan";
export * from "./pregate";
export * from "./presets";
export * from "./prompt";
export * from "./record";
export * from "./record-schema";
export * from "./scaled-amount";
export * from "./signed";
export * from "./timing";
export * from "./units";
export * from "./valuation";
