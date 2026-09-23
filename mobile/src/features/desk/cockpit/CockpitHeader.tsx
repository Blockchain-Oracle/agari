import { nameOf, presetById } from "@agari/core/desk";
import { StyleSheet, Text, View } from "react-native";
import { COCKPIT } from "@/features/desk/cockpit/copy-cockpit";
import { DESK } from "@/features/desk/copy";
import type { NativeDeskView as DeskView } from "../native-view";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { FONT, TYPE, useTheme } from "~/theme";
import { Eyebrow, LogoStack, StatusDot, type DotTone } from "../kit";

/** The dot's tone: live desks breathe, practice is the accent, a pause or a loss stop warns, a closed desk is still. */
export function stateTone(view: DeskView): DotTone {
  if (view.state === "stopped_by_loss_limit") return "stopped";
  if (view.state === "paused_by_owner" || view.state === "needs_attention") return "warn";
  if (view.state === "closed") return "quiet";
  return view.isLive ? "live" : "practice";
}

/** What the desk holds by name: the preset's basket, or the owner's own mix. */
export function basketOf(view: DeskView): { name: string; basket: string | null; members: string[] } {
  const m = view.mandate;
  const preset = m?.preset ? presetById(m.preset) : undefined;
  const members = m?.targets.tokens.map((t) => t.symbol) ?? view.holdings.map((h) => h.symbol);
  return { name: preset?.name ?? COCKPIT.ownMix, basket: preset?.basket ?? null, members };
}

/**
 * The cockpit's head (web's cockpit/CockpitHeader.tsx): the basket's cluster mark, "AI Labs desk" (a visitor reads
 * "A desk") with 机に任せる, the state dot with the mode, and the members as logos.
 */
export function CockpitHeader({ view }: { view: DeskView }) {
  const { color } = useTheme();
  const b = basketOf(view);
  const title = view.isOwner ? COCKPIT.deskOf(b.name) : DESK.visitorTitle;
  const showState = view.state !== "active" && view.state !== "practice";
  const names = b.members.map((s) => nameOf(s as never));
  return (
    <View style={styles.head}>
      <Eyebrow text={view.eyebrow} live={view.isLive} />
      <View style={styles.id}>
        {b.basket ? <AssetDisc asset={b.basket} size={48} /> : <LogoStack symbols={b.members} size={30} max={3} />}
        <View style={styles.titles}>
          <Text style={[TYPE.headline, { color: color.ink }]} accessibilityRole="header" numberOfLines={2}>
            {title}
          </Text>
          <Text style={[styles.jp, { color: color.inkMuted }]}>{DESK.titleJp}</Text>
        </View>
      </View>
      <View style={styles.meta}>
        <StatusDot tone={stateTone(view)} label={showState ? view.stateText : DESK.modes[view.mode]} />
        {showState ? <Text style={[TYPE.caption, { color: color.inkMuted }]}>{DESK.modes[view.mode]}</Text> : null}
      </View>
      <View style={styles.members}>
        <LogoStack symbols={b.members} size={20} max={4} names={names} />
        <Text style={[TYPE.caption, styles.memberText, { color: color.inkSecondary }]} numberOfLines={2}>
          {!view.isOwner && b.name !== COCKPIT.ownMix ? `${b.name} · ` : ""}
          {names.join(", ")}
        </Text>
      </View>
      {!view.isOwner ? <Text style={[TYPE.caption, { color: color.inkMuted }]}>{DESK.visitor}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { gap: 10 },
  id: { flexDirection: "row", alignItems: "center", gap: 12 },
  titles: { flex: 1, gap: 2 },
  jp: { fontFamily: FONT.stamp, fontSize: 14 },
  meta: { flexDirection: "row", alignItems: "center", gap: 10 },
  members: { flexDirection: "row", alignItems: "center", gap: 8 },
  memberText: { flex: 1 },
});
