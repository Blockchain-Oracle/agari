import { DESK_MINTS, type DeskMainnetSession } from "@agari/markets/desk";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { DESK } from "@/features/desk/copy";
import { GO_LIVE } from "@/features/desk/copy-controls";
import { pct, usd } from "@/features/desk/format";
import { loadLiveProgress, resumeStage, saveLiveProgress, type LiveProgress, type LiveStage } from "@/features/desk/go-live";
import type { DeskActions } from "@/features/desk/useDeskWrites";
import type { NativeDeskView as DeskView } from "../native-view";
import { Button } from "~/components/kit";
import { RADIUS, TYPE, useTheme } from "~/theme";
import { Eyebrow } from "../kit";
import { mainnetBlocker } from "./blocker";
import { MoneySheet } from "./MoneySheet";
import { ModePicker, type LiveMode } from "./ModePicker";
import { ReviewSheet } from "./ReviewSheet";

type KitAddress = Parameters<DeskMainnetSession["setOperator"]>[0];
const STEPS: LiveStage[] = ["open-pending", "allow-pending", "mandate-pending", "deposit-pending"];
const STEP_COPY = { "open-pending": GO_LIVE.steps.open, "allow-pending": GO_LIVE.steps.allow, "mandate-pending": GO_LIVE.steps.attach, "deposit-pending": GO_LIVE.steps.deposit } as const;

/**
 * Go live (web's GoLive.tsx): open the desk on Solana mainnet, allow the basket's companies, link the desk to its
 * record, put money in; a resumable stage machine (`go-live.ts`) kept on this phone. Each step is reviewed before
 * the wallet is asked; a wallet that cannot sign mainnet is told why before anything starts.
 */
export function GoLive({ view, actions, liveMode, zone, nowSec }: { view: DeskView; actions: DeskActions; liveMode: LiveMode; zone: string | null; nowSec: number }) {
  const { color } = useTheme();
  const owner = actions.owner;
  const operator = view.wire.operator;
  const mandate = view.mandate;
  const { session, state } = actions;
  const [mode, setMode] = useState<LiveMode>(liveMode);
  const [progress, setProgress] = useState<LiveProgress | null>(null);
  const [stage, setStage] = useState<LiveStage>("open-pending");
  const [review, setReview] = useState(false);
  const [money, setMoney] = useState(false);

  // Resume: what this phone saved, corrected by what the chain and the index say now.
  useEffect(() => {
    if (!owner) return;
    const saved = loadLiveProgress(owner);
    let live = true;
    const facts = async () => {
      const chain = session ? await session.readState(nowSec).catch(() => null) : null;
      const wanted = new Set((mandate?.targets.tokens ?? []).map((t) => DESK_MINTS[t.symbol] as string));
      const allowed = chain ? [...wanted].every((mint) => chain.tokens.some((t) => (t.mint as string) === mint && t.enabled)) : false;
      if (!live) return;
      setProgress(saved);
      setStage(resumeStage(saved?.stage ?? null, { deskExists: chain !== null, namesAllowed: chain !== null && wanted.size > 0 && allowed, rowIsLive: view.isLive }));
    };
    void facts();
    return () => {
      live = false;
    };
    // Only on mount and when the session appears: a poll must not reset a step in flight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner, session]);

  const save = (next: Partial<LiveProgress> & { stage: LiveStage }) => {
    if (!owner || !operator) return;
    const merged: LiveProgress = { owner, operator, mode, openTx: null, allowTx: null, address: null, startedAtSec: nowSec, ...progress, ...next };
    setProgress(merged);
    setStage(merged.stage);
    saveLiveProgress(owner, merged);
  };

  const run = async () => {
    if (!mandate || !session || !operator) return;
    if (stage === "open-pending") {
      save({ stage: "open-pending" });
      const landed = await actions.tx("open", (s) => s.openDesk({ operator: operator as unknown as KitAddress, perActionCapE6: mandate.perActionCapE6, dailyCapE6: mandate.dailyCapE6, maxPremiumBps: mandate.maxPremiumBps, mode }));
      if (!landed.ok) return;
      const chain = await session.readState(nowSec).catch(() => null);
      save({ stage: "allow-pending", openTx: landed.signature, address: chain?.address ?? null });
    } else if (stage === "allow-pending") {
      const landed = await actions.tx("allow", (s) => s.allowTokens(mandate.targets.tokens.map((t) => DESK_MINTS[t.symbol])));
      if (landed.ok) save({ stage: "mandate-pending", allowTx: landed.signature });
    } else if (stage === "mandate-pending") {
      const address = progress?.address ?? (await session.readState(nowSec).catch(() => null))?.address ?? null;
      if (!address) return;
      const linked = await actions.recordMode(mode, { address, operator });
      if (linked.ok) save({ stage: "deposit-pending", address });
    }
  };

  const blocker = !owner ? DESK.studio.create.connect : !operator ? GO_LIVE.noOperator : !mandate ? DESK.studio.read.waiting : stage === "mandate-pending" ? null : mainnetBlocker(actions);
  const current = STEPS.indexOf(stage);
  const bodyOf = (s: LiveStage): string => {
    if (!mandate) return "";
    if (s === "open-pending") return GO_LIVE.steps.open.body(usd(mandate.perActionCapE6, 0), usd(mandate.dailyCapE6, 0), pct(mandate.maxPremiumBps));
    if (s === "allow-pending") return GO_LIVE.steps.allow.body(mandate.targets.tokens.map((t) => t.symbol).join(", "));
    return STEP_COPY[s].body as string;
  };
  return (
    <View style={styles.wrap}>
      <Eyebrow text={GO_LIVE.eyebrow} live />
      <Text style={[TYPE.headline, { color: color.ink }]}>{GO_LIVE.title}</Text>
      <Text style={[TYPE.body, { color: color.inkSecondary }]}>{GO_LIVE.body}</Text>
      {stage === "open-pending" ? <ModePicker value={mode} onChange={setMode} label={GO_LIVE.mode} /> : null}
      <View style={styles.steps} accessibilityLabel={GO_LIVE.title}>
        {STEPS.map((s, i) => (
          <View key={s} style={[styles.step, { borderColor: i === current ? color.accent : color.hairline, opacity: i < current ? 0.6 : 1 }]} accessibilityState={{ selected: i === current }}>
            <Text style={[TYPE.bodyStrong, { color: color.ink }]}>
              {String(i + 1).padStart(2, "0")} {STEP_COPY[s].title} {i < current ? "· done" : ""}
            </Text>
            <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{bodyOf(s)}</Text>
          </View>
        ))}
      </View>
      {progress && progress.stage !== "open-pending" ? <Text style={[TYPE.caption, { color: color.inkMuted }]}>{GO_LIVE.resume(STEP_COPY[stage].title)}</Text> : null}
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>{GO_LIVE.fees}</Text>
      {blocker ? <Text style={[TYPE.body, { color: color.warning }]}>{blocker}</Text> : null}
      <Button label={STEP_COPY[stage].button} disabled={blocker !== null} onPress={() => (stage === "deposit-pending" ? setMoney(true) : setReview(true))} />
      {review && mandate ? (
        <ReviewSheet
          visible
          eyebrow={GO_LIVE.eyebrow}
          title={STEP_COPY[stage].title}
          body={bodyOf(stage)}
          onClose={() => {
            actions.reset();
            setReview(false);
          }}
          review={{
            title: STEP_COPY[stage].title,
            lines: [
              { label: "Mode", value: DESK.modes[mode] },
              { label: "Most in one action", value: usd(mandate.perActionCapE6, 0) },
              { label: "Most in a day", value: usd(mandate.dailyCapE6, 0) },
              { label: "Network fee", value: stage === "open-pending" ? "≈ 0.02 SOL" : stage === "mandate-pending" ? "None" : "< 0.001 SOL" },
            ],
            maxLoss: stage === "open-pending" ? "≈ 0.02 SOL" : "$0.00",
            confirmLabel: STEP_COPY[stage].button,
            blocker,
          }}
          onConfirm={() => void run()}
          phase={state.phase}
          problem={state.problem}
          signature={state.signature}
        />
      ) : null}
      {money ? (
        <MoneySheet
          view={view}
          actions={actions}
          kind="deposit"
          zone={zone}
          nowSec={nowSec}
          onClose={() => {
            setMoney(false);
            if (state.phase === "done" && owner) saveLiveProgress(owner, null);
            actions.reset();
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  steps: { gap: 8 },
  step: { borderWidth: 1, borderRadius: RADIUS.md, padding: 12, gap: 4 },
});
