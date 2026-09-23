import type { Address } from "@agari/core/types";
import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DESK } from "@/features/desk/copy";
import { draftFromMandate, draftKey, draftStorageKey, draftToMandate, draftTotalBps, initialDraft, type StudioDraft } from "@/features/desk/draft";
import { STUDIO } from "@/features/desk/studio/copy-studio";
import type { StudioActions } from "@/features/desk/useDeskWrites";
import type { NativeDeskView as DeskView } from "../native-view";
import { Button, haptic, Screen } from "~/components/kit";
import { SPACE, TYPE, useTheme } from "~/theme";
import { Eyebrow, StepProgress } from "../kit";
import { useDeskClock } from "../useDeskClock";
import { BasketChoice } from "./BasketChoice";
import { CreateStep } from "./CreateStep";
import { FirstSteps } from "./FirstSteps";
import { LimitsStep } from "./LimitsStep";
import { StudioSide } from "./StudioSide";
import { READ_IDLE, TestReadStep, type ReadState } from "./TestReadStep";
import { WeightEditor } from "./WeightEditor";

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
 * The studio (web's DeskStudio.tsx) as a native four-step flow: 01 the basket, 02 how strict and the limits, 03 the
 * test read, 04 create. The progress rail sits on top, Back and Continue at the thumb, the side card under each step.
 * Drafting is open to anyone; the draft is kept on this phone per owner, under web's own key.
 */
export function DeskStudio({ owner, view, writes, initialBasket, editing }: DeskStudioProps) {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const { nowSec, zone } = useDeskClock();
  const scroll = useRef<ScrollView>(null);
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
    haptic.select();
    scroll.current?.scrollTo({ y: 0, animated: !reduce });
  };
  const advance = () => {
    if (step === 1 && draftTotalBps(draft) !== 10_000) {
      haptic.error();
      return setProblem(S.basket.mustAddUp);
    }
    if (step === 2 && !result.ok) {
      haptic.error();
      return setProblem(`${result.problems.join(". ")}.`);
    }
    go(Math.min(4, step + 1));
  };

  if (created) return <FirstSteps isLive={view?.isLive ?? false} />;
  const head = editing && view?.exists ? S.edit : { kicker: S.kicker, title: S.title, body: S.body };

  return (
    <Screen title={head.kicker} scroll={false}>
      <ScrollView ref={scroll} contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
        <View style={styles.hero}>
          <Eyebrow text={DESK.eyebrow.studio} />
          <Text style={[TYPE.headline, { color: color.ink }]} accessibilityRole="header">
            {head.title}
          </Text>
          <Text style={[TYPE.body, { color: color.inkSecondary }]}>{head.body}</Text>
        </View>
        <StepProgress steps={STUDIO.steps} current={step} onPick={go} label={S.stepsAria} />
        <Animated.View key={step} entering={reduce ? undefined : FadeIn.duration(220)} style={styles.step}>
          <Text style={[TYPE.title, { color: color.ink }]}>
            <Text style={{ color: color.accent }}>{String(step).padStart(2, "0")} · </Text>
            {S.steps[step - 1]}
          </Text>
          {step === 1 ? (
            <>
              <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{S.basket.presets}</Text>
              <BasketChoice draft={draft} setDraft={setDraft} />
              <WeightEditor draft={draft} setDraft={setDraft} />
            </>
          ) : null}
          {step === 2 ? <LimitsStep draft={draft} setDraft={setDraft} mandate={mandate} /> : null}
          {step === 3 ? <TestReadStep draft={draft} setDraft={setDraft} mandate={mandate} owner={owner} view={view} writes={writes} read={read} setRead={setRead} zone={zone} nowSec={nowSec} /> : null}
          {step === 4 ? (
            <CreateStep draft={draft} mandate={mandate} owner={owner} view={view} writes={writes} editing={editing} problems={result.ok ? [] : result.problems} onCreated={() => setCreated(true)} zone={zone} nowSec={nowSec} />
          ) : null}
        </Animated.View>
        <StudioSide draft={draft} mandate={mandate} read={readStanding} />
      </ScrollView>
      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12), backgroundColor: color.ground, borderTopColor: color.hairline }]}>
        {problem ? (
          <Text style={[TYPE.caption, { color: color.loss }]} accessibilityRole="alert">
            {problem}
          </Text>
        ) : null}
        <View style={styles.actions}>
          {step > 1 ? <Button label={STUDIO.nav.back} variant="outline" block={false} style={styles.back} onPress={() => go(step - 1)} /> : null}
          {step < 4 ? <Button label={step === 3 && readStanding !== "done" ? STUDIO.nav.nextWithoutRead : STUDIO.nav.next} trailing="→" block={false} style={styles.next} onPress={advance} /> : null}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: SPACE.gutter, paddingTop: 12, paddingBottom: 40, gap: 18 },
  hero: { gap: 8 },
  step: { gap: 14 },
  bar: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: SPACE.gutter, paddingTop: 10, gap: 8 },
  actions: { flexDirection: "row", gap: 10 },
  back: { flexShrink: 0, minWidth: 96 },
  next: { flex: 1 },
});
