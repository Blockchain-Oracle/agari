import { isOk } from "@agari/core/schemas";
import type { MarketId, OpenPosition } from "@agari/core/types";
import { collateralOrNull } from "@agari/markets";
import { useMarket, useOpeningPrice, usePositions } from "@agari/markets/react";
import * as Notifications from "expo-notifications";
import { after, type LiveActivity } from "expo-widgets";
import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { useOracleSpot } from "@/features/markets/hero/useOracleSpot";
import { useVerdict } from "@/features/markets/verdict/useVerdict";
import { useWalletSession } from "@/lib/wallet-session";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { activityProps, ongoingText, pickFollowed, sameFacts, VERDICT_WAIT_MS } from "./activity-model";
import { markUrl } from "./WidgetMarks";
import WindowActivity, { type WindowActivityProps } from "./WindowActivity";

/** A decided Window stays on the Lock Screen this long, then leaves on its own. */
const LINGER_MS = 15 * 60_000;
/** After this long past the bell with no verdict read, the activity ends plainly rather than hang. */
const GIVE_UP_MS = VERDICT_WAIT_MS;
/** Local updates are free, but facts that flap (a price) are sent at most this often. */
const MIN_UPDATE_MS = 4_000;
const ONGOING_ID = "agari-live-window";
export const LIVE_CHANNEL = "live";

/**
 * The Live Activity (iOS) and the ongoing notification (Android) for the bet this wallet holds that closes soonest
 * (S26.4). It starts when such a bet exists, follows the price against the opening print while the app runs (the
 * countdown runs natively on iOS), and ends with the verdict once the chain has it. Renders nothing.
 */
export function useWindowActivity(marksVersion: number): string | null {
  const { address } = useWalletSession();
  const nowMs = useChainNowMs();
  const positions = usePositions(address);
  const list = positions && isOk(positions) ? positions.value : null;
  const followed = list && nowMs > 0 ? pickFollowed(list, nowMs) : null;

  // The Window being shown: kept past its bell (it leaves the open list) until its verdict lands. A different bet
  // takes over only when it closes sooner than a shown one that is still trading.
  const [shown, setShown] = useState<OpenPosition | null>(null);
  useEffect(() => {
    if (!followed) return;
    if (shown === null) return setShown(followed);
    if (followed.marketId === shown.marketId) {
      if (followed !== shown) setShown(followed);
      return;
    }
    if (shown.expirySec * 1000 > nowMs && followed.expirySec < shown.expirySec) setShown(followed);
  }, [followed, shown, nowMs]);

  const marketId = (shown?.marketId ?? null) as MarketId | null;
  const opening = useOpeningPrice(marketId);
  const openingRaw = opening && isOk(opening) ? opening.value : null;
  // The Window itself names the lane: a 24/7 xStock Window is judged on the token's price, not the stock's.
  const followedWindow = useMarket(marketId);
  const spotRaw = useOracleSpot(followedWindow && isOk(followedWindow) ? followedWindow.value : null);
  const verdictState = useVerdict({ marketId, wallet: address });
  const verdictRead = verdictState.phase === "settled" && verdictState.verdict && isOk(verdictState.verdict) ? verdictState.verdict : null;
  const verdict = verdictRead?.value ?? null;
  /** Settled, read, and this wallet held nothing there (a bet cashed out before the bell). */
  const heldNothing = verdictRead !== null && verdictRead.value === null;

  // Built once: the iOS driver adopts whatever Live Activity survived the last launch.
  const driverRef = useRef<Driver | null>(null);
  driverRef.current ??= Platform.OS === "ios" ? iosDriver() : androidDriver();
  const driver = driverRef as { current: Driver };
  const last = useRef<{ props: WindowActivityProps; atMs: number; marks: number } | null>(null);

  useEffect(() => {
    if (!address) {
      void driver.current.end(null);
      last.current = null;
      setShown(null);
      return;
    }
    if (!shown) {
      // Positions read and nothing to follow: an activity adopted from the last launch has nothing left to say.
      if (list !== null && !followed) void driver.current.end(null);
      return;
    }
    const symbol = collateralOrNull()?.symbol;
    const pastBellMs = nowMs - shown.expirySec * 1000;
    const cashedOut = pastBellMs < 0 && list !== null && !list.some((p) => p.marketId === shown.marketId);
    if (heldNothing || cashedOut || (!verdict && pastBellMs > GIVE_UP_MS)) {
      void driver.current.end(null);
      last.current = null;
      setShown(null);
      return;
    }
    const props = activityProps({ position: shown, openingRaw, spotRaw, symbol, verdict, mark: Platform.OS === "ios" ? markUrl(shown.asset) : "" });
    const prev = last.current;
    // A mark that has just been written redraws the same facts, so the logo appears.
    if (prev && sameFacts(prev.props, props) && prev.marks === marksVersion && Platform.OS === "ios") return;
    if (prev && !props.result && nowMs - prev.atMs < MIN_UPDATE_MS) return;
    last.current = { props, atMs: nowMs, marks: marksVersion };
    if (props.result) {
      void driver.current.end(props);
      last.current = null;
      setShown(null);
    } else void driver.current.show(props, `agari://markets/${shown.marketId}`, nowMs);
  }, [address, shown, list, followed, openingRaw, spotRaw, verdict, heldNothing, nowMs, marksVersion]);

  return shown?.asset ?? null;
}

interface Driver {
  show(props: WindowActivityProps, url: string, nowMs: number): Promise<void>;
  /** Ends with a final state (the verdict), or quietly (`null`). */
  end(props: WindowActivityProps | null): Promise<void>;
}

function iosDriver(): Driver {
  let current: LiveActivity<WindowActivityProps> | null = null;
  let currentMs = 0;
  // A Live Activity outlives the app: whatever survived the last launch is adopted (and ended if nothing follows).
  const recovered = (() => {
    try {
      return WindowActivity.getInstances();
    } catch {
      return [];
    }
  })();
  current = recovered[0] ?? null;
  for (const extra of recovered.slice(1)) void extra.end("immediate").catch(() => undefined);
  return {
    async show(props, url) {
      try {
        if (current && currentMs !== props.closesAtMs && currentMs !== 0) {
          await current.end("immediate").catch(() => undefined);
          current = null;
        }
        if (current) await current.update(props, new Date(props.closesAtMs + GIVE_UP_MS));
        else current = WindowActivity.start(props, url, new Date(props.closesAtMs + GIVE_UP_MS));
        currentMs = props.closesAtMs;
      } catch {
        // Live Activities switched off in Settings, or the system refused one: the app goes on without it.
        current = null;
      }
    },
    async end(props) {
      if (!current) return;
      const ending = current;
      current = null;
      currentMs = 0;
      await ending.end(props ? after(new Date(Date.now() + LINGER_MS)) : "immediate", props ?? undefined, new Date()).catch(() => undefined);
    },
  };
}

function androidDriver(): Driver {
  let channelReady: Promise<unknown> | null = null;
  const ready = () =>
    (channelReady ??= Notifications.setNotificationChannelAsync(LIVE_CHANNEL, {
      name: "Live call",
      importance: Notifications.AndroidImportance.LOW,
      showBadge: false,
    }).catch(() => undefined));
  const post = async (props: WindowActivityProps, sticky: boolean, url: string | null) => {
    await ready();
    const { title, body } = ongoingText(props, Date.now());
    await Notifications.scheduleNotificationAsync({
      identifier: ONGOING_ID,
      content: { title, body, sticky, autoDismiss: !sticky, data: { kind: "live", path: url ? url.replace("agari://", "/") : "/portfolio" } },
      trigger: { channelId: LIVE_CHANNEL },
    }).catch(() => undefined);
  };
  let url: string | null = null;
  // Unknown at launch (a sticky one may survive a crash), so the first quiet end dismisses; later ones are free.
  let posted = true;
  return {
    async show(props, nextUrl) {
      url = nextUrl;
      posted = true;
      await post(props, true, url);
    },
    async end(props) {
      if (props) await post(props, false, url);
      else if (posted) await Notifications.dismissNotificationAsync(ONGOING_ID).catch(() => undefined);
      posted = false;
      url = null;
    },
  };
}
