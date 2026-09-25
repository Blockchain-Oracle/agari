import * as Clipboard from "expo-clipboard";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { WALLET_MODAL } from "@/providers/wallet/copy";
import { emojiAvatarFor, formatAccountAddress } from "@/providers/wallet/emoji-avatar";
import { useWalletSession } from "@/lib/wallet-session";
import { haptic } from "~/components/kit";
import { CopiedIcon, CopyIcon, DisconnectIcon } from "~/components/wallet/profile-icons";
import { CloseButton } from "~/components/wallet/sheet-parts";
import type { DrawerClose } from "~/components/drawer/BottomDrawer";
import { dismiss, WalletSheet } from "~/components/wallet/WalletSheet";
import { AVATAR_COLORS, FONT, useTheme } from "~/theme";

const COPIED_MS = 1_500;
const T = WALLET_MODAL.profile;

/**
 * web `AccountModal` (RainbowKit's `ProfileDetails`) in its phone sheet: the 82 pt emoji avatar, the short address
 * at 20, and Copy Address / Disconnect as two surface-2 tiles. Nothing else — web's modal carries no balances.
 */
export default function AccountSheet() {
  const { color } = useTheme();
  const session = useWalletSession();
  const [copied, setCopied] = useState(false);
  const drawer = useRef<DrawerClose | null>(null);
  const close = (after?: () => void) => (drawer.current ? drawer.current(after) : (dismiss(), after?.()));
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);
  const address = session.address;
  const avatar = address ? emojiAvatarFor(address) : null;

  return (
    <WalletSheet closeRef={drawer}>
      {address && avatar ? (
        <View style={[styles.profile, { backgroundColor: color.surface1 }]}>
          <View style={styles.close}>
            <CloseButton onPress={() => close()} />
          </View>
          <View style={styles.id}>
            <View style={[styles.avatar, { backgroundColor: AVATAR_COLORS[Number(avatar.colorClass.slice("wm-ava-".length))] ?? AVATAR_COLORS[0] }]} accessibilityElementsHidden>
              <Text style={styles.emoji}>{avatar.emoji}</Text>
            </View>
            {/* Base58 is shown exactly as written, never re-cased (D-010). */}
            <Text style={[styles.name, { color: color.ink }]} accessibilityRole="header" accessibilityLabel={address}>
              {formatAccountAddress(address)}
            </Text>
          </View>
          <View style={styles.actions}>
            <Action
              label={copied ? T.copied : T.copy}
              icon={copied ? <CopiedIcon color={color.ink} /> : <CopyIcon color={color.ink} />}
              onPress={() => {
                void Clipboard.setStringAsync(address).then(() => setCopied(true));
              }}
            />
            <Action
              label={T.disconnect}
              icon={<DisconnectIcon color={color.ink} />}
              onPress={() => {
                close(() => void session.disconnect());
              }}
            />
          </View>
        </View>
      ) : null}
    </WalletSheet>
  );
}

function Action({ label, icon, onPress }: { label: string; icon: ReactNode; onPress: () => void }) {
  const { color } = useTheme();
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.action, { backgroundColor: color.surface2 }, pressed && styles.shrink]}
    >
      <View style={styles.actionIcon}>{icon}</View>
      <Text style={[styles.actionLabel, { color: color.ink }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // .wm-profile: padding 16; its close at right 16, top 16
  profile: { padding: 16 },
  close: { position: "absolute", right: 16, top: 16, zIndex: 1 },
  id: { alignItems: "center", justifyContent: "center", gap: 16, margin: 8 },
  avatar: { width: 82, height: 82, borderRadius: 9999, marginTop: 24, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  emoji: { fontSize: 45, lineHeight: 54 },
  name: { fontFamily: FONT.bodyHeavy, fontSize: 20, lineHeight: 24, textAlign: "center" },
  actions: { flexDirection: "row", gap: 8, margin: 2, marginTop: 16 },
  action: { flex: 1, padding: 6, paddingTop: 8, borderRadius: 8, alignItems: "center", justifyContent: "center", gap: 1 },
  actionIcon: { height: 16, justifyContent: "center" },
  actionLabel: { fontFamily: FONT.bodyStrong, fontSize: 12, lineHeight: 18 },
  shrink: { transform: [{ scale: 0.9 }] },
});
