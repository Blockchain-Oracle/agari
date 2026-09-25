import type { Address } from "@agari/core/types";
import { keys, useWalletHistory } from "@agari/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useMoneyUnits } from "@/features/activity/useActivity";
import { PROFILE } from "@/features/profile/copy";
import { useWalletSession } from "@/lib/wallet-session";
import { Button, haptic, Screen } from "~/components/kit";
import { HueAvatar } from "~/features/social/HueAvatar";
import { StatBar } from "~/features/ticker-hub/HubParts";
import { explorerUrl, openExternal } from "~/lib/external";
import { FONT, TYPE, useTheme } from "~/theme";
import { ProfileCalls, ProfileRecord } from "./ProfileSections";

const TAIL = 4;
const LEAD = 6;

/**
 * `/u/[address]` — web's `ProfileScreen` (features/profile/ProfileScreen.tsx): identity (the address and its hue),
 * copy / Explorer / copy this trader, then the record, the edge excerpt, open calls and takes. Every figure is public
 * index data; nothing here needs a signature.
 */
export function ProfileScreen({ address }: { address: Address }) {
  const { color } = useTheme();
  const { address: viewer } = useWalletSession();
  const own = viewer === address;
  const units = useMoneyUnits();
  const history = useWalletHistory(address);
  const queryClient = useQueryClient();
  const retry = useCallback(() => void queryClient.invalidateQueries({ queryKey: keys.history(address) }), [address, queryClient]);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await Clipboard.setStringAsync(address);
    haptic.success();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: keys.history(address) }),
      queryClient.invalidateQueries({ queryKey: keys.positions(address) }),
      queryClient.invalidateQueries({ queryKey: ["agari", "takes", "authors", address] }),
    ]);

  return (
    <Screen title={own ? PROFILE.eyebrowYou : PROFILE.eyebrow} onRefresh={refresh}>
      <View style={styles.head}>
        <View style={styles.live}>
          <View style={[styles.liveDot, { backgroundColor: color.accent }]} />
          <Text style={[styles.eyebrow, { color: color.accent }]}>{(own ? PROFILE.eyebrowYou : PROFILE.eyebrow).toUpperCase()}</Text>
        </View>
        <View style={styles.ident}>
          <HueAvatar address={address} size={52} />
          <Text style={[TYPE.headline, styles.title, { color: color.ink }]} accessibilityRole="header" accessibilityLabel={address} selectable>
            {address.slice(0, LEAD)}…<Text style={{ color: color.accent }}>{address.slice(-TAIL)}</Text>
          </Text>
        </View>
        <Text style={[styles.jp, { color: color.inkMuted }]}>{PROFILE.headingJp}</Text>
        <Text style={[TYPE.body, { color: color.inkSecondary }]}>{PROFILE.intro}</Text>
      </View>

      <StatBar
        actions={
          <View style={styles.actions}>
            <View style={styles.tabs}>
              <Button
                label={copied ? PROFILE.copied : PROFILE.copy}
                variant="outline"
                size="sm"
                block={false}
                icon={copied ? { ios: "checkmark", android: "check" } : { ios: "doc.on.doc", android: "content_copy" }}
                onPress={() => void copy()}
              />
              <Button
                label={PROFILE.explorer.replace(/\s*↗$/, "")}
                variant="outline"
                size="sm"
                block={false}
                icon={{ ios: "arrow.up.right.square", android: "open_in_new" }}
                onPress={() => void openExternal(explorerUrl("address", address))}
              />
              {!own ? (
                <Button
                  label={PROFILE.copyTrader}
                  variant="outline"
                  size="sm"
                  block={false}
                  icon={{ ios: "square.on.square", android: "file_copy" }}
                  onPress={() => router.push({ pathname: "/strategies" as never, params: { copy: address } })}
                />
              ) : null}
            </View>
          </View>
        }
      >
        {null}
      </StatBar>

      <ProfileRecord address={address} reading={history} retry={retry} symbol={units.symbol} own={own} />
      <ProfileCalls address={address} units={units} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: 10 },
  live: { flexDirection: "row", alignItems: "center", gap: 8 },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  eyebrow: { fontFamily: FONT.data, fontSize: 10.5, letterSpacing: 1.8 },
  ident: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { flex: 1 },
  jp: { fontFamily: FONT.stamp, fontSize: 15, letterSpacing: 1 },
  actions: { gap: 12, flex: 1 },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
