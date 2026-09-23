import Svg, { Circle, Path } from "react-native-svg";
import { useTheme } from "@/theme";

/** web/src/components/shell/AgariMark.tsx: the crescent (figure, follows the theme) and one vermilion point. */
export function AgariMark({ width = 15, height = 18, figure }: { width?: number; height?: number; figure?: string }) {
  const { color } = useTheme();
  return (
    <Svg width={width} height={height} viewBox="0 0 266 322" accessible={false}>
      <Path d="M56 120 A 88 88 0 1 0 210 120" stroke={figure ?? color.ink} fill="none" strokeWidth={34} strokeLinecap="round" />
      <Circle cx={133} cy={62} r={30} fill={color.accent} />
    </Svg>
  );
}
