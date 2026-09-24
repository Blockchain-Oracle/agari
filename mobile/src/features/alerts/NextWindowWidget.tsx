import { HStack, Image, Link, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import { clipShape, containerBackground, font, foregroundStyle, frame, monospacedDigit, multilineTextAlignment, padding, resizable } from "@expo/ui/swift-ui/modifiers";
import { createWidget, type WidgetEnvironment } from "expo-widgets";
import type { ActivityInk } from "./WindowActivity";

/** One Window row, worded by the app: the widget runtime cannot format or import. */
export interface WidgetRow {
  asset: string;
  /** "5m", "15m", "1h". */
  cadence: string;
  /** Epoch ms trading locks; the row's timer counts down natively. */
  locksAtMs: number;
  /** `agari://markets/<id>`. */
  url: string;
  /** The stock's own mark in the app group (`file://…png`), or "" until it is written. */
  mark: string;
}

export interface NextWindowProps {
  /** Soonest to lock first; empty when nothing trades (the market is closed). */
  rows: WidgetRow[];
  /** "Opens 14:30 · in 4h 04m" when closed, else "". */
  closedLine: string;
  /** Epoch ms the app wrote this; rows already past lock are hidden. */
  writtenAtMs: number;
  dark: ActivityInk;
  light: ActivityInk;
}

const NextWindow = (props: NextWindowProps, environment: WidgetEnvironment) => {
  "widget";
  const c = environment.colorScheme === "light" ? props.light : props.dark;
  const at = environment.date.getTime();
  const live = props.rows.filter((row) => row.locksAtMs > at);
  const small = environment.widgetFamily === "systemSmall";
  const shown = live.slice(0, small ? 1 : environment.widgetFamily === "systemMedium" ? 3 : 6);
  const head = (
    <HStack spacing={4}>
      <Text modifiers={[font({ weight: "heavy", size: 13 }), foregroundStyle(c.accent)]}>AGARI</Text>
      <Spacer />
      {small ? null : <Text modifiers={[font({ size: 11 }), foregroundStyle(c.muted)]}>{shown.length > 0 ? "Next to close" : "Market"}</Text>}
    </HStack>
  );

  if (shown.length === 0) {
    return (
      <VStack alignment="leading" spacing={6} modifiers={[padding({ all: 2 }), containerBackground(c.ground, "widget")]}>
        {head}
        <Spacer />
        <Text modifiers={[font({ weight: "bold", size: 16 }), foregroundStyle(c.ink)]}>{props.closedLine !== "" ? "Closed" : "Between Windows"}</Text>
        <Text modifiers={[font({ size: 12 }), foregroundStyle(c.muted)]}>{props.closedLine !== "" ? props.closedLine : "Open Agari for the next call"}</Text>
      </VStack>
    );
  }

  if (small) {
    const row = shown[0];
    return (
      <VStack alignment="leading" spacing={4} modifiers={[padding({ all: 2 }), containerBackground(c.ground, "widget")]}>
        {head}
        <Spacer />
        <HStack spacing={6}>
          {row.mark !== "" ? <Image uiImage={row.mark} modifiers={[resizable(), frame({ width: 26, height: 26 }), clipShape("circle")]} /> : null}
          <Text modifiers={[font({ weight: "bold", size: 22 }), foregroundStyle(c.ink)]}>{row.asset}</Text>
        </HStack>
        <Text modifiers={[font({ size: 12 }), foregroundStyle(c.muted)]}>{`${row.cadence} Window · Up or Down`}</Text>
        <Text timerInterval={{ lower: new Date(Math.min(at, row.locksAtMs)), upper: new Date(row.locksAtMs) }} countsDown modifiers={[font({ weight: "semibold", size: 20, design: "monospaced" }), monospacedDigit(), foregroundStyle(c.accent)]} />
      </VStack>
    );
  }

  return (
    <VStack alignment="leading" spacing={8} modifiers={[padding({ all: 2 }), containerBackground(c.ground, "widget")]}>
      {head}
      {shown.map((row) => (
        <Link key={row.url} destination={row.url}>
          <HStack spacing={8}>
            {row.mark !== "" ? <Image uiImage={row.mark} modifiers={[resizable(), frame({ width: 22, height: 22 }), clipShape("circle")]} /> : null}
            <Text modifiers={[font({ weight: "semibold", size: 15 }), foregroundStyle(c.ink)]}>{row.asset}</Text>
            <Text modifiers={[font({ size: 12 }), foregroundStyle(c.muted)]}>{row.cadence}</Text>
            <Spacer />
            <Text timerInterval={{ lower: new Date(Math.min(at, row.locksAtMs)), upper: new Date(row.locksAtMs) }} countsDown modifiers={[font({ size: 14, design: "monospaced" }), monospacedDigit(), multilineTextAlignment("trailing"), frame({ width: 64, alignment: "trailing" }), foregroundStyle(c.ink)]} />
          </HStack>
        </Link>
      ))}
      <Spacer />
    </VStack>
  );
};

export default createWidget("NextWindow", NextWindow);
