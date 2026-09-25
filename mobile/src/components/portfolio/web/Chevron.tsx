import Svg, { Path } from "react-native-svg";

/** web `plate/Chevron`: a drawn caret, 10 × 10, stroke 1.8. */
export function Chevron({ size = 10, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 10 10" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3.5 1.5L7 5L3.5 8.5" />
    </Svg>
  );
}
