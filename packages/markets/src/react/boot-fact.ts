/** The boot facts a read can depend on. Its own module so the context can name them without importing hooks. */
export const BOOT_FACTS = ["clock", "collateral", "venue"] as const;
export type BootFact = (typeof BOOT_FACTS)[number];
