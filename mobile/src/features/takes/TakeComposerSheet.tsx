import { ERROR_BOUNDARY } from "@agari/core/copy";
import type { LaneSet, Side } from "@agari/core/types";
import { useOpeningPrice } from "@agari/markets/react";
import { LinearGradient } from "expo-linear-gradient";
import { Unplug, X } from "lucide-react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, RadialGradient, Rect } from "react-native-svg";
import { Stop, stopPaint } from "~/components/ui/SvgStop";
import { assetPriceLine, assetPriceParts } from "@/features/markets/hero/units";
import { useOracleSpot } from "@/features/markets/hero/useOracleSpot";
import { TAKES } from "@/features/takes/copy";
import { normalizeCaption, TAKE_MAX_CAPTION } from "@/features/takes/protocol";
import { useComposerMarket } from "@/features/takes/useComposerMarket";
import { takesKey, usePostTake } from "@/features/takes/useTakes";
import { useWalletSession } from "@/lib/wallet-session";
import { haptic } from "~/components/kit";
import { pushToast } from "~/components/toast/store";
import { CONNECT } from "@/lib/copy";
import { FONT, useTheme } from "~/theme";
import { roomTokens } from "~/theme/web/explore/room";
import { takesTokens } from "~/theme/web/takes";
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
 * "Post a take" — web's `TakeComposer` (features/takes/TakeComposer.tsx, take-composer.css): a bottom sheet (max 440,
 * 92 % of the screen, radius 24 at the top, the Room's ground and the vermilion hairline) over a 70 % black scrim,
 * appearing in place as web's Dialog does. Up / Down (Range present and disabled), the Window's opening print as the
 * read-only line with spot beside it, the horizon row, the optional words, the call preview, then web's
 * `usePostTake` — the wallet signs web's exact take text and the server's own row lands in the feed.
 */
export function TakeComposerSheet({ visible, laneSet, nowMs, configured, onClose }: TakeComposerSheetProps) {
  const { name, color } = useTheme();
  const t = takesTokens(name);
  const insets = useSafeAreaInsets();
  const session = useWalletSession();
  const { address } = session;
  const horizon = useComposerMarket(laneSet, nowMs);
  const { post, busy, error } = usePostTake();
  const queryClient = useQueryClient();
  const [side, setSide] = useState<Side>("down");
  const [caption, setCaption] = useState("");

  const market = horizon.market;
  const opening = useOpeningPrice(visible ? (market?.marketId ?? null) : null);
  const lineRaw = opening?.ok ? opening.value : (market?.openingPriceRaw ?? null);
  const spotRaw = useOracleSpot(visible ? (market ?? null) : null);
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

  const parts = market !== null && lineRaw !== null ? assetPriceParts(market.asset, lineRaw) : null;
  const busyConnect = session.isConnecting || session.connecting;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: t.scrim }]} onPress={onClose} accessibilityLabel={C.close} />
        <View style={[styles.sheet, { borderColor: t.hairline }]} accessibilityViewIsModal accessibilityLabel={C.title}>
          <Ground />
          <LinearGradient colors={[t.topClear, t.topLine, t.topClear]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.hairline} pointerEvents="none" />
          <ScrollView contentContainerStyle={[styles.body, { paddingBottom: 24 + insets.bottom }]} keyboardShouldPersistTaps="handled" bounces={false}>
            <View style={styles.head}>
              <Text style={[styles.title, { color: t.ink }]} accessibilityRole="header">
                {C.title}
              </Text>
              <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={C.close} hitSlop={8} style={styles.close}>
                <X size={18} color={t.ink40} />
              </Pressable>
            </View>
            <Text style={[styles.where, { color: t.ink40 }]}>{C.where}</Text>

            {configured === false ? (
              <View style={styles.state}>
                <View style={[styles.stateIcon, { borderColor: t.hairline }]}>
                  <Unplug size={24} strokeWidth={1.8} color={t.ink50} />
                </View>
                <Text style={[styles.stateTitle, { color: t.ink }]}>{C.unavailable.title}</Text>
                <Text style={[styles.stateBody, { color: t.ink50 }]}>{C.unavailable.body}</Text>
              </View>
            ) : (
              <>
                <SidePicker side={side} onSide={setSide} />

                <View style={[styles.line, { borderColor: t.hairline, backgroundColor: t.inset }]}>
                  <View style={styles.lineRow}>
                    <Text style={[styles.micro, { color: t.ink40 }]}>{C.line.toUpperCase()}</Text>
                    <Text style={[styles.spot, { color: t.ink35 }]}>{spotRaw === null || market === null ? "" : C.spot(assetPriceLine(market.asset, spotRaw))}</Text>
                  </View>
                  <View style={styles.value}>
                    <Text style={[styles.figure, { color: t.ink40 }]}>{parts ? parts.sign : "$"}</Text>
                    <Text style={parts ? [styles.figure, { color: t.ink }] : [styles.pending, { color: t.ink35 }]}>{parts ? parts.figure : C.linePending}</Text>
                  </View>
                  <Text style={[styles.note, { color: t.ink30 }]}>{C.lineNote}</Text>
                </View>

                <HorizonRow horizon={horizon} />

                <View style={styles.words}>
                  <TextInput
                    value={caption}
                    onChangeText={(text) => setCaption(text.slice(0, TAKE_MAX_CAPTION))}
                    placeholder={C.captionPlaceholder}
                    placeholderTextColor={t.ink25}
                    accessibilityLabel={C.captionPlaceholder}
                    maxLength={TAKE_MAX_CAPTION}
                    multiline
                    style={[styles.input, { color: t.ink, borderColor: t.hairline, backgroundColor: t.inset }]}
                  />
                  <Text style={[styles.count, { color: t.ink30 }]}>
                    {caption.length}/{TAKE_MAX_CAPTION}
                  </Text>
                </View>

                <TakePreview market={market} side={side} lineRaw={lineRaw} />

                {error && failed ? (
                  <Text style={[styles.error, { color: color.loss }]} accessibilityRole="alert">
                    {error}
                  </Text>
                ) : null}

                {!address ? (
                  <View style={styles.connectRow}>
                    <Pressable
                      onPress={() => {
                        onClose();
                        session.connect();
                      }}
                      disabled={busyConnect}
                      accessibilityRole="button"
                      style={({ pressed }) => [styles.connect, { backgroundColor: pressed ? color.accentPressed : color.accent }, busyConnect && styles.dim]}
                    >
                      <Text style={[styles.connectText, { color: color.onAccent }]}>{busyConnect ? CONNECT.connecting : CONNECT.connect}</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => void submit()}
                    disabled={!canPost}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !canPost, busy: working }}
                    style={({ pressed }) => [styles.post, { backgroundColor: pressed ? color.accentPressed : color.accent }, !canPost && styles.dim]}
                  >
                    <Text style={[styles.postText, { color: t.postInk }]}>
                      {working ? C.posting : market === null ? C.noLiveMarket : failed ? ERROR_BOUNDARY.retry : C.post}
                    </Text>
                  </Pressable>
                )}
                <Text style={[styles.permanence, { color: t.ink35 }]}>{C.permanence}</Text>
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** `.take-sheet`'s ground is the Room's (`--room-sheet`): the radial glow from above the top edge in dark, flat paper in light. */
function Ground() {
  const { name } = useTheme();
  const [a, b, c] = roomTokens(name).sheetStops;
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" accessible={false}>
      <Defs>
        <RadialGradient id="take" cx="50%" cy="-10%" rx="130%" ry="90%" fx="50%" fy="-10%">
          <Stop offset="0" {...stopPaint(a)} />
          <Stop offset="0.46" {...stopPaint(b)} />
          <Stop offset="1" {...stopPaint(c)} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#take)" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: "flex-end", alignItems: "center" },
  sheet: { width: "100%", maxWidth: 440, maxHeight: "92%", borderWidth: 1, borderBottomWidth: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden" },
  hairline: { position: "absolute", left: 0, right: 0, top: 0, height: 1, zIndex: 20 },
  body: { paddingTop: 24, paddingHorizontal: 24 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontFamily: FONT.headingHeavy, fontSize: 18, lineHeight: 28 },
  close: { padding: 6, borderRadius: 9999 },
  where: { marginTop: 4, fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 15 },
  state: { alignItems: "center", gap: 12, paddingTop: 28, paddingHorizontal: 8, paddingBottom: 8 },
  stateIcon: { width: 56, height: 56, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  stateTitle: { fontFamily: FONT.headingSemi, fontSize: 17, lineHeight: 25.5, textAlign: "center" },
  stateBody: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, textAlign: "center" },
  line: { marginTop: 12, borderRadius: 12, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 14 },
  lineRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  micro: { fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 13.5, letterSpacing: 1.44 },
  spot: { fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 13.5 },
  value: { marginTop: 4, flexDirection: "row", alignItems: "baseline", gap: 6 },
  figure: { fontFamily: FONT.heading, fontSize: 20, lineHeight: 28, fontVariant: ["tabular-nums"] },
  pending: { fontFamily: FONT.headingRegular, fontSize: 13, lineHeight: 19.5 },
  note: { marginTop: 4, fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 13.5 },
  words: { marginTop: 12 },
  input: { minHeight: 64, borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, fontFamily: FONT.headingRegular, fontSize: 15, lineHeight: 20.6, textAlignVertical: "top" },
  count: { marginTop: 4, textAlign: "right", fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 13.5 },
  error: { marginTop: 10, fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 16.5 },
  connectRow: { marginTop: 12, alignItems: "center" },
  connect: { height: 48, paddingHorizontal: 16, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  connectText: { fontFamily: FONT.bodyMedium, fontSize: 15, lineHeight: 22.5 },
  post: { marginTop: 12, borderRadius: 9999, paddingVertical: 12, paddingHorizontal: 24, alignItems: "center" },
  postText: { fontFamily: FONT.bodyStrong, fontSize: 14, lineHeight: 20 },
  dim: { opacity: 0.5 },
  permanence: { marginTop: 10, textAlign: "center", fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 13.5 },
});
