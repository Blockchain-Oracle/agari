import { isAddress } from "@agari/core/types";

/**
 * The house runner a creator picks with "Let Agari run it". Web reads STRATEGY_RUNNER_ADDRESS on its server
 * (web/src/app/strategies/page.tsx) and no API carries it yet, so the app is configured with the same address at
 * build time; an unset or malformed value leaves only "Run your own bot", exactly as web does.
 */
const configured = process.env.EXPO_PUBLIC_STRATEGY_RUNNER_ADDRESS?.trim() ?? "";

export const HOUSE_RUNNER: string | null = configured && isAddress(configured) ? configured : null;
