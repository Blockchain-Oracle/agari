import type { ImageSource } from "expo-image";

/**
 * Real brand marks, never a generic icon where a brand is named: wallets from web's vendored set (public/wallet),
 * everything else from the 21st logo catalogue (svgl). Each brand has a mark per theme where its ink flips.
 */
export type BrandLogo = "x" | "phantom" | "solflare" | "backpack";

export const BRAND_LOGOS: Record<BrandLogo, { light: ImageSource; dark: ImageSource }> = {
  x: { light: require("../../../assets/logos/x.svg"), dark: require("../../../assets/logos/x_dark.svg") },
  phantom: { light: require("../../../assets/logos/phantom.svg"), dark: require("../../../assets/logos/phantom.svg") },
  solflare: { light: require("../../../assets/logos/solflare.svg"), dark: require("../../../assets/logos/solflare.svg") },
  backpack: { light: require("../../../assets/logos/backpack.png"), dark: require("../../../assets/logos/backpack.png") },
};
