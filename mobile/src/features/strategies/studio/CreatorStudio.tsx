import { describeSpec, isSpec } from "@agari/core/strategies";
import { isAddress, type Address } from "@agari/core/types";
import { parseDecimalToBaseUnits } from "@agari/core/units";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { codenameFromAddress } from "@/features/strategies/names";
import { draftSpec, initialStudioDraft, studioReadKey } from "@/features/strategies/studio-draft";
import type { DeskWriteResult } from "@/features/strategies/useDeskWrites";
import { useDryRead } from "@/features/strategies/useDryRead";
import { pushToast } from "~/components/toast/store";
import { FONT } from "~/theme";
import { Confirm, ConnectButton, Sensei, ST, useStrat } from "../ui";
import type { DeskWrites } from "../useCopySetup";
import { DryReadPanel } from "./DryReadPanel";
import { Body, newPortraitSeed } from "./parts";
import { Preview } from "./Preview";
import { Published } from "./Published";
import { StudioForm } from "./StudioForm";

const STEPS = ["Identity & approach", "Behavior & limits", "Test read", "Publish"];

/**
 * web's features/strategies/CreatorStudio.tsx: the heading, the four numbered steps, the step's panel with Back and
 * Continue (Publish once connected; web's Connect before), and the live preview of the agent. Drafting is public;
 * only publishing needs the creator's wallet, whose prompt is the confirmation.
 */
export function CreatorStudio({ writes, decimals, symbol, asset, houseRunner, initialTrader, onPublished }: {
  writes: DeskWrites;
  decimals: number;
  symbol: string;
  asset: string;
  houseRunner: string | null;
  /** web's `?copy=<wallet>`: the studio opens on the mirror preset with that wallet in it. */
  initialTrader?: string | null;
  onPublished?: () => void;
}) {
  const { t, color } = useStrat();
  const [form, setForm] = useState(() => {
    const draft = { ...initialStudioDraft(houseRunner), portraitSeed: newPortraitSeed() };
    return initialTrader ? { ...draft, preset: "mirror" as const, trader: initialTrader } : draft;
  });
  const [step, setStep] = useState(1);
  const [published, setPublished] = useState<DeskWriteResult | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const dry = useDryRead(studioReadKey(form));
  const successfulRead = dry.state.status === "ok" && dry.state.result.verdict !== null;
  const runner = form.hosting === "house" ? houseRunner : form.agent.trim();
  const name = form.name.trim() || codenameFromAddress(form.portraitSeed);
  const spec = draftSpec(form);
  const perTrade = parseDecimalToBaseUnits(form.maxPerTrade, decimals);
  const daily = parseDecimalToBaseUnits(form.maxDaily, decimals);
  const fee = parseDecimalToBaseUnits(form.subFee, decimals);
  const behaviorValid = isSpec(spec) && perTrade !== null && perTrade > 0n && daily !== null && daily >= perTrade;
  const runnerValid = isAddress(runner);
  const summary =
    spec.preset === "agent" || spec.preset === "mirror"
      ? describeSpec(spec, asset)
      : `${spec.preset === "reversion" ? "Bets against" : "Follows"} the EMA move from each Window’s opening print when it reaches ${form.thresholdPct}%. Considers all live venue assets.`;
  const canPublish = behaviorValid && runnerValid && fee !== null && fee >= 0n;
  const advance = () => {
    if (step === 2 && !behaviorValid) {
      setProblem("Complete the brief and choose positive limits. The daily limit must cover one trade.");
      return;
    }
    setProblem(null);
    setStep((value) => Math.min(4, value + 1));
  };
  const testRead = () => {
    if (spec.preset !== "agent" || !behaviorValid || !perTrade) return;
    void dry.read({ persona: spec.persona, posture: spec.posture, cadences: spec.cadences, stakeBase: perTrade.toString() });
  };
  const publish = async () => {
    if (!canPublish || !runner || perTrade === null || daily === null || fee === null || published) return;
    setProblem(null);
    const metadata = { name, portraitSeed: form.portraitSeed, description: summary, spec, ...(form.playbook.trim() ? { playbook: form.playbook.trim() } : {}) };
    const result = await writes.publish({ kind: "strategy-publish", runner: runner as Address, spec, metadata, envelope: { maxStakePerTradeBase: perTrade, maxDailySpendBase: daily, maxOpenPositions: 2, maxPriceRaw: 0n }, feeBase: fee });
    if (result.ok || result.unknown) setPublished(result);
    else setProblem(result.reason ?? "Publishing did not complete. Your draft is still here.");
    if (result.ok) pushToast({ title: "Strategy published. Set up a funded copy to enable trading.", tone: "neutral" });
  };

  if (published) {
    return (
      <Published
        published={published}
        seed={form.portraitSeed}
        name={name}
        onPublished={onPublished}
        onAnother={() => {
          setForm({ ...initialStudioDraft(houseRunner), portraitSeed: newPortraitSeed() });
          setPublished(null);
          setProblem(null);
          setStep(1);
          dry.reset();
        }}
      />
    );
  }

  const continueLabel = step === 3 && form.preset === "agent" && !successfulRead ? "Continue without a test result →" : "Continue →";
  return (
    <View style={styles.builder} accessibilityLabel="Create an agent">
      <View>
        <Text style={[ST.micro, { color: color.accent }]}>Creator studio</Text>
        <Text style={[ST.h2, styles.mt8, { color: color.ink }]}>Give your agent a way to think.</Text>
        <Body style={styles.mt15}>Build your brief, try a read, then publish. Connect your wallet when you are ready to sign.</Body>
      </View>
      <View style={[styles.steps, { borderBottomColor: color.hairline }]} accessibilityLabel="Creation progress">
        {STEPS.map((label, index) => {
          const current = step === index + 1;
          const back = index + 1 < step;
          return (
            <View key={label} style={[styles.stepItem, { borderBottomColor: current ? t.vermilion : "transparent" }]}>
              <Pressable
                disabled={!back}
                accessibilityRole="button"
                accessibilityState={{ selected: current, disabled: !back }}
                onPress={() => {
                  setProblem(null);
                  setStep(index + 1);
                }}
                style={styles.stepButton}
              >
                <Text style={[styles.stepNum, { color: current ? t.vermilion : color.inkMuted }]}>{String(index + 1).padStart(2, "0")}</Text>
                <Text style={[styles.stepLabel, { color: color.ink }]}>{label}</Text>
              </Pressable>
            </View>
          );
        })}
      </View>
      <View style={styles.grid}>
        <View>
          <Text style={[ST.choiceTitle, styles.mb20, { color: color.ink }]}>{STEPS[step - 1]}</Text>
          {step === 3 ? (
            <View style={styles.space20}>
              {form.preset === "agent" ? (
                <>
                  <Body>Make one real model read using this brief and per-trade cap. Nothing is signed or traded. Changing the behavior or limits clears this result.</Body>
                  <Sensei label={dry.state.status === "reading" ? "Reading a live Window…" : "Run test read →"} onPress={testRead} disabled={dry.state.status === "reading" || !behaviorValid} />
                  <DryReadPanel state={dry.state} />
                  {!successfulRead ? <Text style={[ST.mono11, { color: color.inkMuted }]}>You can publish without a successful test. The runner will still need readable markets and a working model.</Text> : null}
                </>
              ) : (
                <>
                  <Text style={[ST.micro, { color: color.accent }]}>Rule preview · no live market read</Text>
                  <Body>{summary}</Body>
                  <View style={[styles.rule, { borderColor: color.hairline }]}>
                    {[`Move ≥ +${form.thresholdPct}% → UP`, `Move ≤ −${form.thresholdPct}% → DOWN`, "Smaller move → HOLD"].map((line) => (
                      <Text key={line} style={[styles.ruleText, { color: color.ink }]}>
                        {line}
                      </Text>
                    ))}
                  </View>
                  <Body>This checks the configured rule, not today’s market or a fill. The live runner still checks time, book depth and your permission.</Body>
                </>
              )}
            </View>
          ) : (
            <StudioForm step={step} form={form} setForm={setForm} symbol={symbol} asset={asset} houseRunner={houseRunner} />
          )}
          {problem ? (
            <Text accessibilityRole="alert" style={[styles.problem, { color: t.vermilion }]}>
              {problem}
            </Text>
          ) : null}
          <View style={[styles.actions, { borderTopColor: color.hairline }]}>
            {step > 1 ? (
              <Sensei
                label="← Back"
                onPress={() => {
                  setStep((value) => value - 1);
                  setProblem(null);
                }}
              />
            ) : null}
            {step < 4 ? (
              <Confirm live label={continueLabel} onPress={advance} style={styles.confirm} />
            ) : writes.address ? (
              <Confirm
                live={canPublish}
                label={writes.busy === "publish" ? "Confirming publication…" : "Publish agent →"}
                onPress={() => void publish()}
                disabled={!canPublish || Boolean(writes.busy) || !writes.canSign}
                style={styles.confirm}
              />
            ) : (
              <ConnectButton />
            )}
          </View>
          {step === 4 ? <Text style={[ST.mono11, styles.mt16, { color: color.inkMuted }]}>One publication transaction. Funding and copy permission are separate steps. Test collateral only.</Text> : null}
        </View>
        <Preview
          seed={form.portraitSeed}
          name={name}
          preset={form.preset}
          maxPerTrade={form.maxPerTrade}
          maxDaily={form.maxDaily}
          symbol={symbol}
          testRead={form.preset === "momentum" ? "Rule preview" : successfulRead ? "Completed for this draft" : dry.state.status === "reading" ? "Reading…" : "Not verified"}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  builder: { marginTop: 30, paddingBottom: 30 },
  mt8: { marginTop: 8 },
  mt15: { marginTop: 15 },
  mt16: { marginTop: 16 },
  mb20: { marginBottom: 20 },
  steps: { flexDirection: "row", gap: 7.5, marginVertical: 30, borderBottomWidth: 1 },
  stepItem: { flex: 1, minWidth: 0, paddingBottom: 13.5, borderBottomWidth: 2 },
  stepButton: { paddingTop: 7.5, paddingBottom: 7.5, paddingRight: 6 },
  stepNum: { fontFamily: FONT.dataRegular, fontSize: 9.75, lineHeight: 15.6, marginBottom: 7.5 },
  stepLabel: { fontFamily: FONT.body, fontSize: 9.75, lineHeight: 15.6 },
  grid: { gap: 30 },
  space20: { gap: 20 },
  rule: { gap: 12, padding: 15, borderWidth: 1 },
  ruleText: { fontFamily: FONT.dataRegular, fontSize: 11.25, lineHeight: 18 },
  problem: { marginVertical: 15, fontFamily: FONT.body, fontSize: 12, lineHeight: 19.2 },
  actions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 7.5, marginTop: 30, paddingTop: 22.5, borderTopWidth: 1 },
  confirm: { flex: 1, maxWidth: 330, marginLeft: "auto" },
});
