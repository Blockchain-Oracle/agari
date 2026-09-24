import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import { useNextWindowWidget } from "./useNextWindowWidget";
import { useWindowActivity } from "./useWindowActivity";
import { WidgetMarks } from "./WidgetMarks";

/**
 * How a notification shows while the app is open. A fill is the call this phone just placed (its receipt is on
 * screen), and the live-call notification is the Android twin of the Live Activity: both go to the list quietly.
 * Everything else — results, payouts — banners as it would with the app closed.
 */
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const kind = notification.request.content.data?.kind;
    const quiet = kind === "fill" || kind === "live";
    return { shouldShowBanner: !quiet, shouldShowList: true, shouldPlaySound: !quiet, shouldSetBadge: false };
  },
});

/** Only app paths are followed: a payload can never send the app to an arbitrary URL. */
const isAppPath = (path: unknown): path is string => typeof path === "string" && /^\/[A-Za-z0-9/_\-?=&.]*$/.test(path) && !path.startsWith("//");

/**
 * Phone alerts, mounted once at the root (S26.4): routes a tapped notification (also the one that launched the app)
 * to the screen it names, and runs the Live Activity / ongoing notification and the widget feed. Renders nothing.
 */
export function AlertsHost() {
  const response = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const id = response.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;
    const path = response.notification.request.content.data?.path;
    if (isAppPath(path)) router.push(path as never);
    void Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
  }, [response]);

  // Bumped whenever a stock mark lands in the app group, so the widget and the activity redraw with the logo.
  const [marksVersion, setMarksVersion] = useState(0);
  const bump = useCallback(() => setMarksVersion((v) => v + 1), []);
  const followed = useWindowActivity(marksVersion);
  const widgetAssets = useNextWindowWidget(marksVersion);
  const key = [followed, ...widgetAssets].filter(Boolean).join(",");
  const assets = useMemo(() => (key ? [...new Set(key.split(","))] : []), [key]);
  return Platform.OS === "ios" ? <WidgetMarks assets={assets} onReady={bump} /> : null;
}
