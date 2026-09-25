import type { Address } from "@agari/core/types";
import { keys, useWalletHistory } from "@agari/markets/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useMoneyUnits } from "@/features/activity/useActivity";
import { PROFILE } from "@/features/profile/copy";
import type { XStatus } from "@/features/x/protocol";
import { useWalletSession } from "@/lib/wallet-session";
import { ExplorePage } from "~/features/explore/ExplorePage";
import { HueAvatar } from "~/features/social/HueAvatar";
import { explorerUrl, openExternal } from "~/lib/external";
import { FONT, useTheme } from "~/theme";
import { profileTokens } from "~/theme/web/explore/profile";
import { ProfileCalls } from "./ProfileCalls";
import { ProfileRecord } from "./ProfileRecord";

const TAIL = 4;
const LEAD = 6;

/** The verified X link web reads server-side (`x_links`), read here from the same store through `/api/x/status`. */
function useVerifiedHandle(address: Address): string | null {
  const status = useQuery({
    queryKey: ["agari", "x", "status", address],
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/x/status?wallet=${encodeURIComponent(address)}`, { signal });
      if (!response.ok) throw new Error(`x status ${response.status}`);
      return (await response.json()) as XStatus;
    },
    staleTime: 60_000,
  });
  const binding = status.data?.binding;
  return binding && binding.wallet === address ? binding.handle : null;
}

/** news.css `.news-live`: the pulsing vermilion dot and the mono eyebrow. */
function Eyebrow({ label }: { label: string }) {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (!reduce) pulse.value = withRepeat(withTiming(0.45, { duration: 1200 }), -1, true);
  }, [reduce, pulse]);
  const fade = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <View style={styles.live}>
      <Animated.View style={[styles.liveDot, { backgroundColor: color.accent, shadowColor: color.accent }, fade]} />
      <Text style={[styles.liveLabel, { color: color.inkMuted }]}>{label}</Text>
    </View>
  );
}

/** `.asset-tab`: the mono uppercase tab web uses for the profile's three actions. */
function Tab({ label, onPress }: { label: string; onPress: () => void }) {
  const { color } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={8} style={styles.tab}>
      <Text style={[styles.tabText, { color: color.inkMuted }]}>{label}</Text>
    </Pressable>
  );
}

/**
 * `/u/[address]` — web's ProfileScreen on a phone, in /news's frame: the live eyebrow, the hue avatar and the two-tone
 * address, the Japanese line and the sentence; the verified X link and the three actions over a hairline; then the
 * record, the edge excerpt, open calls and takes. Every figure is public index data; nothing needs a signature.
 */
export function ProfileScreen({ address }: { address: Address }) {
  const { name, color } = useTheme();
  const t = profileTokens(name);
  const { address: viewer } = useWalletSession();
  const own = viewer === address;
  const units = useMoneyUnits();
  const history = useWalletHistory(address);
  const handle = useVerifiedHandle(address);
  const queryClient = useQueryClient();
  const retry = useCallback(() => void queryClient.invalidateQueries({ queryKey: keys.history(address) }), [address, queryClient]);
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void Clipboard.setStringAsync(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <ExplorePage title={PROFILE.title(`${address.slice(0, LEAD)}…${address.slice(-TAIL)}`)} onRefresh={retry} style={styles.page}>
      <Eyebrow label={own ? PROFILE.eyebrowYou : PROFILE.eyebrow} />
      <View style={styles.ident}>
        <View style={[styles.avatar, { borderColor: t.avatarRing }]}>
          <HueAvatar address={address} size={32} />
        </View>
        <Text style={[styles.title, { color: color.ink }]} accessibilityRole="header" accessibilityLabel={address}>
          {address.slice(0, LEAD)}…<Text style={{ color: color.accent }}>{address.slice(-TAIL)}</Text>
        </Text>
      </View>
      <Text style={[styles.jp, { color: color.inkMuted }]}>{PROFILE.headingJp}</Text>
      <Text style={[styles.intro, { color: color.inkSecondary }]}>{PROFILE.intro}</Text>

      <View style={[styles.bar, { borderBottomColor: t.barRule }]}>
        {handle ? (
          <View>
            <Text style={[styles.dt, { color: color.inkMuted }]}>
              {PROFILE.x} · {PROFILE.xVerified}
            </Text>
            <Text style={[styles.big, { color: color.ink }]} accessibilityRole="link" onPress={() => openExternal(`https://x.com/${encodeURIComponent(handle)}`)}>
              @{handle}
            </Text>
          </View>
        ) : null}
        <View style={styles.tabs}>
          <Tab label={copied ? PROFILE.copied : PROFILE.copy} onPress={copy} />
          <Tab label={PROFILE.explorer} onPress={() => openExternal(explorerUrl("address", address))} />
          {own ? null : <Tab label={PROFILE.copyTrader} onPress={() => router.push(`/strategies?copy=${address}` as never)} />}
        </View>
      </View>

      <ProfileRecord address={address} reading={history} retry={retry} symbol={units.symbol} own={own} />
      <ProfileCalls address={address} units={units} />
    </ExplorePage>
  );
}

const styles = StyleSheet.create({
  page: { paddingTop: 48, paddingBottom: 96 + 112 },
  live: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  liveDot: { width: 6, height: 6, borderRadius: 3, shadowOpacity: 1, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  liveLabel: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 2.2, textTransform: "uppercase" },
  ident: { flexDirection: "row", alignItems: "center", gap: 16 },
  avatar: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  title: { flex: 1, fontFamily: FONT.headingHeavy, fontSize: 36, lineHeight: 39.6, letterSpacing: -0.9 },
  jp: { fontFamily: FONT.stamp, fontSize: 16, lineHeight: 24, letterSpacing: 0.6, marginTop: 14, marginBottom: 8 },
  intro: { fontFamily: FONT.body, fontSize: 14, lineHeight: 21.7 },
  bar: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 24, marginTop: 32, paddingBottom: 24, borderBottomWidth: 1 },
  dt: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, letterSpacing: 1.1, textTransform: "uppercase" },
  big: { marginTop: 8, fontFamily: FONT.heading, fontSize: 28, lineHeight: 28, letterSpacing: -0.56 },
  tabs: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 18 },
  tab: { paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: "transparent" },
  tabText: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, letterSpacing: 1.1, textTransform: "uppercase" },
});
