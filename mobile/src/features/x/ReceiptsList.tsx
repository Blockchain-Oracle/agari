import { shortHex } from "@agari/core/units";
import { xReceiptRecovery, xRefusalCopy, type XReceipt } from "@agari/core/x";
import { router, type Href } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { TRADE_FROM_X } from "@/features/x/copy";
import { receiptDisplay } from "@/features/x/receipt-display";
import { Button, Card, EmptyState, Pill, SectionHeader, type PillTone } from "~/components/kit";
import { explorerUrl, openExternal } from "~/lib/external";
import { TYPE, useTheme } from "~/theme";

const TONE: Record<string, PillTone> = { filled: "profit", submitted: "neutral", unknown: "warning", refused: "loss", reverted: "loss", "nothing-filled": "neutral" };

/** web's features/x/XReceiptsList.tsx: each mention, what became of it, the transaction, and a refusal's reason. */
export function ReceiptsList({ receipts, configured, decimals, symbol }: {
  receipts: readonly XReceipt[];
  configured: boolean;
  decimals: number;
  symbol: string;
}) {
  const { color } = useTheme();
  return (
    <View style={styles.wrap}>
      <SectionHeader title={TRADE_FROM_X.receipts.title} aside={configured ? String(receipts.length) : undefined} />
      {!configured ? <EmptyState why={TRADE_FROM_X.receipts.none} /> : receipts.length === 0 ? <EmptyState why={TRADE_FROM_X.receipts.empty} /> : null}
      {receipts.map((r) => {
        const display = receiptDisplay(r, decimals, symbol);
        // A recovery that points at this screen (build again, check X trading) is the section above: no button.
        const found = display.status === "refused" ? xReceiptRecovery(r.refusalCode) : null;
        const recovery = found && !found.href.startsWith("/trade-from-x") ? found : null;
        const refusal = display.status === "refused" && r.refusalCode ? xRefusalCopy(r) : null;
        const reason = refusal?.detail ?? r.reason;
        return (
          <Card key={r.mentionId}>
            <Pill label={refusal?.title ?? display.label} tone={TONE[display.status] ?? "neutral"} dot />
            <Text style={[TYPE.data, { color: color.ink }]}>{r.instruction}</Text>
            {display.summary ? <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{display.summary}</Text> : null}
            {reason ? <Text style={[TYPE.caption, { color: color.inkMuted }]}>{reason}</Text> : null}
            <View style={styles.actions}>
              {display.txHash ? (
                <Button label={shortHex(display.txHash)} variant="ghost" size="sm" block={false} icon={{ ios: "arrow.up.right", android: "north_east" }} onPress={() => void openExternal(explorerUrl("tx", display.txHash!))} />
              ) : null}
              {recovery ? (
                <Button
                  label={recovery.label}
                  variant="secondary"
                  size="sm"
                  block={false}
                  onPress={() => router.push(recovery.href as Href)}
                />
              ) : null}
            </View>
          </Card>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
