import { ERROR_BOUNDARY } from "@agari/core/copy";
import type { LaneSet, Side } from "@agari/core/types";
import { useOpeningPrice } from "@agari/markets/react";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { assetPriceLine, assetPriceParts } from "@/features/markets/hero/units";
import { useOracleSpot } from "@/features/markets/hero/useOracleSpot";
import { TAKES } from "@/features/takes/copy";
import { normalizeCaption, TAKE_MAX_CAPTION } from "@/features/takes/protocol";
import { useComposerMarket } from "@/features/takes/useComposerMarket";
import { takesKey, usePostTake } from "@/features/takes/useTakes";
import { useWalletSession } from "@/lib/wallet-session";
import { Button, EmptyState, haptic } from "~/components/kit";
import { pushToast } from "~/components/toast/store";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";
import { findPostedTake } from "./confirmPosted";
import { HorizonRow, SidePicker, TakePreview } from "./TakeParts";

const C = TAKES.composer;

interface TakeComposerSheetProps {
  visible: boolean;
  laneSet: LaneSet | null;
  nowMs: number;
  /** null while unknown; false when this deployment has no social store. */
  configured: boolean | null;
  onClose: () => void;
}

/**
 * "Post a take" — web's `TakeComposer` (features/takes/TakeComposer.tsx) as a native page sheet: Up / Down (Range
 * present and disabled, naming what it waits on), the Window's opening print as the read-only line with spot beside it,
 * the horizon row from the live lanes, the optional words, the call preview, then web's `usePostTake` — the wallet
 * signs web's exact take text and the server's own row lands in the feed.
 */
export function TakeComposerSheet({ visible, laneSet, nowMs, configured, onClose }: TakeComposerSheetProps) {
  const { color } = useTheme();
  const { address } = useWalletSession();
  const horizon = useComposerMarket(laneSet, nowMs);
  const { post, busy, error } = usePostTake();
  const queryClient = useQueryClient();
  const [side, setSide] = useState<Side>("down");
  const [caption, setCaption] = useState("");

  const market = horizon.market;
  const opening = useOpeningPrice(visible ? (market?.marketId ?? null) : null);
  const lineRaw = opening?.ok ? opening.value : (market?.openingPriceRaw ?? null);
  const spotRaw = useOracleSpot(visible ? (market?.asset ?? null) : null);
  const [checking, setChecking] = useState(false);
  const [failed, setFailed] = useState(false);
  const working = busy || checking;
  const canPost = configured === true && !!address && market !== null && !working;

  const landed = () => {
    haptic.success();
    pushToast({ title: C.posted, tone: "neutral" });
    setCaption("");
    setFailed(false);
    onClose();
  };

  // A post whose answer was lost on the way back (a slow or dropped connection) may still have been stored: before
  // calling it a failure, read the author's takes, and only if this one is not there offer the error with Retry.
  const submit = async () => {
    if (!canPost || !market || !address) return;
    setFailed(false);
    const sinceMs = Date.now();
    const words = normalizeCaption(caption);
    const posted = await post({ marketId: market.marketId, side, caption: words });
    if (posted) {
      landed();
      return;
    }
    setChecking(true);
    const stored = await findPostedTake({ address, marketId: market.marketId, side, caption: words, sinceMs });
    setChecking(false);
    if (stored) {
      void queryClient.invalidateQueries({ queryKey: takesKey() });
      landed();
      return;
    }
    setFailed(true);
    haptic.error();
  };

  const lineParts = market !== null && lineRaw !== null ? assetPriceParts(market.asset, lineRaw) : null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={[styles.fill, { backgroundColor: color.ground }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.head, { borderBottomColor: color.hairline }]}>
          <View style={styles.headText}>
            <Text style={[TYPE.title, { color: color.ink }]} accessibilityRole="header">
              {C.title}
            </Text>
            <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{C.where}</Text>
          </View>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={C.close}
            style={[styles.close, { backgroundColor: color.surface2 }]}
          >
            <SymbolView name={{ ios: "xmark", android: "close" }} size={14} tintColor={color.ink} />
          </Pressable>
        </View>

        {configured === false ? (
          <View style={styles.body}>
            <EmptyState why={C.unavailable.title} detail={C.unavailable.body} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <SidePicker side={side} onSide={setSide} />

            <View style={[styles.line, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
              <View style={styles.lineRow}>
                <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{C.line}</Text>
                <Text style={[TYPE.data, { color: color.inkSecondary }]}>
                  {spotRaw === null || market === null ? "" : C.spot(assetPriceLine(market.asset, spotRaw))}
                </Text>
              </View>
              <Text style={[lineParts ? styles.figure : TYPE.bodyStrong, { color: lineParts ? color.ink : color.inkMuted }]}>
                {lineParts ? `${lineParts.sign}${lineParts.figure}` : C.linePending}
              </Text>
              <Text style={[TYPE.caption, { color: color.inkMuted }]}>{C.lineNote}</Text>
            </View>

            <HorizonRow horizon={horizon} />

            <View style={styles.words}>
              <TextInput
                value={caption}
                onChangeText={(text) => setCaption(text.slice(0, TAKE_MAX_CAPTION))}
                placeholder={C.captionPlaceholder}
                placeholderTextColor={color.inkMuted}
                accessibilityLabel={C.captionPlaceholder}
                maxLength={TAKE_MAX_CAPTION}
                multiline
                style={[TYPE.body, styles.input, { color: color.ink, backgroundColor: color.surface1, borderColor: color.hairline }]}
              />
              <Text style={[styles.count, { color: color.inkMuted }]}>
                {caption.length}/{TAKE_MAX_CAPTION}
              </Text>
            </View>

            <TakePreview market={market} side={side} lineRaw={lineRaw} />

            {error && failed ? (
              <Text style={[TYPE.caption, { color: color.loss }]} accessibilityRole="alert">
                {error}
              </Text>
            ) : null}

            {!address ? (
              <Button
                label={C.connect}
                onPress={() => {
                  onClose();
                  router.push("/connect");
                }}
              />
            ) : (
              <Button
                label={working ? C.posting : market === null ? C.noLiveMarket : failed ? ERROR_BOUNDARY.retry : C.post}
                loading={working}
                disabled={!canPost}
                size="lg"
                icon={{ ios: "signature", android: "draw" }}
                onPress={() => void submit()}
              />
            )}
            <Text style={[TYPE.caption, { color: color.inkMuted }]}>{C.permanence}</Text>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  head: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 16, paddingTop: 20, borderBottomWidth: StyleSheet.hairlineWidth },
  headText: { flex: 1, gap: 4 },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  body: { padding: 16, gap: 16, paddingBottom: 48 },
  line: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 6 },
  lineRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  figure: { fontFamily: FONT.dataStrong, fontSize: 28, lineHeight: 34 },
  words: { gap: 4 },
  input: { minHeight: 76, borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12, textAlignVertical: "top" },
  count: { fontFamily: FONT.data, fontSize: 11, alignSelf: "flex-end" },
});
