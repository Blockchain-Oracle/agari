import { HStack, Image, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import { activityBackgroundTint, clipShape, font, foregroundStyle, frame, monospacedDigit, multilineTextAlignment, padding, resizable } from "@expo/ui/swift-ui/modifiers";
import { createLiveActivity, type LiveActivityEnvironment } from "expo-widgets";

/** The ink a Live Activity draws with, one set per scheme (from the app's theme, never literals here). */
export interface ActivityInk {
  /** The page ground the ink is drawn on: the banner and widget paint it, so the ink always has its own ground. */
  ground: string;
  ink: string;
  muted: string;
  profit: string;
  loss: string;
  accent: string;
}

/**
 * Everything the Lock Screen and Dynamic Island show for one open bet, already worded by the app: the widget runtime
 * has no app state, no imports and no formatting helpers, so the props carry finished strings plus the close time.
 */
export interface WindowActivityProps {
  asset: string;
  /** The stock's own mark in the app group (`file://…png`), or "". */
  mark: string;
  /** "Up" or "Down". */
  side: string;
  up: boolean;
  /** "$16.12" — what the call pays if it lands. */
  payout: string;
  /** "Line $412.30", or "Opening print pending". */
  strike: string;
  /** The last price the app saw, or "". */
  price: string;
  /** "ahead" | "behind" | "level" | "" — this call against the strike right now. */
  standing: string;
  /** Epoch ms the Window closes; the timer counts down natively with no updates. */
  closesAtMs: number;
  /** Set once the Window is decided: "Won $16.12", "Lost", "Void — stake back". */
  result: string;
  /** "win" | "loss" | "void" | "" */
  resultTone: string;
  dark: ActivityInk;
  light: ActivityInk;
}

const WindowActivity = (props: WindowActivityProps, environment: LiveActivityEnvironment) => {
  "widget";
  // The Lock Screen banner follows the system scheme; the Dynamic Island is always black, so it always takes dark ink.
  const c = environment.colorScheme === "dark" ? props.dark : props.light;
  const d = props.dark;
  const sideColor = props.up ? c.profit : c.loss;
  const islandSide = props.up ? d.profit : d.loss;
  const arrow = props.up ? "arrowtriangle.up.fill" : "arrowtriangle.down.fill";
  const done = props.result !== "";
  const toneOf = (ink: ActivityInk, tone: string) => (tone === "win" || tone === "ahead" ? ink.profit : tone === "loss" || tone === "behind" ? ink.loss : ink.muted);
  const resultColor = toneOf(c, props.resultTone);
  const standingColor = toneOf(c, props.standing);
  const islandResult = toneOf(d, props.resultTone);
  const islandStanding = toneOf(d, props.standing);
  const standingWord = props.standing === "ahead" ? "Winning now" : props.standing === "behind" ? "Losing now" : props.standing === "level" ? "Level" : "";
  const now = new Date();
  const closes = new Date(props.closesAtMs);
  const range = { lower: now < closes ? now : closes, upper: closes };
  const clockIn = (ink: ActivityInk, result: string) =>
    done ? (
      <Text modifiers={[font({ weight: "bold", size: 15 }), foregroundStyle(result)]}>{props.result}</Text>
    ) : (
      <Text timerInterval={range} countsDown modifiers={[font({ weight: "semibold", size: 15, design: "monospaced" }), monospacedDigit(), multilineTextAlignment("trailing"), frame({ width: 64, alignment: "trailing" }), foregroundStyle(ink.ink)]} />
    );

  return {
    banner: (
      <VStack alignment="leading" spacing={6} modifiers={[padding({ all: 14 }), activityBackgroundTint(c.ground)]}>
        <HStack spacing={6}>
          {props.mark !== "" ? <Image uiImage={props.mark} modifiers={[resizable(), frame({ width: 22, height: 22 }), clipShape("circle")]} /> : null}
          <Image systemName={arrow} color={sideColor} />
          <Text modifiers={[font({ weight: "bold", size: 17 }), foregroundStyle(c.ink)]}>{`${props.asset} ${props.side}`}</Text>
          <Spacer />
          {clockIn(c, resultColor)}
        </HStack>
        <HStack spacing={8}>
          <Text modifiers={[font({ size: 13 }), foregroundStyle(c.muted)]}>{props.strike}</Text>
          {props.price !== "" ? <Text modifiers={[font({ size: 13, weight: "medium" }), monospacedDigit(), foregroundStyle(c.ink)]}>{`Now ${props.price}`}</Text> : null}
          <Spacer />
          {done ? null : <Text modifiers={[font({ size: 13, weight: "semibold" }), foregroundStyle(standingColor)]}>{standingWord}</Text>}
        </HStack>
        {done ? null : <Text modifiers={[font({ size: 13 }), foregroundStyle(c.accent)]}>{`Pays ${props.payout} if right`}</Text>}
      </VStack>
    ),
    compactLeading: (
      <HStack spacing={3}>
        <Image systemName={arrow} color={islandSide} />
        <Text modifiers={[font({ weight: "semibold", size: 14 }), foregroundStyle(d.ink)]}>{props.asset}</Text>
      </HStack>
    ),
    compactTrailing: done ? (
      <Text modifiers={[font({ weight: "semibold", size: 14 }), foregroundStyle(islandResult)]}>{props.resultTone === "win" ? "Won" : props.resultTone === "loss" ? "Lost" : "Void"}</Text>
    ) : (
      <Text timerInterval={range} countsDown modifiers={[font({ size: 14, design: "monospaced" }), monospacedDigit(), multilineTextAlignment("trailing"), frame({ width: 48, alignment: "trailing" }), foregroundStyle(islandStanding)]} />
    ),
    minimal: <Image systemName={arrow} color={done ? islandResult : islandSide} />,
    expandedLeading: (
      <VStack alignment="leading" spacing={2} modifiers={[padding({ leading: 6 })]}>
        <HStack spacing={4}>
          {props.mark !== "" ? <Image uiImage={props.mark} modifiers={[resizable(), frame({ width: 20, height: 20 }), clipShape("circle")]} /> : null}
          <Image systemName={arrow} color={islandSide} />
          <Text modifiers={[font({ weight: "bold", size: 16 }), foregroundStyle(d.ink)]}>{props.asset}</Text>
        </HStack>
        <Text modifiers={[font({ size: 12 }), foregroundStyle(d.muted)]}>{props.side}</Text>
      </VStack>
    ),
    expandedTrailing: <VStack alignment="trailing" modifiers={[padding({ trailing: 6 })]}>{clockIn(d, islandResult)}</VStack>,
    expandedBottom: (
      <HStack spacing={8} modifiers={[padding({ horizontal: 6 })]}>
        <Text modifiers={[font({ size: 13 }), foregroundStyle(d.muted)]}>{props.strike}</Text>
        {props.price !== "" ? <Text modifiers={[font({ size: 13 }), monospacedDigit(), foregroundStyle(d.ink)]}>{props.price}</Text> : null}
        <Spacer />
        {done ? null : <Text modifiers={[font({ size: 13, weight: "semibold" }), foregroundStyle(d.accent)]}>{`Pays ${props.payout}`}</Text>}
      </HStack>
    ),
  };
};

export default createLiveActivity("WindowActivity", WindowActivity);
