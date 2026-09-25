import { Bell, Plus, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { ALERTS } from "@/features/alerts/copy";
import { notificationState, requestNotificationPermission } from "@/features/alerts/notifications";
import { addAlert, centsToRaw, loadAlerts, parseTargetCents, removeAlert, subscribeAlerts, type AlertDirection, type PriceAlert } from "@/features/alerts/store";
import { assetPriceLine, ORACLE_SCALE } from "@/features/markets/hero/units";
import { useMarketSession } from "@/features/markets/session/useMarketSession";
import { haptic } from "~/components/kit";
import { FONT } from "~/theme";
import { mkType, useMk } from "./mk";

/** The live price at the headline's scale, as the number field wants it (web's `defaultTarget`). */
const defaultTarget = (asset: string, raw: bigint): string => assetPriceLine(asset, raw).replace(/[$,]/g, "").replace(/ pts$/, "");

/**
 * web's PriceAlertsButton in the hero foot: the bell in the foot's own grammar (mono 9 px caps; vermilion with the
 * count once this asset has rules) and its popover opening upward over the chart — the basis row, Above / Below, the
 * target defaulting to the live price with its +, the active list and where a rule fires.
 */
export function PriceAlerts({ asset, currentRaw }: { asset: string; currentRaw: bigint | null }) {
  const mk = useMk();
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [target, setTarget] = useState("");
  const [direction, setDirection] = useState<AlertDirection>("above");
  const [notifications, setNotifications] = useState(notificationState());
  const session = useMarketSession();

  useEffect(() => {
    const sync = () => setAlerts(loadAlerts().filter((alert) => !alert.triggered));
    sync();
    return subscribeAlerts(sync);
  }, []);
  useEffect(() => {
    if (currentRaw !== null && !target) setTarget(defaultTarget(asset, currentRaw));
  }, [asset, currentRaw, target]);

  const add = async () => {
    const cents = parseTargetCents(target);
    if (cents === null) return;
    haptic.tap();
    await requestNotificationPermission();
    setNotifications(notificationState());
    addAlert(asset, "regular", cents, direction);
    setTarget("");
  };

  const mine = alerts.filter((alert) => alert.asset === asset);
  const armed = mine.length > 0;
  const quiet = { color: mk.popQuiet };
  const dir = (value: AlertDirection, label: string) => {
    const on = direction === value;
    const tone = value === "above" ? { bg: mk.aboveBg, border: mk.aboveBorder, ink: mk.profit } : { bg: mk.belowBg, border: mk.belowBorder, ink: mk.loss };
    return (
      <Pressable onPress={() => setDirection(value)} accessibilityRole="button" accessibilityState={{ selected: on }} style={[styles.dirBtn, { borderColor: on ? tone.border : mk.dirBorder, backgroundColor: on ? tone.bg : "transparent" }]}>
        <Text style={[styles.dirText, { color: on ? tone.ink : mk.popQuiet }]}>{label}</Text>
      </Pressable>
    );
  };

  return (
    <View>
      <Pressable
        onPress={() => setOpen((prior) => !prior)}
        accessibilityRole="button"
        accessibilityLabel={ALERTS.buttonLabel(asset)}
        accessibilityState={{ expanded: open }}
        hitSlop={10}
        style={styles.button}
      >
        <Bell size={12} color={armed ? mk.vermilion : mk.footAction} strokeWidth={2} />
        <Text style={[mkType.action, { color: armed ? mk.vermilion : mk.footAction }]}>{armed ? mine.length : ALERTS.button}</Text>
      </Pressable>

      {open ? (
        <View style={[styles.pop, { backgroundColor: mk.popBg, borderColor: mk.popBorder }]} accessibilityViewIsModal accessibilityLabel={ALERTS.title}>
          <View style={styles.popHead}>
            <Text style={[styles.title, { color: mk.ink }]}>{ALERTS.title}</Text>
            <Pressable onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel={ALERTS.close} hitSlop={10}>
              <X size={12} color={mk.popQuiet} />
            </Pressable>
          </View>
          <View style={styles.form}>
            <View style={styles.dir}>
              <View style={[styles.dirBtn, { borderColor: mk.dirBorder }]}>
                <Text style={[styles.dirText, quiet]}>{ALERTS.basis.regular}</Text>
              </View>
              <View style={[styles.dirBtn, { borderColor: mk.dirBorder }]} accessibilityLabel={`${ALERTS.basis.token}: ${ALERTS.basis.tokenPending}`} accessibilityState={{ disabled: true }}>
                <Text style={[styles.dirText, quiet, styles.disabled]}>{ALERTS.basis.token}</Text>
              </View>
            </View>
            <View style={styles.dir}>
              {dir("above", ALERTS.above)}
              {dir("below", ALERTS.below)}
            </View>
            <View style={styles.add}>
              <TextInput
                value={target}
                onChangeText={setTarget}
                keyboardType="decimal-pad"
                placeholder={ALERTS.targetPlaceholder}
                placeholderTextColor={mk.popQuiet}
                accessibilityLabel={ALERTS.targetLabel}
                style={[styles.input, { backgroundColor: mk.inputBg, borderColor: mk.inputBorder, color: mk.ink }]}
              />
              <Pressable onPress={() => void add()} accessibilityRole="button" accessibilityLabel={ALERTS.add} style={[styles.plus, { backgroundColor: mk.plusBg }]}>
                <Plus size={14} color={mk.vermilion} />
              </Pressable>
            </View>
          </View>
          {mine.length > 0 ? (
            <View style={[styles.list, { borderTopColor: mk.popRule }]}>
              {mine.map((alert) => (
                <View key={alert.id} style={styles.row}>
                  <Text style={[styles.rowLabel, { color: mk.rowLabel }]}>
                    <Text style={{ color: alert.direction === "above" ? mk.profit : mk.loss }}>{alert.direction === "above" ? "↑" : "↓"}</Text> {assetPriceLine(asset, centsToRaw(alert.targetCents, ORACLE_SCALE))}
                  </Text>
                  <Pressable onPress={() => removeAlert(alert.id)} accessibilityRole="button" accessibilityLabel={ALERTS.remove} hitSlop={10}>
                    <X size={10} color={mk.remove} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
          <Text style={[styles.foot, quiet, { borderTopColor: mk.popRule }]}>
            {!session?.open ? ALERTS.foot.waiting(session?.label ?? null) : notifications === "granted" ? ALERTS.foot.on : ALERTS.foot.off}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  button: { flexDirection: "row", alignItems: "center", gap: 6 },
  // `.alerts-pop`: bottom calc(100% + 8px) of the 18 px `.mh-foot-actions`, left 0, 280 wide.
  pop: { position: "absolute", bottom: 26, left: 0, width: 280, zIndex: 900, gap: 12, borderWidth: 1, borderRadius: 12, padding: 16 },
  popHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontFamily: FONT.bodyStrong, fontSize: 12, lineHeight: 18, letterSpacing: 0.6, textTransform: "uppercase" },
  form: { gap: 8 },
  dir: { flexDirection: "row", gap: 4 },
  dirBtn: { flex: 1, paddingVertical: 6, borderRadius: 8, borderWidth: 1, alignItems: "center" },
  dirText: { fontFamily: FONT.bodyStrong, fontSize: 10, lineHeight: 15, letterSpacing: 0.5, textTransform: "uppercase" },
  disabled: { opacity: 0.5 },
  add: { flexDirection: "row", gap: 8 },
  input: { flex: 1, minWidth: 0, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontFamily: FONT.dataRegular, fontSize: 12 },
  plus: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  list: { gap: 4, borderTopWidth: 1, paddingTop: 12 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6 },
  rowLabel: { fontFamily: FONT.body, fontSize: 12, lineHeight: 18 },
  foot: { borderTopWidth: 1, paddingTop: 10, fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 13.5, letterSpacing: 0.36 },
});
