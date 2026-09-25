import type { ReserveSheet } from "@agari/core/reserves";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { EARN } from "@/features/earn/copy";
import type { ReserveWords } from "@/features/earn/reserves";
import { SectionHead } from "./EarnKit";
import { Message, PausedNote } from "./EarnParts";
import { PositionCard, SupplyCard } from "./SupplyCards";

interface Held {
  shares: bigint;
  worthBase: bigint;
  suppliedBase: bigint;
  withdrawnBase: bigint;
}

interface EarnMainProps {
  words: ReserveWords;
  sheet: ReserveSheet;
  symbol: string;
  /** The paused note's body, or null while supply is open. */
  pausedBody: string | null;
  connected: boolean;
  walletBase: bigint | null;
  held: Held;
  unsettledExpired?: boolean;
  busy: string | null;
  onSupply: (amountBase: bigint) => Promise<boolean> | void;
  onWithdraw: (shares: bigint) => void;
  message: string;
  onMessage: (text: string) => void;
  /** §02's head: the vault's Windows or the reserve's bounds. */
  second: { number: string; title: string };
  children: ReactNode;
}

/**
 * web's `.container.ea-main` as MakerEarn and HouseEarn both draw it: §01 with the paused note, the supply and
 * position cards and the last write's message, then §02's head and body.
 */
export function EarnMain({ words, sheet, symbol, pausedBody, connected, walletBase, held, unsettledExpired, busy, onSupply, onWithdraw, message, onMessage, second, children }: EarnMainProps) {
  const { sections } = EARN;
  return (
    <View style={styles.main}>
      <SectionHead number={sections.supply.number} title={words.supplyTitle} marginBottom={16} />
      {pausedBody !== null ? <PausedNote body={pausedBody} /> : null}
      <View style={styles.cards}>
        <SupplyCard connected={connected} sheet={sheet} symbol={symbol} walletBase={walletBase} busy={busy} onSupply={onSupply} onMessage={onMessage} />
        <PositionCard
          connected={connected}
          sheet={sheet}
          words={words}
          symbol={symbol}
          shares={held.shares}
          worthBase={held.worthBase}
          suppliedBase={held.suppliedBase}
          withdrawnBase={held.withdrawnBase}
          unsettledExpired={unsettledExpired}
          busy={busy}
          onWithdraw={onWithdraw}
        />
      </View>
      <Message text={message} />
      <SectionHead number={second.number} title={second.title} marginBottom={16} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  main: { paddingTop: 24, paddingHorizontal: 18, paddingBottom: 64 },
  cards: { gap: 20, marginBottom: 40 },
});
