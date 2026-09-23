import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { STRATEGIES } from "@/features/strategies/copy";
import { money } from "@/features/strategies/format";
import { strategyIdentity } from "@/features/strategies/identity";
import { SEALED_BODY_MAX, SEALED_TITLE_MAX } from "@/features/strategies/memory-protocol";
import type { StrategyWire } from "@/features/strategies/protocol";
import { useSealedMemory } from "@/features/strategies/useSealedMemory";
import { Button, Card, Chips, ConnectGate, EmptyState, Field } from "~/components/kit";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";
import { Glyph } from "./Glyph";

const M = STRATEGIES.memory;

/**
 * web's features/strategies/MemoryMarket.tsx: a creator seals what their agent has learned; a subscriber reads it.
 * The pass is the on-chain subscription. Both flows sign one of Agari's texts (no transaction, no fee).
 */
export function MemoryMarket({ strategies, subscribed, decimals, symbol, onSubscribe, onSealed }: {
  strategies: readonly StrategyWire[];
  subscribed: (strategyId: string) => boolean;
  decimals: number;
  symbol: string;
  onSubscribe: (card: StrategyWire) => void;
  onSealed: () => void;
}) {
  const { color } = useTheme();
  const memory = useSealedMemory();
  const sealed = strategies.filter((s) => s.memory !== null);
  const mine = strategies.filter((s) => s.creator === memory.address);
  return (
    <View style={styles.wrap}>
      <Text style={[TYPE.labelMicro, { color: color.accent }]}>{M.eyebrow}</Text>
      <Text style={[TYPE.headline, { color: color.ink }]} accessibilityRole="header">
        {M.title[0]} <Text style={{ color: color.inkMuted }}>{M.title[1]}</Text>
      </Text>
      <Text style={[TYPE.body, { color: color.inkSecondary }]}>{M.lede}</Text>
      {sealed.length === 0 ? <EmptyState why={M.emptyTitle} detail={M.emptyBody} /> : null}
      {sealed.map((card) => {
        const holds = card.creator === memory.address || subscribed(card.strategyId);
        const state = memory.reads[card.strategyId] ?? { kind: "idle" as const };
        const fee = BigInt(card.feeBase);
        return (
          <Card key={card.strategyId}>
            <View style={styles.capsuleHead}>
              <Glyph name={state.kind === "open" ? "unlock" : "lock"} size={16} />
              <Text style={[TYPE.bodyStrong, styles.capsuleTitle, { color: color.ink }]}>{card.memory?.title}</Text>
            </View>
            <Text style={[TYPE.caption, { color: color.inkMuted }]}>
              {M.by(strategyIdentity(card).name)} · {M.length(card.memory?.chars ?? 0)}
            </Text>
            {state.kind === "open" ? (
              <Text style={[TYPE.body, { color: color.ink }]} selectable>
                {state.memory.body}
              </Text>
            ) : (
              <>
                <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{fee > 0n ? M.pass(money(fee, decimals, symbol)) : M.passFree}</Text>
                <ConnectGate why="Reading a sealed memory is signed by your wallet.">
                  {holds && state.kind !== "locked" ? (
                    <Button label={state.kind === "busy" ? M.reading : M.read} loading={state.kind === "busy"} size="sm" onPress={() => void memory.read(card.strategyId)} accessibilityHint="Signs a message. No transaction, no fee." />
                  ) : (
                    <Button label={M.subscribe} size="sm" variant="secondary" onPress={() => onSubscribe(card)} />
                  )}
                </ConnectGate>
                {state.kind === "failed" ? <Text style={[TYPE.caption, { color: color.warning }]}>{state.why}</Text> : null}
              </>
            )}
          </Card>
        );
      })}
      {mine.length > 0 ? <SealForm strategies={mine} seal={memory.seal} onSealed={onSealed} /> : null}
    </View>
  );
}

function SealForm({ strategies, seal, onSealed }: {
  strategies: readonly StrategyWire[];
  seal: (strategyId: string, title: string, body: string) => Promise<string | null>;
  onSealed: () => void;
}) {
  const { color } = useTheme();
  const [strategyId, setStrategyId] = useState(strategies[0]?.strategyId ?? "");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const ready = strategyId !== "" && title.trim().length > 0 && body.trim().length > 0;
  const submit = async () => {
    setBusy(true);
    const failure = await seal(strategyId, title.trim(), body);
    setBusy(false);
    setNote(failure ?? M.sealedNote);
    if (failure) return;
    setTitle("");
    setBody("");
    onSealed();
  };
  return (
    <Card tone="accent">
      <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{M.sealHeading}</Text>
      <Chips
        options={strategies.map((s) => ({ value: s.strategyId, label: `#${s.strategyId} · ${strategyIdentity(s).name}` }))}
        value={strategyId}
        onPick={setStrategyId}
      />
      <Field label="Title" value={title} onChangeText={setTitle} placeholder={M.titlePlaceholder} maxLength={SEALED_TITLE_MAX} />
      <TextInput
        value={body}
        onChangeText={setBody}
        maxLength={SEALED_BODY_MAX}
        placeholder={M.bodyPlaceholder}
        placeholderTextColor={color.inkMuted}
        multiline
        accessibilityLabel="Memory body"
        style={[styles.area, { color: color.ink, borderColor: color.hairline, backgroundColor: color.surface1 }]}
      />
      <Button label={busy ? M.sealing : M.seal} loading={busy} disabled={!ready} onPress={() => void submit()} />
      {note ? <Text style={[TYPE.caption, { color: color.inkSecondary }]} accessibilityLiveRegion="polite">{note}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  capsuleHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  capsuleTitle: { flex: 1 },
  area: { minHeight: 120, borderWidth: 1, borderRadius: RADIUS.md, padding: 12, fontFamily: FONT.body, fontSize: 15, textAlignVertical: "top" },
});
