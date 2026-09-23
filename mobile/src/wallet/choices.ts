import { Platform } from "react-native";
import type { BrandLogo } from "~/components/logos/brand-logos";

/** How the app reaches a wallet: its deeplink hand-off (iOS and Android), Mobile Wallet Adapter (Android), or the practice key. */
export type WalletKind = "phantom" | "solflare" | "backpack" | "practice";

export interface WalletChoice {
  kind: WalletKind;
  name: string;
  logo: BrandLogo | null;
  line: string;
}

/** Backpack's deeplinks carry no devnet, so it is offered only where Mobile Wallet Adapter reaches it (Android). */
export const WALLET_CHOICES: readonly WalletChoice[] = [
  { kind: "phantom", name: "Phantom", logo: "phantom", line: "Opens Phantom to approve" },
  { kind: "solflare", name: "Solflare", logo: "solflare", line: "Opens Solflare to approve" },
  ...(Platform.OS === "android" ? [{ kind: "backpack" as const, name: "Backpack", logo: "backpack" as const, line: "Approve in Backpack" }] : []),
  { kind: "practice", name: "Practice wallet", logo: null, line: "Devnet only · kept on this phone" },
];
