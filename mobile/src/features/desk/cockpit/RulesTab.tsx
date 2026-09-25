import { describeTargets, nameOf } from "@agari/core/desk";
import { router, type Href } from "expo-router";
import { CalendarClock, Coins, Cpu, Hand, NotebookPen, PencilLine, PieChart, ShieldAlert, ShieldCheck, TrendingUp, Waves, type LucideIcon } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { COCKPIT } from "@/features/desk/cockpit/copy-cockpit";
import { DESK } from "@/features/desk/copy";
import { limitSentences } from "@/features/desk/draft";
import { FONT } from "~/theme";
import type { NativeDeskView as DeskView } from "../native-view";
import { brandColor, DT, LogoStack, Panel, PartitionBar, useDeskTheme } from "../kit";
import { basketOf } from "./CockpitHeader";

const R = COCKPIT.rules;
/** `limitSentences` returns the seven rules in a fixed order: wander, one company, one action, a day, premium, loss, ask. */
const RULE_ICONS: readonly LucideIcon[] = [Waves, PieChart, Coins, CalendarClock, TrendingUp, ShieldAlert, Hand];

/** `.cp-rule`: the limit's icon tile, the sentence and a badge naming who enforces it. */
function Rule({ text, by, Icon }: { text: string; by: "program" | "code"; Icon: LucideIcon }) {
  const { color, t } = useDeskTheme();
  const program = by === "program";
  const Badge = program ? ShieldCheck : Cpu;
  return (
    <View style={[styles.rule, { backgroundColor: color.surface1, borderColor: program ? t.ruleProgram : color.hairline }]}>
      <View style={[styles.ruleIcon, { backgroundColor: program ? color.accentWash : color.surface2 }]}>
        <Icon size={18} color={program ? color.accent : color.inkSecondary} />
      </View>
      <View style={styles.ruleBody}>
        <Text style={[styles.ruleText, { color: color.ink }]}>{text}</Text>
        <View style={[styles.badge, program ? { borderColor: color.accentDim, backgroundColor: color.accentWash } : { borderColor: color.hairline }]}>
          <Badge size={12} color={program ? color.accent : color.inkMuted} />
          <Text style={[styles.badgeText, { color: program ? color.accent : color.inkMuted }]}>{program ? R.program : R.code}</Text>
        </View>
      </View>
    </View>
  );
}

/** web's MandatePanel.tsx `RulesTab`: the basket, each limit as a card saying who enforces it, notes and Edit, the promise. */
export function RulesTab({ view }: { view: DeskView }) {
  const { color } = useDeskTheme();
  const M = DESK.page.mandate;
  const m = view.mandate;
  const b = basketOf(view);
  return (
    <View style={styles.rules}>
      {m ? (
        <Panel title={R.basket} aside={<Text style={[DT.caption, { color: color.inkMuted }]}>{M.version(view.wire.mandate?.version ?? 1)}</Text>}>
          <View style={styles.basket}>
            <LogoStack symbols={b.members} size="lg" max={5} names={b.members.map((s) => nameOf(s as never))} />
            <View style={styles.basketText}>
              <Text style={[styles.basketName, { color: color.ink }]}>{b.name}</Text>
              <Text style={[DT.caption, { color: color.inkSecondary }]}>{describeTargets(m.targets)}</Text>
            </View>
          </View>
          <PartitionBar
            label={describeTargets(m.targets)}
            height={10}
            slices={[...m.targets.tokens.map((tk) => ({ id: tk.symbol, label: nameOf(tk.symbol), value: tk.weightBps, color: brandColor(tk.symbol, color) })), { id: "cash", label: COCKPIT.overview.cash, value: m.targets.cashBps, color: color.inkMuted }]}
          />
        </Panel>
      ) : null}
      {m ? (
        <View style={styles.grid}>
          {limitSentences(m).map((s, i) => (
            <Rule key={s.text} text={s.text} by={s.by} Icon={RULE_ICONS[i] ?? Hand} />
          ))}
        </View>
      ) : null}
      {m && view.isOwner ? (
        <Panel
          title={M.notes}
          aside={
            <Pressable onPress={() => router.push("/desk/new?edit=1" as Href)} accessibilityRole="link" hitSlop={8} style={styles.edit}>
              <PencilLine size={14} color={color.accent} />
              <Text style={[styles.editText, { color: color.accent }]}>{R.edit}</Text>
            </Pressable>
          }
        >
          <View style={styles.notes}>
            <NotebookPen size={16} color={color.inkMuted} style={styles.lineIcon} />
            <Text style={[styles.notesText, { color: color.inkSecondary }]}>{m.notes || M.noNotes}</Text>
          </View>
          <Text style={[DT.caption, { color: color.inkMuted }]}>{M.editNote}</Text>
        </Panel>
      ) : null}
      <Panel title={DESK.promise.title}>
        <View style={styles.promise}>
          {DESK.promise.points.map((point) => (
            <View key={point} style={styles.promiseRow}>
              <ShieldCheck size={16} color={color.profit} style={styles.lineIcon} />
              <Text style={[styles.promiseText, { color: color.inkSecondary }]}>{point}</Text>
            </View>
          ))}
        </View>
        <Text style={[DT.caption, { color: color.inkMuted }]}>{DESK.promise.worstCase}</Text>
      </Panel>
    </View>
  );
}

const styles = StyleSheet.create({
  rules: { gap: 16 },
  basket: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 14 },
  basketText: { flex: 1, minWidth: 0, gap: 2 },
  basketName: { fontFamily: FONT.headingHeavy, fontSize: 16, lineHeight: 25.6 },
  grid: { gap: 10 },
  rule: { flexDirection: "row", columnGap: 12, padding: 16, borderWidth: 1, borderRadius: 14 },
  ruleIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  ruleBody: { flex: 1, minWidth: 0, gap: 8 },
  ruleText: { fontFamily: FONT.bodyStrong, fontSize: 14.5, lineHeight: 20.3 },
  badge: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingVertical: 3, paddingHorizontal: 9, borderRadius: 9999, borderWidth: 1 },
  badgeText: { fontFamily: FONT.body, fontSize: 10.5, lineHeight: 16.8, letterSpacing: 0.63, textTransform: "uppercase" },
  edit: { flexDirection: "row", alignItems: "center", gap: 6 },
  editText: { fontFamily: FONT.bodyStrong, fontSize: 13 },
  notes: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  notesText: { flex: 1, fontFamily: FONT.body, fontSize: 14, lineHeight: 22.4 },
  lineIcon: { marginTop: 2 },
  promise: { gap: 10 },
  promiseRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  promiseText: { flex: 1, fontFamily: FONT.body, fontSize: 13.5, lineHeight: 20.25 },
});
