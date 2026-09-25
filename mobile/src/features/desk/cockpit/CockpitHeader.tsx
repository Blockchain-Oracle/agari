import { nameOf, presetById } from "@agari/core/desk";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { COCKPIT } from "@/features/desk/cockpit/copy-cockpit";
import { DESK } from "@/features/desk/copy";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { FONT } from "~/theme";
import type { NativeDeskView as DeskView } from "../native-view";
import { DT, Eyebrow, LogoStack, StatusDot, useDeskTheme, type DotTone } from "../kit";

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
 * The cockpit's head (web's cockpit/CockpitHeader.tsx, `.cp-head` at ≤ 720 px, one column): the basket's 52 px cluster
 * mark beside the eyebrow, "AI Labs desk" (a visitor reads "A desk") with 机に任せる。, the state dot and the members;
 * then the owner's toolbar (or a visitor's way to their own desk) and, for a visitor, the read-only line.
 */
export function CockpitHeader({ view, actions }: { view: DeskView; actions: ReactNode }) {
  const { color, t } = useDeskTheme();
  const b = basketOf(view);
  const title = view.isOwner ? COCKPIT.deskOf(b.name) : DESK.visitorTitle;
  const showState = view.state !== "active" && view.state !== "practice";
  const names = b.members.map((s) => nameOf(s as never));
  return (
    <View style={styles.head}>
      <View style={styles.id}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {b.basket ? (
            <View style={[styles.disc, { boxShadow: `0 8px 28px ${t.headGlow}` }]}>
              <View style={styles.clip}>
                <AssetDisc asset={b.basket} size={52} />
              </View>
            </View>
          ) : (
            <LogoStack symbols={b.members} size="lg" max={3} />
          )}
        </View>
        <View style={styles.text}>
          <Eyebrow text={view.eyebrow} live={view.isLive} />
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: color.ink }]} accessibilityRole="header">
              {title}
            </Text>
            <Text style={[DT.titleJp, { color: color.inkMuted }]}>{DESK.titleJp}</Text>
          </View>
          <View style={styles.meta}>
            <StatusDot tone={stateTone(view)} label={showState ? view.stateText : DESK.modes[view.mode]} />
            {showState ? <Text style={[styles.mode, { color: color.inkSecondary }]}>{DESK.modes[view.mode]}</Text> : null}
            <View style={styles.members}>
              <LogoStack symbols={b.members} size="sm" max={4} names={names} />
              <Text style={[styles.memberText, { color: color.inkSecondary }]}>
                {!view.isOwner && b.name !== COCKPIT.ownMix ? `${b.name} · ` : ""}
                {names.join(", ")}
              </Text>
            </View>
          </View>
        </View>
      </View>
      {actions}
      {!view.isOwner ? <Text style={[DT.caption, { color: color.inkMuted }]}>{DESK.visitor}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { gap: 16 },
  id: { flexDirection: "row", alignItems: "center", gap: 16 },
  disc: { width: 52, height: 52, borderRadius: 15 },
  clip: { width: 52, height: 52, borderRadius: 15, overflow: "hidden" },
  text: { flex: 1, minWidth: 0, gap: 6 },
  titleRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", columnGap: 10 },
  title: { fontFamily: FONT.headingHeavy, fontSize: 26, lineHeight: 27.3, letterSpacing: -0.52 },
  meta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", rowGap: 8, columnGap: 12 },
  mode: { fontFamily: FONT.body, fontSize: 11, lineHeight: 17.6, letterSpacing: 0.66, textTransform: "uppercase" },
  members: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  memberText: { flexShrink: 1, fontFamily: FONT.body, fontSize: 12.5, lineHeight: 20 },
});
