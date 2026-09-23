import Svg, { Circle, G, Path } from "react-native-svg";
import { useTheme } from "~/theme";

/** web's TUsdcMark (components/icons/AssetMarks.tsx): USDC's disc, ring and glyph. */
export function TUsdcMark({ size = 20 }: { size?: number }) {
  const { color } = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Circle cx={16} cy={16} r={16} fill={color.markUsdc} />
      <G stroke={color.markGlyph} fill="none" strokeWidth={1.9} strokeLinecap="round">
        <Path d="M12.6 25.4A10 10 0 0 1 12.6 6.6" />
        <Path d="M19.4 6.6A10 10 0 0 1 19.4 25.4" />
      </G>
      <G stroke={color.markGlyph} fill="none" strokeWidth={2} strokeLinecap="round">
        <Path d="M19.4 12.7c-.3-1.6-1.7-2.4-3.4-2.4-2 0-3.4 1-3.4 2.4 0 1.6 1.5 2.1 3.4 2.6 2 .5 3.6 1 3.6 2.8 0 1.5-1.5 2.5-3.6 2.5-1.9 0-3.4-.9-3.6-2.5" />
        <Path d="M16 8.2v2.1M16 20.6v2.4" />
      </G>
    </Svg>
  );
}
