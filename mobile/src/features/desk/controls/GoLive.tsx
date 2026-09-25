import { DESK_MINTS, type DeskMainnetSession } from "@agari/markets/desk";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { DESK } from "@/features/desk/copy";
import { GO_LIVE } from "@/features/desk/copy-controls";
import { pct, usd } from "@/features/desk/format";
import { loadLiveProgress, resumeStage, saveLiveProgress, type LiveProgress, type LiveStage } from "@/features/desk/go-live";
import type { DeskActions } from "@/features/desk/useDeskWrites";
import { FONT } from "~/theme";
import type { NativeDeskView as DeskView } from "../native-view";
import { DkControl, DT, useDeskTheme } from "../kit";
import { MoneySheet } from "./MoneySheet";
import { ModePicker, type LiveMode } from "./ModePicker";

type KitAddress = Parameters<DeskMainnetSession["setOperator"]>[0];
const STEPS: LiveStage[] = ["open-pending", "allow-pending", "mandate-pending", "deposit-pending"];
const STEP_COPY = { "open-pending": GO_LIVE.steps.open, "allow-pending": GO_LIVE.steps.allow, "mandate-pending": GO_LIVE.steps.attach, "deposit-pending": GO_LIVE.steps.deposit } as const;

/**
 * Go live (web's GoLive.tsx): open the desk on Solana mainnet, allow the basket's companies, link the desk to its
 * record, put money in. A durable stage machine (`go-live.ts`) kept on this phone: each step is saved before its
 * confirmation, and on return the chain is read first so nothing is asked for twice. The step's button asks the wallet.
 */
export function GoLive({ view, actions, liveMode, zone, nowSec }: { view: DeskView; actions: DeskActions; liveMode: LiveMode; zone: string | null; nowSec: number }) {
  const { color } = useDeskTheme();
  const owner = actions.owner;
  const operator = view.wire.operator;
  const mandate = view.mandate;
  const [mode, setMode] = useState<LiveMode>(liveMode);
  const [progress, setProgress] = useState<LiveProgress | null>(null);
  const [stage, setStage] = useState<LiveStage | null>(null);
  const [money, setMoney] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const { session, state } = actions;

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

  if (!owner) return <Text style={[DT.body, { color: color.inkSecondary }]}>{DESK.studio.create.connect}</Text>;
  if (!operator) return <Text style={[DT.body, { color: color.warning }]}>{GO_LIVE.noOperator}</Text>;
  if (actions.mainnet.kind === "unsupported") return <Text style={[DT.body, { color: color.warning }]}>{GO_LIVE.unsupported(actions.mainnet.why)}</Text>;
  if (!mandate || !session || stage === null) return <Text style={[DT.body, { color: color.inkSecondary }]}>{DESK.studio.read.waiting}</Text>;

  const run = async () => {
    setProblem(null);
    if (stage === "open-pending") {
      save({ stage: "open-pending" });
      const landed = await actions.tx("open", (s) => s.openDesk({ operator: operator as unknown as KitAddress, perActionCapE6: mandate.perActionCapE6, dailyCapE6: mandate.dailyCapE6, maxPremiumBps: mandate.maxPremiumBps, mode }));
      if (!landed.ok) return setProblem(landed.reason);
      const chain = await session.readState(nowSec).catch(() => null);
      save({ stage: "allow-pending", openTx: landed.signature, address: chain?.address ?? null });
    } else if (stage === "allow-pending") {
      const landed = await actions.tx("allow", (s) => s.allowTokens(mandate.targets.tokens.map((t) => DESK_MINTS[t.symbol])));
      if (!landed.ok) return setProblem(landed.reason);
      save({ stage: "mandate-pending", allowTx: landed.signature });
    } else if (stage === "mandate-pending") {
      const address = progress?.address ?? (await session.readState(nowSec).catch(() => null))?.address ?? null;
      if (!address) return setProblem(DESK.studio.read.failed);
      const linked = await actions.recordMode(mode, { address, operator });
      if (!linked.ok) return setProblem(linked.reason);
      save({ stage: "deposit-pending", address });
    } else {
      setMoney(true);
    }
  };
  const busy = state.busy !== null;
  const current = STEPS.indexOf(stage);
  const bodyOf = (s: LiveStage): string =>
    s === "open-pending"
      ? GO_LIVE.steps.open.body(usd(mandate.perActionCapE6, 0), usd(mandate.dailyCapE6, 0), pct(mandate.maxPremiumBps))
      : s === "allow-pending"
        ? GO_LIVE.steps.allow.body(mandate.targets.tokens.map((t) => t.symbol).join(", "))
        : (STEP_COPY[s].body as string);
  return (
    <View style={styles.card}>
      <Text style={[DT.eyebrow, styles.clearClose, { color: color.accent }]}>{GO_LIVE.eyebrow}</Text>
      <Text style={[DT.holdingName, { color: color.ink }]} accessibilityRole="header">
        {GO_LIVE.title}
      </Text>
      <Text style={[DT.caption, { color: color.inkSecondary }]}>{GO_LIVE.body}</Text>
      {stage === "open-pending" ? <ModePicker value={mode} onChange={setMode} label={GO_LIVE.mode} /> : null}
      <View accessibilityLabel={GO_LIVE.title}>
        {STEPS.map((s, i) => (
          <View key={s} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: color.hairline }]} accessibilityState={{ selected: i === current }}>
            <View style={styles.rowText}>
              <Text style={[styles.stepTitle, { color: color.ink }]}>
                {String(i + 1).padStart(2, "0")} {STEP_COPY[s].title}
              </Text>
              <Text style={[DT.caption, { color: i === current ? color.ink : color.inkMuted }]}>{bodyOf(s)}</Text>
            </View>
            <Text style={[DT.mono, { color: color.inkSecondary }]}>{i < current ? "done" : ""}</Text>
          </View>
        ))}
      </View>
      {progress && progress.stage !== "open-pending" ? <Text style={[DT.caption, { color: color.inkMuted }]}>{GO_LIVE.resume(STEP_COPY[stage].title)}</Text> : null}
      <Text style={[DT.caption, { color: color.inkMuted }]}>{GO_LIVE.fees}</Text>
      <View style={styles.actions}>
        <DkControl tone="primary" label={busy ? DESK.studio.read.signing : STEP_COPY[stage].button} disabled={busy} onPress={() => void run()} />
        {problem ? <Text style={[DT.caption, styles.problem, { color: color.warning }]}>{problem}</Text> : null}
      </View>
      {money ? (
        <MoneySheet
          view={view}
          actions={actions}
          kind="deposit"
          zone={zone}
          nowSec={nowSec}
          onClose={() => {
            setMoney(false);
            if (state.phase === "done") saveLiveProgress(owner, null);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  clearClose: { paddingRight: 36 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 8 },
  rowText: { flex: 1, minWidth: 0 },
  stepTitle: { fontFamily: FONT.bodyMedium, fontSize: 13, lineHeight: 20.8 },
  actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 },
  problem: { flexShrink: 1 },
});
