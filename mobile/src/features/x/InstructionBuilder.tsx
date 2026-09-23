import { ENTRY_BUFFER_SEC } from "@agari/core/constants";
import { noEntryCutoffSec } from "@agari/core/lifecycle";
import { LAUNCH_TICKERS, TICKERS } from "@agari/core/market";
import { formatBaseUnits, formatUtc, parseDecimalToBaseUnits } from "@agari/core/units";
import { describeRefusal, parseInstruction, selectXWindow, X_CADENCES, xRefusalCopy, type XAsset, type XCadence } from "@agari/core/x";
import { marketsProvider } from "@agari/markets";
import { useLanes, useTick } from "@agari/markets/react";
import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useVenue } from "@/features/markets/useVenue";
import { X_HANDLE } from "@/features/x/copy";
import { Button, Chips, Field, haptic, Segmented } from "~/components/kit";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { openExternal } from "~/lib/external";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";
import { AmountInput } from "../strategies/AmountInput";
import { PostCard } from "./PostCard";

const AMOUNTS = ["5", "10", "25"] as const;

/**
 * web's features/x/XInstructionBuilder.tsx: pick asset, side, timeframe and amount against the relay's own Window
 * rule, then copy the post or open it in X. Pasting a post fills the builder through the relay's own parser, so what
 * you see is what the relay will read. Nothing here sends an order: the relay executes the mention under your grant.
 */
export function InstructionBuilder({ enabled, balanceBase, decimals, symbol, handle }: {
  enabled: boolean;
  balanceBase: bigint | null;
  decimals: number;
  symbol: string;
  handle: string | null;
}) {
  const { color } = useTheme();
  const { venueId } = useVenue();
  const lanes = useLanes(venueId);
  useTick(1000);
  const nowMs = marketsProvider.nowMs();
  const markets = lanes?.ok && !lanes.stale ? lanes.value.lanes.flatMap((l) => l.markets) : null;
  const unavailable = Boolean(lanes && (!lanes.ok || lanes.stale));
  const [asset, setAsset] = useState<XAsset>("TSLA");
  const [side, setSide] = useState<"up" | "down">("up");
  const [amount, setAmount] = useState("5");
  const [cadence, setCadence] = useState<XCadence>("5m");
  const [pasted, setPasted] = useState("");
  const [parseNote, setParseNote] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const selection = markets ? selectXWindow(markets, { asset, intervalSec: X_CADENCES[cadence] }, nowMs) : null;
  const stake = parseDecimalToBaseUnits(amount, decimals);
  const amountError = !stake || stake <= 0n
    ? "Enter a positive amount."
    : balanceBase !== null && stake > balanceBase
      ? `Your X balance is ${formatBaseUnits(balanceBase, decimals)} ${symbol}. Use a smaller amount or add funds.`
      : "";
  const instruction = `${X_HANDLE} ${asset} ${side.toUpperCase()} ${amount} ${cadence}`;
  const canPost = enabled && Boolean(selection?.ok) && !amountError;
  const maxAmount = balanceBase === null ? null : formatBaseUnits(balanceBase, decimals, { maxDp: decimals, minDp: 0, group: false });
  const status = selection?.ok
    ? `Entries close at ${formatUtc(noEntryCutoffSec(selection.market) * 1000, { withSeconds: true })}.`
    : selection
      ? xRefusalCopy({
          refusalCode: selection.code,
          entryClosesAtSec: selection.market ? noEntryCutoffSec(selection.market) : null,
          nextWindowAtSec: selection.code === "window-not-started" ? selection.market?.tradingStartSec : null,
        }).detail
      : unavailable
        ? "Live Windows could not be checked. Try again shortly."
        : "Checking live Windows…";

  const readPost = (text: string) => {
    setPasted(text);
    if (!text.trim()) return setParseNote(null);
    const parsed = parseInstruction(text, { decimals });
    if (!parsed.ok) return setParseNote(`Not readable: ${describeRefusal(parsed.reason, parsed.token)}.`);
    const i = parsed.instruction;
    setAsset(i.asset);
    setSide(i.side);
    setCadence(i.cadence);
    setAmount(formatBaseUnits(i.stakeBase, decimals, { maxDp: decimals, minDp: 0, group: false }));
    setParseNote("Read as below. Check the Window is open before posting.");
    haptic.select();
  };
  const copy = async () => {
    if (!canPost) return;
    await Clipboard.setStringAsync(instruction);
    setCopied(true);
    haptic.success();
  };
  const post = () => {
    if (!canPost) return;
    void openExternal(`https://x.com/intent/post?text=${encodeURIComponent(instruction)}`);
  };

  return (
    <View style={styles.wrap} accessibilityLabel="Build an X instruction">
      <View>
        <Text style={[TYPE.headline, { color: color.ink }]}>Make your call.</Text>
        <Text style={[TYPE.caption, { color: color.inkSecondary }]}>Choose. Copy. Post on X.</Text>
      </View>

      <Field label="Or paste a post" value={pasted} onChangeText={readPost} placeholder={`${X_HANDLE} tsla up 5 15m`} error={parseNote?.startsWith("Not") ? parseNote : null} />
      {parseNote && !parseNote.startsWith("Not") ? <Text style={[TYPE.caption, { color: color.profit }]}>{parseNote}</Text> : null}

      <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>Asset</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.assets}>
        {LAUNCH_TICKERS.map((name) => {
          const on = asset === name;
          return (
            <Pressable
              key={name}
              onPress={() => {
                haptic.select();
                setAsset(name);
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${name}, ${TICKERS[name].name}`}
              style={[styles.asset, { borderColor: on ? color.accent : color.hairline, backgroundColor: on ? color.accentWash : color.surface1 }]}
            >
              <AssetDisc asset={name} size={28} />
              <View>
                <Text style={[TYPE.data, { color: color.ink }]}>{name}</Text>
                <Text style={[TYPE.caption, styles.small, { color: color.inkMuted }]} numberOfLines={1}>
                  {TICKERS[name].name}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>Direction</Text>
      <View style={styles.sides}>
        {(["up", "down"] as const).map((s) => (
          <Button
            key={s}
            label={s === "up" ? "UP · Long" : "DOWN · Short"}
            variant={side === s ? (s === "up" ? "profit" : "loss") : "outline"}
            icon={s === "up" ? { ios: "arrow.up.right", android: "north_east" } : { ios: "arrow.down.right", android: "south_east" }}
            onPress={() => setSide(s)}
            style={styles.flex}
          />
        ))}
      </View>

      <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>Timeframe · live availability</Text>
      <Segmented
        label="Timeframe"
        options={(Object.keys(X_CADENCES) as XCadence[]).map((name) => {
          const w = markets ? selectXWindow(markets, { asset, intervalSec: X_CADENCES[name] }, nowMs) : null;
          const label = w?.ok ? "open" : w?.code === "window-not-started" ? "soon" : w?.code === "opening-price-pending" ? "starting" : w ? "closed" : "…";
          return { value: name, label: `${name} · ${label}` };
        })}
        value={cadence}
        onChange={setCadence}
      />
      <Text style={[TYPE.caption, { color: selection?.ok ? color.profit : color.inkSecondary }]} accessibilityLiveRegion="polite">
        {status}
      </Text>

      <AmountInput
        label={`Amount · X balance ${maxAmount ?? "—"}`}
        symbol={symbol}
        value={amount}
        onChange={setAmount}
        error={amountError || null}
        onMax={maxAmount && balanceBase ? () => setAmount(maxAmount) : undefined}
      />
      <Chips options={AMOUNTS.map((v) => ({ value: v, label: v }))} value={amount} onPick={setAmount} />

      <PostCard handle={handle}>
        <Text style={[styles.post, { color: color.ink }]}>
          <Text style={{ color: color.accent }}>{X_HANDLE}</Text> {asset} <Text style={{ color: side === "up" ? color.profit : color.loss }}>{side.toUpperCase()}</Text> {stake && stake > 0n ? amount : "…"} {cadence}
        </Text>
      </PostCard>
      <View style={styles.sides}>
        <Button label={copied ? "Copied" : "Copy"} variant="secondary" icon={{ ios: copied ? "checkmark" : "doc.on.doc", android: copied ? "check" : "content_copy" }} disabled={!canPost} onPress={() => void copy()} style={styles.flex} />
        <Button label="Post on X" disabled={!canPost} icon={{ ios: "paperplane.fill", android: "send" }} onPress={post} style={styles.flex} />
      </View>
      {!enabled ? <Text style={[TYPE.caption, { color: color.inkMuted }]}>Complete wallet, funding and X setup above to enable posting.</Text> : null}
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>
        Entries close {ENTRY_BUFFER_SEC}s before the Window ends. Post early enough for X delivery; availability is checked again on arrival.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  assets: { gap: 8, paddingVertical: 2 },
  asset: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 52, paddingHorizontal: 12, borderRadius: RADIUS.md, borderWidth: 1, maxWidth: 170 },
  small: { fontSize: 11, lineHeight: 14 },
  sides: { flexDirection: "row", gap: 8 },
  flex: { flex: 1 },
  post: { fontFamily: FONT.data, fontSize: 17, lineHeight: 24 },
});
