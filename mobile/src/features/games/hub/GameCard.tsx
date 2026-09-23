import { router, type Href } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { GAMES } from "@/features/games/copy";
import { Skeleton } from "~/components/kit";
import { EconLabel, useGames, type GameEntry } from "~/features/games/shell";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";
import type { CardStatus } from "./useHubStatus";

/**
 * web's `GameCard`: one mode as the hub knows it right now. The symbol, the name and its status badge, the
 * blurb, the honest economic label, what it waits on (if anything), and who is in it. Only a playable mode
 * is a touch target; a pending or unavailable one says why and does not pretend to open.
 */
export function GameCard({ entry, status, presence }: { entry: GameEntry; status: CardStatus; presence: string | null }) {
  const { color } = useTheme();
  const { feedback } = useGames();
  const openable = status.kind === "live" || status.kind === "loading" || status.kind === "after-hours";
  const note = status.kind === "pending" ? GAMES.card.waitingOn(status.dependency) : status.kind === "unavailable" ? status.why : status.kind === "after-hours" ? status.note : null;

  const body = (
    <>
      <View style={styles.head}>
        <View style={[styles.icon, { backgroundColor: openable ? color.accentWash : color.surface2 }]}>
          <SymbolView name={entry.nav.icon} size={20} tintColor={openable ? color.accent : color.inkMuted} />
        </View>
        <Text style={[TYPE.title, styles.name, { color: color.ink }]} numberOfLines={1}>
          {entry.nav.name}
        </Text>
        <StatusBadge status={status} />
      </View>
      <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{entry.nav.description}</Text>
      <View style={styles.foot}>
        <EconLabel kind={entry.descriptor.economicKind} label={entry.descriptor.economicLabel} />
        {status.kind === "loading" ? <Skeleton width={96} height={12} /> : null}
      </View>
      {note ? <Text style={[TYPE.caption, { color: color.inkMuted }]}>{note}</Text> : null}
      {presence ? (
        <View style={styles.presence}>
          <View style={[styles.presenceDot, { backgroundColor: presence === GAMES.card.roomDown ? color.loss : presence === GAMES.card.nobody ? color.inkMuted : color.profit }]} />
          <Text style={[styles.presenceText, { color: color.inkSecondary }]}>{presence}</Text>
        </View>
      ) : null}
    </>
  );

  if (!openable) {
    return (
      <View style={[styles.card, { backgroundColor: color.surface1, borderColor: color.hairline, opacity: 0.72 }]} accessibilityState={{ disabled: true }}>
        {body}
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => {
        feedback("tap");
        router.push(entry.nav.href as Href);
      }}
      accessibilityRole="button"
      accessibilityLabel={`${entry.nav.name}. ${entry.nav.description} ${entry.descriptor.economicLabel}.${note ? ` ${note}.` : ""}`}
      accessibilityHint={GAMES.card.open}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: color.surface1, borderColor: pressed ? color.accentDim : color.hairline },
        pressed && styles.pressed,
      ]}
    >
      {body}
      <View style={styles.open}>
        <Text style={[styles.openText, { color: color.accent }]}>{GAMES.card.open.toUpperCase()}</Text>
        <SymbolView name={{ ios: "arrow.right", android: "arrow_forward" }} size={12} tintColor={color.accent} />
      </View>
    </Pressable>
  );
}

/** web's `.gm-badge`: live in the profit colour, 24/7-only in warning, the rest quiet. */
function StatusBadge({ status }: { status: CardStatus }) {
  const { color } = useTheme();
  if (status.kind === "loading") return <Skeleton width={52} height={20} radius={RADIUS.full} />;
  const [label, ink] =
    status.kind === "live"
      ? [GAMES.card.liveBadge, color.profit]
      : status.kind === "after-hours"
        ? [GAMES.card.afterHoursBadge, color.warning]
        : status.kind === "unavailable"
          ? [GAMES.card.unavailableBadge, color.inkMuted]
          : [GAMES.card.pendingBadge, color.inkMuted];
  return (
    <View style={[styles.badge, { borderColor: ink }]}>
      <Text style={[styles.badgeText, { color: ink }]} numberOfLines={1}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.lg, padding: 14, gap: 10 },
  pressed: { transform: [{ scale: 0.99 }] },
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  name: { flex: 1 },
  badge: { borderWidth: 1, borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontFamily: FONT.data, fontSize: 9.5, letterSpacing: 0.8 },
  foot: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  presence: { flexDirection: "row", alignItems: "center", gap: 6 },
  presenceDot: { width: 6, height: 6, borderRadius: 3 },
  presenceText: { fontFamily: FONT.data, fontSize: 11.5 },
  open: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-end" },
  openText: { fontFamily: FONT.data, fontSize: 11, letterSpacing: 1.2 },
});
