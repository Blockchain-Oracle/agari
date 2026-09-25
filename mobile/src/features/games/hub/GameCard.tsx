import { router, type Href } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { GAMES } from "@/features/games/copy";
import { Skeleton } from "~/components/kit";
import { Badge, Econ, Press, useGamesTokens } from "~/features/games/frame";
import { useGames, type GameEntry } from "~/features/games/shell";
import { FONT } from "~/theme";
import type { CardStatus } from "./useHubStatus";

/**
 * web's `GameCard` (`.gm-card`): the mode's icon, name and status badge, its blurb, the honest economic label
 * and what it waits on, who is in it, and "Open". Only a playable mode is a touch target; a pending or
 * unavailable one sits at 72 % and says why.
 */
export function GameCard({ entry, status, presence }: { entry: GameEntry; status: CardStatus; presence: string | null }) {
  const { t, color } = useGamesTokens();
  const { feedback } = useGames();
  const openable = status.kind === "live" || status.kind === "loading" || status.kind === "after-hours";
  const note = status.kind === "pending" ? GAMES.card.waitingOn(status.dependency) : status.kind === "unavailable" ? status.why : status.kind === "after-hours" ? status.note : null;
  const Icon = entry.nav.icon;

  const body = (
    <>
      <View style={styles.head}>
        <View style={[styles.icon, { backgroundColor: t.iconWash }]}>
          <Icon size={15} color={color.accent} strokeWidth={2} />
        </View>
        <Text style={[styles.name, { color: color.ink }]} numberOfLines={1}>
          {entry.nav.name}
        </Text>
        <StatusBadge status={status} />
      </View>
      <Text style={[styles.blurb, { color: color.inkSecondary }]}>{entry.nav.description}</Text>
      <View style={styles.foot}>
        <Econ kind={entry.descriptor.economicKind} label={entry.descriptor.economicLabel} />
        {note ? <Text style={[styles.waiting, { color: color.inkMuted }]}>{note}</Text> : null}
        {status.kind === "loading" ? <Skeleton width={96} height={12} /> : null}
      </View>
      {presence ? <Text style={[styles.presence, { color: color.inkSecondary }]}>{presence}</Text> : null}
    </>
  );

  const ground = { backgroundColor: t.cardBg, borderColor: t.cardBorder };
  if (!openable) {
    return (
      <View style={[styles.card, ground, styles.pending]} accessibilityState={{ disabled: true }}>
        {body}
      </View>
    );
  }
  return (
    <Press
      onPress={() => {
        feedback("tap");
        router.push(entry.nav.href as Href);
      }}
      accessibilityRole="link"
      accessibilityLabel={`${entry.nav.name}. ${entry.nav.description} ${entry.descriptor.economicLabel}.${note ? ` ${note}.` : ""}`}
      style={(pressed) => [styles.card, ground, pressed && { borderColor: t.cardHoverBorder }]}
    >
      {body}
      <Text style={[styles.open, { color: color.accent }]}>{GAMES.card.open.toUpperCase()}</Text>
    </Press>
  );
}

function StatusBadge({ status }: { status: CardStatus }) {
  if (status.kind === "loading") return <View style={styles.push}><Skeleton width={56} height={16} radius={9999} /></View>;
  if (status.kind === "live") return <Badge label={GAMES.card.liveBadge} tone="live" />;
  if (status.kind === "after-hours") return <Badge label={GAMES.card.afterHoursBadge} tone="after" />;
  return <Badge label={status.kind === "unavailable" ? GAMES.card.unavailableBadge : GAMES.card.pendingBadge} tone="quiet" />;
}

const styles = StyleSheet.create({
  card: { gap: 10, borderRadius: 16, padding: 20, borderWidth: 1 },
  pending: { opacity: 0.72 },
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  icon: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  name: { flexShrink: 1, fontFamily: FONT.heading, fontSize: 15, lineHeight: 24 },
  push: { marginLeft: "auto" },
  blurb: { fontFamily: FONT.body, fontSize: 13, lineHeight: 20.8 },
  foot: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  waiting: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 15 },
  presence: { marginTop: 6, fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 15 },
  open: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 0.8 },
});
