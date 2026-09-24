import { formatBaseUnits } from "@agari/core/units";
import { router } from "expo-router";
import { useSyncExternalStore } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { PrivateTicketState } from "@/features/private/usePrivateTicket";
import { Button } from "~/components/kit";
import type { ToastItem } from "~/components/toast/store";
import { RADIUS, TYPE, useTheme } from "~/theme";

const KEY = "agari.private.lastFailure";

export interface PrivateFailure {
  title: string;
  description: string | null;
  atMs: number;
}

/**
 * The last private bet that did not place, kept until one does. web's private route reports a refusal only as a toast,
 * which a sheet hides and time erases; once money has moved into the private balance the reason has to stay on the
 * ticket. Held in a module store (and device storage, so a reopened sheet still says it).
 */
let current: PrivateFailure | null = read();
const listeners = new Set<() => void>();

function read(): PrivateFailure | null {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    return raw ? (JSON.parse(raw) as PrivateFailure) : null;
  } catch {
    return null;
  }
}

function write(next: PrivateFailure | null): void {
  current = next;
  try {
    if (next) globalThis.localStorage?.setItem(KEY, JSON.stringify(next));
    else globalThis.localStorage?.removeItem(KEY);
  } catch {
    // storage unavailable: the reason still holds for this session
  }
  listeners.forEach((listener) => listener());
}

export function usePrivateFailure(): PrivateFailure | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
    () => current,
  );
}

/**
 * Runs one private placement and keeps what went wrong. `before` is the toast list as the attempt started; the first
 * warning raised after it is the private route's own words (the desk's refusal, the lane's diagnosis, or an unknown
 * outcome). A placed bet clears the record.
 */
export async function recordPrivateAttempt(attempt: Promise<unknown>, before: readonly ToastItem[], after: () => readonly ToastItem[], thrown: (error: unknown) => void): Promise<void> {
  const seen = new Set(before.map((toast) => toast.id));
  try {
    await attempt;
  } catch (error) {
    thrown(error);
  }
  // The route's warning is raised just before it returns; let the toast list render once before reading it.
  await new Promise((resolve) => setTimeout(resolve, 60));
  const raised = after().filter((toast) => !seen.has(toast.id) && toast.tone === "warning");
  const last = raised.at(-1);
  if (last) {
    console.warn(`[private bet] not placed: ${last.title}${last.description ? ` — ${last.description}` : ""}`);
    write({ title: last.title, description: last.description ? plainSolanaError(last.description) : null, atMs: Date.now() });
  }
}

/**
 * A Solana error string carries its context base64-encoded in the "decode this error" hint; say it plainly: the RPC's own
 * status and message ("Too Many Requests, HTTP 429"). Anything else is shown as it came.
 */
export function plainSolanaError(text: string): string {
  const match = /#(\d+);.*'([A-Za-z0-9+/=]+)'/.exec(text);
  if (!match) return text;
  try {
    const params = new URLSearchParams(atob(match[2]!));
    const message = params.get("message");
    const status = params.get("statusCode");
    if (!message) return text;
    return `The RPC answered "${message}"${status ? ` (HTTP ${status})` : ""} · Solana error ${match[1]}`;
  } catch {
    return text;
  }
}

export function clearPrivateFailure(): void {
  if (current) write(null);
}

/**
 * The persistent line on the ticket: why the last private bet did not place, and where the money it moved now sits —
 * the private balance, which Portfolio can withdraw back to the wallet.
 */
export function PrivateFailureNote({ priv, decimals, symbol }: { priv: PrivateTicketState; decimals: number; symbol: string }) {
  const { color } = useTheme();
  const failure = usePrivateFailure();
  if (!failure) return null;
  const held = priv.budget?.balanceBase ?? null;
  return (
    <View style={[styles.box, { borderColor: color.warning, backgroundColor: color.surface1 }]} accessibilityRole="alert">
      <Text style={[TYPE.labelMicro, { color: color.warning }]}>Last private bet not placed</Text>
      <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{failure.title}</Text>
      {failure.description ? <Text style={[TYPE.caption, { color: color.inkSecondary }]} selectable>{plainSolanaError(failure.description)}</Text> : null}
      <Text style={[TYPE.caption, { color: color.inkSecondary }]}>
        {held !== null && held > 0n
          ? `${formatBaseUnits(held, decimals)} ${symbol} sits in your private balance. Only your wallet can withdraw it: Portfolio › Private balance.`
          : "Nothing was charged for the bet itself. Any top-up sits in your private balance on Portfolio."}
      </Text>
      <View style={styles.actions}>
        <Button label="Private balance" size="sm" variant="secondary" block={false} onPress={() => router.push("/portfolio")} />
        <Button label="Dismiss" size="sm" variant="ghost" block={false} onPress={clearPrivateFailure} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: RADIUS.lg, padding: 14, gap: 6 },
  actions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
});
