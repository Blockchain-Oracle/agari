import { Platform } from "react-native";
import type { BrandLogo } from "~/components/logos/brand-logos";

/** App links on both platforms, Android's wallet chooser, or a device-local practice key. */
export type WalletKind = "phantom" | "solflare" | "mwa" | "practice";

export interface WalletChoice {
  kind: WalletKind;
  name: string;
  logo: BrandLogo | null;
  line: string;
}

export const WALLET_CHOICES: readonly WalletChoice[] = [
  { kind: "phantom", name: "Phantom", logo: "phantom", line: "Opens Phantom to approve" },
  { kind: "solflare", name: "Solflare", logo: "solflare", line: "Opens Solflare to approve" },
  ...(Platform.OS === "android" ? [{ kind: "mwa" as const, name: "Android wallet", logo: null, line: "Choose an installed Solana wallet" }] : []),
  { kind: "practice", name: "Practice wallet", logo: null, line: "Devnet only · kept on this phone" },
];
