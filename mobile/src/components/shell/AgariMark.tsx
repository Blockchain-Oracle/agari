import Svg, { Path } from "react-native-svg";
import { useTheme } from "~/theme";

/** Window Cut uses the exact paths in brand/agari-mark.svg, with theme-aware window ink. */
export function AgariMark({ width = 18, height = 18, figure }: { width?: number; height?: number; figure?: string }) {
  const { color } = useTheme();
  return (
    <Svg width={width} height={height} viewBox="0 0 220 220" accessible={false}>
      <Path d="M0 0H151L183 32V61H139V44H44V176H176V82H220V220H0Z" fill={figure ?? color.ink} />
      <Path d="M173 0H220V47Z" fill={color.brandMarkAccent} />
    </Svg>
  );
}
