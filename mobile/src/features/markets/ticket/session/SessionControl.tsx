import { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { SESSION } from "./copy";
import type { SessionStatus } from "@/features/session/view";
import { haptic } from "~/components/kit";
import { useSessionKey } from "~/web-shims/session-key-provider";
import { tkType, useTk } from "../tk";
import { SessionManager } from "./SessionManager";
import { SessionModal } from "./SessionModal";

const LABEL: Record<SessionStatus, string> = {
  armed: SESSION.chip.on,
  disarmed: SESSION.chip.off,
  "grant-without-key": SESSION.chip.needsKey,
  expired: SESSION.chip.expired,
  loading: SESSION.chip.off,
  "not-deployed": SESSION.chip.off,
  "no-wallet": SESSION.chip.off,
};

const TITLE: Record<SessionStatus, string> = {
  armed: SESSION.chip.titleOn,
  disarmed: SESSION.chip.titleOff,
  "grant-without-key": SESSION.chip.titleNeedsKey,
  expired: SESSION.chip.titleExpired,
  loading: SESSION.chip.titleOff,
  "not-deployed": SESSION.notDeployed,
  "no-wallet": SESSION.chip.titleNoWallet,
};

/**
 * web's SessionControl: the "tap-trading" chip in the leverage-chip grammar (pressed while armed; disabled only when
 * there is nothing to arm against) and the two dialogs it opens — arm when there is nothing, manage when there is.
 */
export function SessionControl({ symbol }: { symbol: string }) {
  const tk = useTk();
  const { view } = useSessionKey();
  const [sheet, setSheet] = useState(false);
  const [manager, setManager] = useState(false);
  const status = view.status;
  const armed = status === "armed";
  const disabled = status === "not-deployed" || status === "no-wallet" || status === "loading";
  const open = () => {
    haptic.select();
    if (status === "disarmed") setSheet(true);
    else setManager(true);
  };
  return (
    <>
      <Pressable
        onPress={open}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ selected: armed, disabled }}
        accessibilityLabel={`${LABEL[status]} — ${TITLE[status]}`}
        hitSlop={6}
        style={[styles.chip, { borderColor: armed ? tk.levOnBorder : tk.levBorder, backgroundColor: armed ? tk.levOnBg : "transparent" }, disabled && styles.dim]}
      >
        <Text style={[tkType.chip, { color: armed ? tk.levOnInk : tk.lev }]}>{LABEL[status]}</Text>
      </Pressable>
      <SessionModal open={sheet} onClose={() => setSheet(false)} symbol={symbol} />
      <SessionManager
        open={manager}
        onClose={() => setManager(false)}
        symbol={symbol}
        onArmNew={() => {
          setManager(false);
          setSheet(true);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  chip: { minWidth: 40, borderRadius: 4, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  dim: { opacity: 0.35 },
});
