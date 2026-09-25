import type { ReactNode } from "react";
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";

type Props = Omit<PressableProps, "style" | "children"> & {
  style?: StyleProp<ViewStyle> | ((pressed: boolean) => StyleProp<ViewStyle>);
  children?: ReactNode | ((pressed: boolean) => ReactNode);
};

/** games.css press physics: every control under the frame depresses to 0.97 while held. */
export function Press({ style, children, disabled, ...rest }: Props) {
  return (
    <Pressable
      {...rest}
      disabled={disabled}
      style={({ pressed }) => [typeof style === "function" ? style(pressed) : style, pressed && !disabled && { transform: [{ scale: 0.97 }] }]}
    >
      {({ pressed }) => (typeof children === "function" ? children(pressed) : children)}
    </Pressable>
  );
}
