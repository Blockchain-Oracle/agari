import { parseStrategyMetadata } from "@agari/core/strategies";
import { isOk } from "@agari/core/schemas";
import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { STRATEGIES } from "@/features/strategies/copy";
import { COPY_FORM } from "@/features/strategies/copy-form-copy";
import { money } from "@/features/strategies/format";
import { strategyIdentity, STRATEGY_MARKETS } from "@/features/strategies/identity";
import { COPY_STATE_LABEL } from "@/features/strategies/lifecycle";
import { ago } from "@/features/strategies/names";
import type { StrategiesPayload, StrategyWire } from "@/features/strategies/protocol";
import { useDesk } from "@/features/strategies/useDesk";
import { useStrategyHealth } from "@/features/strategies/useStrategies";
import { Button, Card, ConnectGate, Row, Rows } from "~/components/kit";
import { explorerUrl, openExternal } from "~/lib/external";
import { RADIUS, TYPE, useTheme } from "~/theme";
import { AgentMemory } from "./AgentMemory";
import { AgentPortrait } from "./AgentPortrait";
import { CopyForm } from "./CopyForm";
import { ManageCopy } from "./ManageCopy";
import { RecordCard } from "./RecordCard";
import { StrategyActivity } from "./StrategyActivity";
import { useCopySetup, type DeskWrites } from "./useCopySetup";

const C = STRATEGIES.drawer.caps;

/**
 * web's features/strategies/CopyDrawer.tsx as a pushed screen: who the strategy is, its performance, this wallet's
 * copy state and the runner's report, then copy / fade / resume, pause, budget and withdraw — every write reviewed.
 */
export function StrategyDetail({ payload, card, writes }: { payload: StrategiesPayload; card: StrategyWire; writes: DeskWrites }) {
  const { color } = useTheme();
  const nowMs = useChainNowMs();
  const desk = useDesk(payload, writes.address, writes.snapshot, card.strategyId);
  const vault = writes.snapshot && isOk(writes.snapshot) ? writes.snapshot.value : null;
  const availableBase = vault?.account.availableBase ?? 0n;
  const grant = vault?.grants.strategy ?? null;
  const sub = desk.subscriptionOf(card.strategyId);
  const { decimals, symbol } = payload;
  const setup = useCopySetup({ card, sub, grant, readable: desk.readable, writes, availableBase, decimals, symbol, nowMs });
  const heartbeat = useStrategyHealth([card.strategyId]);
  const health = heartbeat?.ok && !heartbeat.stale && heartbeat.value.reachable ? heartbeat.value.strategies[card.strategyId] ?? null : null;
  const { name, seed } = strategyIdentity(card);
  const meta = parseStrategyMetadata(card.metadata);
  const fee = BigInt(card.feeBase);
  const result = setup.result;

  return (
    <View style={styles.wrap}>
      <View style={styles.hero}>
        <AgentPortrait seed={seed} name={name} size="hero" />
        <View style={styles.heroText}>
          <Text style={[TYPE.headline, { color: color.ink }]} accessibilityRole="header">
            {name}
          </Text>
          <Pressable onPress={() => void openExternal(explorerUrl("address", card.runner))} accessibilityRole="link" hitSlop={8}>
            <Text style={[TYPE.caption, { color: color.inkMuted }]}>Runner on Solana · {card.runner.slice(0, 4)}…{card.runner.slice(-4)}</Text>
          </Pressable>
        </View>
      </View>
      <Text style={[TYPE.body, { color: color.inkSecondary }]}>
        {meta?.description || "A published strategy with enforced trading limits."} Markets: {STRATEGY_MARKETS}.
      </Text>

      <RecordCard record={card.record} decimals={decimals} symbol={symbol} interactive />
      <Rows>
        <Row label={C.perTrade} value={money(BigInt(card.envelope.maxStakePerTradeBase), decimals, symbol)} />
        <Row label={C.daily} value={money(BigInt(card.envelope.maxDailySpendBase), decimals, symbol)} />
        <Row label={C.fee} value={fee === 0n ? C.free : money(fee, decimals, symbol)} />
        <Row label={C.copiers} value={String(card.subscribers)} />
        <Row label={C.trades} value={String(card.record.fills)} />
        <Row label={C.last} value={card.record.lastActiveSec ? ago(card.record.lastActiveSec * 1000, nowMs) : C.none} />
      </Rows>
      {card.record.settled < 3 ? <Text style={[TYPE.caption, { color: color.inkMuted }]}>{STRATEGIES.drawer.young}</Text> : null}

      <Card tone={setup.state === "copying" ? "accent" : "plain"}>
        {setup.state === "copying" ? (
          <Text style={[TYPE.bodyStrong, { color: color.accent }]}>{sub?.fade ? COPY_FORM.fading : COPY_FORM.copying}</Text>
        ) : null}
        <Text style={[TYPE.labelMicro, { color: color.accent }]}>{COPY_STATE_LABEL[setup.state]}</Text>
        <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{stateLine(setup.state)}</Text>
        {setup.state === "replaced" && grant && !grant.revoked && sub && grant.grantId !== sub.grantId ? (
          <Text style={[TYPE.caption, { color: color.loss }]}>{COPY_FORM.replaced}</Text>
        ) : null}
      </Card>
      <StrategyActivity state={setup.state} grant={grant && sub?.grantId === grant.grantId ? grant : null} health={health} nowMs={nowMs} />

      {result ? (
        <View
          accessibilityLiveRegion="polite"
          style={[styles.result, { backgroundColor: result.ok ? color.profitWash : color.lossWash }]}
        >
          <Text style={[TYPE.bodyStrong, { color: result.ok ? color.profit : color.loss }]}>
            {result.ok ? "Confirmed. Your balances and permissions are refreshing." : result.reason}
          </Text>
          {result.txHash ? (
            <Button label="View transaction" variant="ghost" size="sm" block={false} icon={{ ios: "arrow.up.right", android: "north_east" }} onPress={() => void openExternal(explorerUrl("tx", result.txHash!))} />
          ) : null}
        </View>
      ) : null}

      <ConnectGate why="Copying a strategy funds a bounded permission from your wallet. Reading never needs one.">
        {setup.anotherPending ? (
          <Text style={[TYPE.caption, { color: color.loss }]}>Finish or release strategy #{writes.pending?.strategyId} from Your strategies first.</Text>
        ) : null}
        {card.active ? (
          <CopyForm
            setup={setup}
            writes={writes}
            name={name}
            strategyId={card.strategyId}
            decimals={decimals}
            symbol={symbol}
            availableBase={availableBase}
            hasSub={sub !== null}
            hasOtherGrant={Boolean(grant && !grant.revoked && (!sub || sub.grantId !== grant.grantId))}
          />
        ) : null}
        <ManageCopy setup={setup} writes={writes} sub={sub} strategyId={card.strategyId} availableBase={availableBase} decimals={decimals} symbol={symbol} />
      </ConnectGate>

      {card.agent ? (
        <Disclosure title="Agent memory and decisions">
          <AgentMemory agent={card.agent} storeConnected={payload.stores.decisions} nowMs={nowMs} />
        </Disclosure>
      ) : null}
      {card.playbook || meta?.playbook ? (
        <Disclosure title="Public playbook">
          <Text style={[TYPE.body, { color: color.inkSecondary }]} selectable>
            {card.playbook ?? meta?.playbook}
          </Text>
        </Disclosure>
      ) : null}
    </View>
  );
}

function stateLine(state: ReturnType<typeof useCopySetup>["state"]): string {
  if (state === "copying") return "Your permission is active. A trade still needs a signal and fresh risk checks.";
  if (state === "checking") return "Checking your current vault permission and registry consent before making changes.";
  if (state === "inactive") return "This strategy is not accepting new subscriptions. Existing consent can be paused.";
  return "Review a new permission to start or resume. Publishing alone does not fund or activate a copy.";
}

/** web's <details>: a labelled row that opens its body in place. */
function Disclosure({ title, children }: { title: string; children: ReactNode }) {
  const { color } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={[styles.disclosure, { borderColor: color.hairline }]}>
      <Pressable onPress={() => setOpen((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={styles.disclosureHead}>
        <Text style={[TYPE.labelMicro, { color: color.inkSecondary }]}>{title}</Text>
        <Text style={[TYPE.data, { color: color.accent }]}>{open ? "−" : "+"}</Text>
      </Pressable>
      {open ? children : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  hero: { flexDirection: "row", alignItems: "center", gap: 14 },
  heroText: { flex: 1, gap: 4 },
  result: { borderRadius: RADIUS.md, padding: 12, gap: 6 },
  disclosure: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 4, gap: 10 },
  disclosureHead: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
