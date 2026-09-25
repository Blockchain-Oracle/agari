import { TICKERS, type TickerSymbol } from "@agari/core/market";
import { marketsProvider } from "@agari/markets";
import { useAssetPrice } from "@agari/markets/react";
import { Bell, BellRing } from "lucide-react-native";
import { useEffect, useRef } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { bpsToPctText, DROP_BPS, dropBps, hourHigh, keepHour, type PriceSample } from "@/features/hedge/drop-bell";
import { HEDGE } from "@/features/hedge/copy";
import { assetPriceLine, basisRaw, feedRawToOracleRaw } from "@/features/markets/hero/units";
import { haptic } from "~/components/kit";
import { pushToast } from "~/components/toast/store";
import { FONT, useTheme } from "~/theme";
import { setBell, useBells } from "./bells";

/**
 * web's `DropBellToggle` (`.ys-bell`): "Tell me if OpenAI falls 3% within an hour" in 10 pt mono caps at 60 % until it
 * is on. A device-local switch; the phone rings it as an in-app message with a haptic (web's fallback when no system
 * notification is allowed).
 */
export function DropBellToggle({ asset }: { asset: TickerSymbol }) {
  const { color } = useTheme();
  const bells = useBells();
  const on = bells.includes(asset);
  const name = TICKERS[asset].name;
  const Icon = on ? BellRing : Bell;
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        setBell(asset, !on);
      }}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={HEDGE.bell.off(name)}
      accessibilityHint={HEDGE.bell.foot}
      hitSlop={10}
      style={({ pressed }) => [styles.bell, { opacity: on || pressed ? 1 : 0.6 }]}
    >
      <Icon size={12} color={color.inkSecondary} />
      <Text style={[styles.text, { color: color.inkSecondary }]}>{on ? HEDGE.bell.on(name) : HEDGE.bell.off(name)}</Text>
    </Pressable>
  );
}

/** A price published longer ago than this is not a sample: a frozen feed must never ring the bell (web's rule). */
const SAMPLE_MAX_AGE_SEC = 300;
const rung = new Set<TickerSymbol>();
const hours = new Map<TickerSymbol, PriceSample[]>();

/** web's `AssetWatch`: the trailing hour of publishes; rings once when the latest sits 3% or more under the hour's high. */
function AssetWatch({ asset }: { asset: TickerSymbol }) {
  const reading = useAssetPrice(asset);
  const price = reading?.ok ? reading.value : null;
  const raw = price ? feedRawToOracleRaw(basisRaw(price), price.decimals) : null;
  const publishTimeSec = price?.publishTimeSec ?? null;
  const seenSec = useRef<number | null>(null);

  useEffect(() => {
    if (raw === null || publishTimeSec === null || publishTimeSec === seenSec.current) return;
    seenSec.current = publishTimeSec;
    const nowSec = Math.floor(marketsProvider.nowMs() / 1000);
    if (nowSec - publishTimeSec > SAMPLE_MAX_AGE_SEC) return;
    const hour = keepHour(hours.get(asset) ?? [], { sec: publishTimeSec, raw });
    hours.set(asset, hour);
    const bps = dropBps(hour);
    if (bps < DROP_BPS || rung.has(asset)) return;
    rung.add(asset);
    const high = hourHigh(hour)!;
    haptic.heavy();
    pushToast({
      title: HEDGE.bell.fired.title(TICKERS[asset].name, bpsToPctText(bps)),
      description: HEDGE.bell.fired.body(assetPriceLine(asset, high.raw), assetPriceLine(asset, raw, high.raw)),
      tone: "warning",
    });
  }, [asset, raw, publishTimeSec]);

  return null;
}

/**
 * web's `DropBellWatcher`: one price watch per stock the person switched the bell on for. Mount once while the app
 * runs (it reads nothing with no bell on); the ticker hub mounts it too, so a bell switched on there watches at once.
 */
export function DropBellWatcher() {
  const bells = useBells();
  return (
    <>
      {bells.map((asset) => (
        <AssetWatch key={asset} asset={asset} />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  bell: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4, alignSelf: "flex-start" },
  text: { flexShrink: 1, fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 0.8, textTransform: "uppercase" },
});
