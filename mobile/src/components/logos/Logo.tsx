import { Image } from "expo-image";
import { useTheme } from "~/theme";
import { BRAND_LOGOS, type BrandLogo } from "./brand-logos";

/** A brand's own mark at `size`, in the variant that reads on the current theme. */
export function Logo({ brand, size, radius = 0 }: { brand: BrandLogo; size: number; radius?: number }) {
  const { name } = useTheme();
  return <Image source={BRAND_LOGOS[brand][name]} style={{ width: size, height: size, borderRadius: radius }} contentFit="contain" accessible={false} />;
}
