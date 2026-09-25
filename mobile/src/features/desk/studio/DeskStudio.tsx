import type { Address } from "@agari/core/types";
import { ArrowLeft, ArrowRight } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";
import { DESK } from "@/features/desk/copy";
import { draftFromMandate, draftKey, draftStorageKey, draftToMandate, draftTotalBps, initialDraft, type StudioDraft } from "@/features/desk/draft";
import { STUDIO } from "@/features/desk/studio/copy-studio";
import type { StudioActions } from "@/features/desk/useDeskWrites";
import { ExplorePage } from "~/features/explore/ExplorePage";
import { FONT, useTheme } from "~/theme";
import { CHROME } from "~/theme/chrome";
import type { NativeDeskView as DeskView } from "../native-view";
import { useDeskClock } from "../useDeskClock";
import { BasketPicker } from "./BasketChoice";
import { CreateStep } from "./CreateStep";
import { FirstSteps } from "./FirstSteps";
import { StBtn, T } from "./kit-bits";
import { slideIn } from "./kit-motion";
import { StepProgress } from "./kit-steps";
import { LimitsForm } from "./LimitsForm";
import { StudioSide } from "./StudioSide";
import { READ_IDLE, TestRead, type ReadState } from "./TestRead";

const S = DESK.studio;

export interface DeskStudioProps {
  owner: Address | null;
  view: DeskView | null;
  writes: StudioActions;
  /** `?basket=AILABS` from the baskets screen, or a preset id. */
  initialBasket: string | null;
  editing: boolean;
  onConnect: () => void;
}

/**
 * web's DeskStudio.tsx at phone width: the hero, the step rail, then 01 the basket, 02 how strict and the limits, 03
 * the test read, 04 create, with Back and Continue under the step and the side card last. Drafting is open to
 * anyone; the draft is kept on this phone per owner, under web's own key.
 */
export function DeskStudio({ owner, view, writes, initialBasket, editing, onConnect }: DeskStudioProps) {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  const { nowSec, zone } = useDeskClock();
  const [draft, setDraftState] = useState<StudioDraft>(() => (editing && view?.mandate ? draftFromMandate(view.mandate) : initialDraft(initialBasket)));
  const [step, setStep] = useState(1);
  const [problem, setProblem] = useState<string | null>(null);
  const [read, setRead] = useState<ReadState>(READ_IDLE);
  const [created, setCreated] = useState(false);
  const storageKey = draftStorageKey(owner);

  // The saved draft returns after mount; an edit starts from the mandate, a basket link from that basket.
  useEffect(() => {
    if (editing || initialBasket) return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) setDraftState({ ...initialDraft(null), ...(JSON.parse(raw) as Partial<StudioDraft>) });
    } catch {
      // storage unavailable: the default draft stands
    }
  }, [storageKey, editing, initialBasket]);
  const setDraft = (update: (d: StudioDraft) => StudioDraft) =>
    setDraftState((d) => {
      const next = update(d);
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // storage unavailable
      }
      return next;
    });

  const result = useMemo(() => draftToMandate(draft), [draft]);
  const mandate = result.ok ? result.mandate : null;
  const readStanding = read.status === "done" ? (read.key === draftKey(draft) ? "done" : "stale") : "none";

  const go = (n: number) => {
    setProblem(null);
    setStep(n);
  };
  const advance = () => {
    if (step === 1 && draftTotalBps(draft) !== 10_000) return setProblem(S.basket.mustAddUp);
    if (step === 2 && !result.ok) return setProblem(`${result.problems.join(". ")}.`);
    go(Math.min(4, step + 1));
  };

  if (created) return <FirstSteps isLive={view?.isLive ?? false} onMoney={null} />;
  const head = editing && view?.exists ? S.edit : { kicker: S.kicker, title: S.title, body: S.body };

  return (
    <ExplorePage title={S.title} style={styles.page}>
      <View style={styles.hero}>
        <Text style={[T.eyebrow, { color: color.inkMuted }]}>{DESK.eyebrow.studio}</Text>
        <Text style={[T.caption, { color: color.accent }]}>{head.kicker}</Text>
        <Text style={[T.title, { color: color.ink }]} accessibilityRole="header">
          {head.title}
        </Text>
        <Text style={[T.body, { color: color.inkSecondary }]}>{head.body}</Text>
      </View>
      <StepProgress steps={STUDIO.steps} current={step} onPick={go} label={S.stepsAria} />
      <View style={styles.studio}>
        <View style={styles.main}>
          <Animated.View key={step} entering={reduce ? undefined : slideIn({ axis: "x", distance: 16, duration: 220 })} style={styles.main}>
            <View style={styles.stepTitle} accessibilityRole="header">
              <Text style={[styles.stepN, { color: color.accent }]}>{String(step).padStart(2, "0")}</Text>
              <Text style={[styles.stepText, { color: color.ink }]}>{S.steps[step - 1]}</Text>
            </View>
            {step === 1 ? <BasketPicker draft={draft} setDraft={setDraft} /> : null}
            {step === 2 ? <LimitsForm draft={draft} setDraft={setDraft} mandate={mandate} /> : null}
            {step === 3 ? <TestRead draft={draft} setDraft={setDraft} mandate={mandate} owner={owner} view={view} writes={writes} read={read} setRead={setRead} onConnect={onConnect} zone={zone} nowSec={nowSec} /> : null}
            {step === 4 ? (
              <CreateStep draft={draft} mandate={mandate} owner={owner} view={view} writes={writes} editing={editing} problems={result.ok ? [] : result.problems} onConnect={onConnect} onCreated={() => setCreated(true)} zone={zone} nowSec={nowSec} />
            ) : null}
          </Animated.View>
          {problem ? (
            <Text style={[T.caption, { color: color.warning }]} accessibilityRole="alert">
              {problem}
            </Text>
          ) : null}
          <View style={[styles.actions, { borderTopColor: color.hairline }]}>
            {step > 1 ? <StBtn label={STUDIO.nav.back} before={ArrowLeft} onPress={() => go(step - 1)} /> : <View />}
            {step < 4 ? <StBtn label={step === 3 && readStanding !== "done" ? STUDIO.nav.nextWithoutRead : STUDIO.nav.next} after={ArrowRight} primary onPress={advance} style={styles.next} /> : null}
          </View>
        </View>
        <StudioSide draft={draft} mandate={mandate} read={readStanding} />
      </View>
    </ExplorePage>
  );
}

const styles = StyleSheet.create({
  page: { paddingTop: 28, paddingBottom: 64 + CHROME.dockClearance, gap: 20 },
  hero: { gap: 8 },
  studio: { gap: 24 },
  main: { gap: 24 },
  stepTitle: { flexDirection: "row", alignItems: "baseline", gap: 12 },
  stepN: { fontFamily: FONT.dataStrong, fontSize: 13, lineHeight: 20.8 },
  stepText: { flexShrink: 1, fontFamily: FONT.headingHeavy, fontSize: 19, lineHeight: 30.4, letterSpacing: -0.38 },
  actions: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingTop: 20, borderTopWidth: 1 },
  next: { flexShrink: 1 },
});
