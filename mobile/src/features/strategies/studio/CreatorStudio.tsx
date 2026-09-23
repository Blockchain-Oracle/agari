import { describeSpec, isSpec, PRESETS } from "@agari/core/strategies";
import { isAddress, type Address } from "@agari/core/types";
import { parseDecimalToBaseUnits } from "@agari/core/units";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { codenameFromAddress } from "@/features/strategies/names";
import { draftSpec, initialStudioDraft, studioReadKey } from "@/features/strategies/studio-draft";
import type { DeskWriteResult } from "@/features/strategies/useDeskWrites";
import { useDryRead } from "@/features/strategies/useDryRead";
import { Button, Card, ConnectGate, haptic, Row, Rows } from "~/components/kit";
import { pushToast } from "~/components/toast/store";
import { explorerUrl, openExternal } from "~/lib/external";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";
import { AgentPortrait } from "../AgentPortrait";
import { ReviewGate } from "../ReviewGate";
import type { DeskWrites } from "../useCopySetup";
import { DryReadPanel } from "./DryReadPanel";
import { StudioBehavior } from "./StudioBehavior";
import { StudioHosting } from "./StudioHosting";
import { newPortraitSeed, StudioIdentity } from "./StudioIdentity";

const STEPS = ["Identity & approach", "Behavior & limits", "Test read", "Publish"];

/**
 * web's features/strategies/CreatorStudio.tsx: four steps (identity, behaviour and limits, a real dry read, who runs
 * it), a live preview of the agent, and one reviewed publication transaction. Drafting never needs a wallet.
 */
export function CreatorStudio({ writes, decimals, symbol, asset, houseRunner, initialTrader, onPublished }: {
  writes: DeskWrites;
  decimals: number;
  symbol: string;
  asset: string;
  houseRunner: string | null;
  /** A profile's "Copy this trader": the studio opens on the mirror preset with that wallet in it. */
  initialTrader?: string | null;
  onPublished: () => void;
}) {
  const { color } = useTheme();
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
  const fee = parseDecimalToBaseUnits(form.subFee || "0", decimals);
  const behaviorValid = isSpec(spec) && perTrade !== null && perTrade > 0n && daily !== null && daily >= perTrade;
  const runnerValid = isAddress(runner);
  const summary =
    spec.preset === "agent" || spec.preset === "mirror"
      ? describeSpec(spec, asset)
      : `${spec.preset === "reversion" ? "Bets against" : "Follows"} the EMA move from each Window’s opening print when it reaches ${form.thresholdPct}%. Considers all live venue assets.`;
  const canPublish = behaviorValid && runnerValid && fee !== null && fee >= 0n;

  const go = (next: number) => {
    haptic.select();
    setProblem(null);
    setStep(next);
  };
  const advance = () => {
    if (step === 2 && !behaviorValid) {
      haptic.error();
      setProblem("Complete the brief and choose positive limits. The daily limit must cover one trade.");
      return;
    }
    go(Math.min(4, step + 1));
  };
  const testRead = () => {
    if (spec.preset !== "agent" || !behaviorValid || !perTrade) return;
    void dry.read({ persona: spec.persona, posture: spec.posture, cadences: spec.cadences, stakeBase: perTrade.toString() });
  };
  const publish = async () => {
    if (!canPublish || !runner || perTrade === null || daily === null || fee === null || published) return;
    setProblem(null);
    const metadata = { name, portraitSeed: form.portraitSeed, description: summary, spec, ...(form.playbook.trim() ? { playbook: form.playbook.trim() } : {}) };
    const result = await writes.publish({
      kind: "strategy-publish",
      runner: runner as Address,
      spec,
      metadata,
      envelope: { maxStakePerTradeBase: perTrade, maxDailySpendBase: daily, maxOpenPositions: 2, maxPriceRaw: 0n },
      feeBase: fee,
    });
    if (result.ok || result.unknown) setPublished(result);
    else setProblem(result.reason ?? "Publishing did not complete. Your draft is still here.");
    if (result.ok) {
      haptic.success();
      pushToast({ title: "Strategy published.", description: "Set up a funded copy to enable trading.", tone: "neutral" });
    }
  };

  if (published) {
    return (
      <Card tone="accent">
        <AgentPortrait seed={form.portraitSeed} name={name} size="hero" />
        <Text style={[TYPE.labelMicro, { color: color.accent }]}>{published.ok ? "Published on Solana" : "Publication needs checking"}</Text>
        <Text style={[TYPE.headline, { color: color.ink }]}>{name}</Text>
        <Text style={[TYPE.body, { color: color.inkSecondary }]}>
          {published.ok
            ? "Your strategy is registered. Publishing has not deposited money or enabled trades from your wallet."
            : "The transaction result is uncertain. Check the receipt and Your strategies before publishing again."}
        </Text>
        {published.txHash ? (
          <Button label="View publication transaction" variant="ghost" size="sm" block={false} icon={{ ios: "arrow.up.right", android: "north_east" }} onPress={() => void openExternal(explorerUrl("tx", published.txHash!))} />
        ) : null}
        {["Open Your strategies and select this agent.", "Choose a copy budget, review the fee and approve its bounded permission.", "Wait for the runner’s first real decision. A held call is a valid result; a fill has its own transaction."].map((line, i) => (
          <Text key={line} style={[TYPE.caption, { color: color.inkSecondary }]}>
            {String(i + 1).padStart(2, "0")} · {line}
          </Text>
        ))}
        <Button label="View your strategies" trailing="→" onPress={onPublished} />
        {published.ok ? (
          <Button
            label="Create another agent"
            variant="secondary"
            onPress={() => {
              setForm({ ...initialStudioDraft(houseRunner), portraitSeed: newPortraitSeed() });
              setPublished(null);
              setStep(1);
              dry.reset();
            }}
          />
        ) : null}
      </Card>
    );
  }

  return (
    <View style={styles.wrap}>
      <View>
        <Text style={[TYPE.labelMicro, { color: color.accent }]}>Creator studio</Text>
        <Text style={[TYPE.title, { color: color.ink }]}>Give your agent a way to think.</Text>
        <Text style={[TYPE.caption, { color: color.inkSecondary }]}>Build your brief, try a read, then publish. Connect your wallet when you are ready to sign.</Text>
      </View>
      <Stepper step={step} onBack={(n) => go(n)} />
      <Preview seed={form.portraitSeed} name={name} preset={PRESETS[form.preset].name} perTrade={form.maxPerTrade} daily={form.maxDaily} symbol={symbol} read={form.preset === "momentum" ? "Rule preview" : successfulRead ? "Completed for this draft" : dry.state.status === "reading" ? "Reading…" : "Not verified"} />

      <Text style={[TYPE.title, { color: color.ink }]}>{STEPS[step - 1]}</Text>
      {step === 1 ? <StudioIdentity form={form} setForm={setForm} /> : null}
      {step === 2 ? <StudioBehavior form={form} setForm={setForm} asset={asset} symbol={symbol} /> : null}
      {step === 3 && form.preset === "agent" ? (
        <View style={styles.wrap}>
          <Text style={[TYPE.body, { color: color.inkSecondary }]}>Make one real model read using this brief and per-trade cap. Nothing is signed or traded. Changing the behavior or limits clears this result.</Text>
          <Button label={dry.state.status === "reading" ? "Reading a live Window…" : "Run test read"} variant="secondary" loading={dry.state.status === "reading"} disabled={!behaviorValid} onPress={testRead} />
          <DryReadPanel state={dry.state} />
          {successfulRead ? null : <Text style={[TYPE.caption, { color: color.inkMuted }]}>You can publish without a successful test. The runner will still need readable markets and a working model.</Text>}
        </View>
      ) : null}
      {step === 3 && form.preset !== "agent" ? (
        <Card>
          <Text style={[TYPE.labelMicro, { color: color.accent }]}>Rule preview · no live market read</Text>
          <Text style={[TYPE.body, { color: color.inkSecondary }]}>{summary}</Text>
          {form.preset === "mirror" ? null : (
            <Rows>
              <Row label={`Move ≥ +${form.thresholdPct}%`} value="UP" tone="profit" />
              <Row label={`Move ≤ −${form.thresholdPct}%`} value="DOWN" tone="loss" />
              <Row label="Smaller move" value="HOLD" tone="muted" />
            </Rows>
          )}
          <Text style={[TYPE.caption, { color: color.inkMuted }]}>This checks the configured rule, not today’s market or a fill. The live runner still checks time, book depth and your permission.</Text>
        </Card>
      ) : null}
      {step === 4 ? <StudioHosting form={form} setForm={setForm} symbol={symbol} houseRunner={houseRunner} /> : null}

      {problem ? (
        <Text style={[TYPE.caption, { color: color.loss }]} accessibilityRole="alert">
          {problem}
        </Text>
      ) : null}
      {step < 4 ? (
        <Button label={step === 3 && form.preset === "agent" && !successfulRead ? "Continue without a test result" : "Continue"} trailing="→" onPress={advance} />
      ) : (
        <ConnectGate why="Publishing registers your strategy on Solana with one signature.">
          <ReviewGate
            cta={writes.busy === "publish" ? "Confirming publication…" : "Publish agent"}
            title={`Publish ${name}`}
            lines={[
              { label: "Approach", value: PRESETS[form.preset].name },
              { label: "Runner", value: runner ? `${runner.slice(0, 4)}…${runner.slice(-4)}` : "—" },
              { label: "Most per trade", value: `${form.maxPerTrade || "—"} ${symbol}` },
              { label: "Most per day", value: `${form.maxDaily || "—"} ${symbol}` },
              { label: "Open positions", value: "2 per follower" },
              { label: "Subscription fee", value: `${form.subFee || "0"} ${symbol}` },
              { label: "Funds moved", value: "none — funding is a separate step", tone: "muted" },
            ]}
            maxLoss={null}
            confirmLabel="Slide to publish"
            busy={writes.busy === "publish"}
            disabled={Boolean(writes.busy)}
            blocker={!behaviorValid ? "Complete step 02 first." : !runnerValid ? "Choose a runner: a valid Solana address." : fee === null ? "Enter a fee (0 for free)." : !writes.canSign ? "Connect a wallet that can sign." : null}
            onConfirm={publish}
          />
          <Text style={[TYPE.caption, { color: color.inkMuted }]}>One publication transaction. Funding and copy permission are separate steps. Test collateral only.</Text>
        </ConnectGate>
      )}
      {step > 1 ? <Button label="Back" variant="ghost" size="sm" block={false} onPress={() => go(step - 1)} /> : null}
    </View>
  );
}

/** web's numbered step rail; a finished step can be revisited, a later one cannot be skipped to. */
function Stepper({ step, onBack }: { step: number; onBack: (n: number) => void }) {
  const { color } = useTheme();
  return (
    <View style={styles.steps} accessibilityLabel="Creation progress">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < step;
        const on = n === step;
        return (
          <Text
            key={label}
            onPress={done ? () => onBack(n) : undefined}
            accessibilityRole={done ? "button" : "text"}
            accessibilityState={{ selected: on }}
            accessibilityLabel={`Step ${n}, ${label}${on ? ", current" : done ? ", done" : ""}`}
            style={[styles.step, { borderColor: on ? color.accent : color.hairline, backgroundColor: on ? color.accentWash : "transparent", color: on ? color.ink : done ? color.inkSecondary : color.inkDisabled }]}
          >
            {String(n).padStart(2, "0")}
          </Text>
        );
      })}
    </View>
  );
}

function Preview({ seed, name, preset, perTrade, daily, symbol, read }: { seed: string; name: string; preset: string; perTrade: string; daily: string; symbol: string; read: string }) {
  const { color } = useTheme();
  return (
    <View style={[styles.preview, { borderColor: color.hairline, backgroundColor: color.surface1 }]}>
      <AgentPortrait seed={seed} name={name} />
      <View style={styles.previewText}>
        <Text style={[TYPE.bodyStrong, { color: color.ink }]} numberOfLines={1}>
          {name}
        </Text>
        <Text style={[TYPE.caption, { color: color.inkMuted }]} numberOfLines={1}>
          {preset} · {perTrade || "—"}/{daily || "—"} {symbol} · {read}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  steps: { flexDirection: "row", gap: 8 },
  step: { flex: 1, textAlign: "center", paddingVertical: 12, borderWidth: 1, borderRadius: RADIUS.md, fontFamily: FONT.dataStrong, fontSize: 13, overflow: "hidden" },
  preview: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.lg, padding: 12 },
  previewText: { flex: 1 },
});
