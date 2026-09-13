import type { AttributionHook } from "@masayume/core/ports";

/** Builder-tag hook (AD-11): no-op in v1 so attribution never has to be retrofitted across call sites. */
export const noopAttribution: AttributionHook = () => ({});
