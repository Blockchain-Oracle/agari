import { shortHex } from "@agari/core/units";
import { xReceiptRecovery, xRefusalCopy, type XReceipt } from "@agari/core/x";
import { StyleSheet, Text, View } from "react-native";
import { TRADE_FROM_X } from "@/features/x/copy";
import { receiptDisplay } from "@/features/x/receipt-display";
import { explorerUrl, openExternal } from "~/lib/external";
import { FONT, useTheme } from "~/theme";
import { tradeXTokens, type TradeXTokens } from "~/theme/web/products/trade-x";

const statusInk = (t: TradeXTokens, status: string) =>
  status === "filled" ? t.m : status === "refused" || status === "reverted" ? t.errInk : status === "unknown" || status === "submitted" ? t.warnInk : t.gray500;

/**
 * web's XReceiptsList.tsx (`.xt-receipts`, one column under 640 px): every mention linked to what became of it; a
 * refusal carries its reason and its recovery link (`onRecover` follows web's href: an anchor on this page or a route).
 */
export function ReceiptsList({ receipts, configured, decimals, symbol, onRecover }: {
  receipts: readonly XReceipt[]; configured: boolean; decimals: number; symbol: string; onRecover: (href: string) => void;
}) {
  const t = tradeXTokens(useTheme().name);
  return (
    <View style={styles.wrap} accessibilityLabel={TRADE_FROM_X.receipts.title}>
      <Text style={[styles.label, { color: t.gray500 }]}>{TRADE_FROM_X.receipts.title}</Text>
      {!configured ? (
        <Text style={[styles.note, { color: t.gray500 }]}>{TRADE_FROM_X.receipts.none}</Text>
      ) : receipts.length === 0 ? (
        <Text style={[styles.note, { color: t.gray500 }]}>{TRADE_FROM_X.receipts.empty}</Text>
      ) : (
        receipts.map((r) => {
          const display = receiptDisplay(r, decimals, symbol);
          const recovery = display.status === "refused" ? xReceiptRecovery(r.refusalCode) : null;
          const refusal = display.status === "refused" && r.refusalCode ? xRefusalCopy(r) : null;
          const reason = refusal?.detail ?? r.reason;
          const txHash = display.txHash;
          return (
            <View key={r.mentionId} style={[styles.receipt, { borderColor: t.cardBorder }]}>
              <Text style={[styles.text, styles.status, { color: statusInk(t, display.status) }]}>{refusal?.title ?? display.label}</Text>
              <Text style={[styles.text, { color: t.gray200 }]}>{r.instruction}</Text>
              <Text style={[styles.text, { color: t.gray400 }]}>
                {display.summary}
                {txHash ? (
                  <>
                    {display.summary ? " · " : ""}
                    <Text style={{ color: t.v }} accessibilityRole="link" onPress={() => void openExternal(explorerUrl("tx", txHash))}>{shortHex(txHash)}</Text>
                  </>
                ) : null}
              </Text>
              {reason ? (
                <Text style={[styles.text, styles.reason, { color: t.gray500 }]}>
                  {reason}
                  {recovery ? (
                    <>
                      {" "}
                      <Text style={{ color: t.v }} accessibilityRole="link" onPress={() => onRecover(recovery.href)}>{recovery.label} ↗</Text>
                    </>
                  ) : null}
                </Text>
              ) : null}
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 32, gap: 8 },
  label: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, letterSpacing: 3.3, textTransform: "uppercase", marginBottom: 28 - 8 },
  note: { marginTop: 12, fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6 },
  receipt: { gap: 8, borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 },
  text: { fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 18 },
  status: { fontSize: 10, lineHeight: 15, letterSpacing: 1.6, textTransform: "uppercase" },
  reason: { fontSize: 11, lineHeight: 16.5 },
});
