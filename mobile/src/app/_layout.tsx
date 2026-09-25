import { MarketsProvider } from "@agari/markets/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router, Stack, useGlobalSearchParams, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SessionKeyProvider } from "@/features/session/SessionKeyProvider";
import { UserSessionProvider } from "@/providers/UserSessionProvider";
import { marketsEnv } from "~/lib/env";
import { ThemeProvider, useTheme } from "~/theme";
import { useAppFonts } from "~/theme/fonts";
import { AppChrome } from "~/components/shell/AppChrome";
import { BottomDock } from "~/components/shell/BottomDock";
import { useImmersive } from "~/components/shell/immersive";
import { FundingHost } from "~/components/funding/CreditWelcome";
import { AlertsWatcher } from "@/features/alerts/AlertsWatcher";
import { LifecycleWatcher } from "~/features/activity/LifecycleWatcher";
import { Toaster } from "~/components/toast/Toaster";
import { AlertsHost } from "~/features/alerts/AlertsHost";
import { DeskWatcher } from "~/features/desk/DeskWatcher";
import { DropBellWatcher } from "~/features/hedge/DropBell";
import { WriteRecovery } from "~/features/recovery/WriteRecovery";
import { WalletProvider } from "~/wallet/WalletProvider";
import { trackPath } from "~/web-shims/url-state";

SplashScreen.preventAutoHideAsync();

/** web's dialogs (connect sheet, Add funds card, account) draw their own scrim, so the native layer is only a clear host. */
const dialog = { presentation: "transparentModal", animation: "none", contentStyle: { backgroundColor: "transparent" } } as const;

export default function RootLayout() {
  // Web's defaults (providers/query-client.ts): 5 s fresh, one retry.
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 5_000, retry: 1 } } }));
  const fontsReady = useAppFonts();
  useEffect(() => {
    if (fontsReady) SplashScreen.hideAsync();
  }, [fontsReady]);
  if (!fontsReady) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <QueryClientProvider client={client}>
      <MarketsProvider env={marketsEnv}>
        <ThemeProvider>
          <WalletProvider>
            <UserSessionProvider>
              <SessionKeyProvider>
                <RootStack />
              </SessionKeyProvider>
            </UserSessionProvider>
          </WalletProvider>
        </ThemeProvider>
      </MarketsProvider>
    </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

function RootStack() {
  const { name, color } = useTheme();
  const pathname = usePathname();
  useEffect(() => trackPath(pathname), [pathname]);
  // web's ShellChrome: every route gets the strip, marquee and header, and the floating dock; /trade-from-x is web's
  // one island (its own top edge, the dock kept). Dialogs (welcome, connect, funds, account) are transparent modals
  // over it, each drawing web's own scrim and card or sheet.
  const island = pathname.startsWith("/trade-from-x");
  // An arcade run in play takes the whole phone: the chrome and the dock step out (and the marquee stops scrolling).
  const immersive = useImmersive();
  const { welcome } = useGlobalSearchParams<{ welcome?: string }>();
  useEffect(() => {
    if (welcome === "1") router.push("/welcome");
  }, [welcome]);
  return (
    <>
      <StatusBar style={name === "dark" ? "light" : "dark"} />
      {island || immersive ? null : <AppChrome />}
      <Stack screenOptions={{ headerShown: false, headerStyle: { backgroundColor: color.ground }, headerTintColor: color.ink, headerBackTitle: "Back", contentStyle: { backgroundColor: color.ground } }}>
        <Stack.Screen name="welcome" options={{ presentation: "transparentModal", animation: "fade", contentStyle: { backgroundColor: "transparent" } }} />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="connect" options={dialog} />
        <Stack.Screen name="ticket" options={dialog} />
        <Stack.Screen name="funds" options={dialog} />
        <Stack.Screen name="account" options={dialog} />
        <Stack.Screen name="sensei" options={dialog} />
      </Stack>
      {immersive ? null : <BottomDock />}
      <FundingHost />
      <Toaster />
      <DeskWatcher />
      {/* web's LifecycleWatcher: in-app toasts for fills, verdicts and payouts (system notifications come from push). */}
      <LifecycleWatcher />
      {/* web mounts its price-alert watcher app-wide (AppProviders), so an armed alert fires on any screen. */}
      <AlertsWatcher />
      {/* web mounts the drop alert's watcher app-wide (AppProviders), so an armed bell fires on any screen. */}
      <DropBellWatcher />
      <WriteRecovery />
      {/* S26.4: notification taps, the Live Activity (Android: ongoing notification) and the widget feed. */}
      <AlertsHost />
    </>
  );
}
