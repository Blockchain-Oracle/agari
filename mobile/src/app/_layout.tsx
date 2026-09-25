import { MarketsProvider } from "@agari/markets/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, usePathname } from "expo-router";
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
import { Toaster } from "~/components/toast/Toaster";
import { AlertsHost } from "~/features/alerts/AlertsHost";
import { DeskWatcher } from "~/features/desk/DeskWatcher";
import { DropBellWatcher } from "~/features/hedge/DropBell";
import { WriteRecovery } from "~/features/recovery/WriteRecovery";
import { WalletProvider } from "~/wallet/WalletProvider";
import { trackPath } from "~/web-shims/url-state";

SplashScreen.preventAutoHideAsync();

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
  // web's ShellChrome: every route gets the strip, marquee and header, and the floating dock; the first-run welcome
  // paints its own screen, and /trade-from-x is web's one island (its own top edge, the dock kept).
  const bare = pathname === "/welcome";
  const island = pathname.startsWith("/trade-from-x");
  return (
    <>
      <StatusBar style={name === "dark" ? "light" : "dark"} />
      {bare || island ? null : <AppChrome />}
      <Stack screenOptions={{ headerShown: false, headerStyle: { backgroundColor: color.ground }, headerTintColor: color.ink, headerBackTitle: "Back", contentStyle: { backgroundColor: color.ground } }}>
        <Stack.Screen name="welcome" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="connect" options={{ presentation: "formSheet", sheetAllowedDetents: [0.78, 1], sheetGrabberVisible: true, sheetCornerRadius: 24 }} />
        <Stack.Screen name="ticket" options={{ presentation: "formSheet", sheetAllowedDetents: [0.92], sheetGrabberVisible: true, sheetCornerRadius: 24 }} />
        <Stack.Screen name="funds" options={{ presentation: "formSheet", sheetAllowedDetents: [0.75, 1], sheetGrabberVisible: true, sheetCornerRadius: 24 }} />
        <Stack.Screen name="account" options={{ presentation: "formSheet", sheetAllowedDetents: [0.5], sheetGrabberVisible: true, sheetCornerRadius: 24 }} />
        <Stack.Screen name="sensei" options={{ presentation: "modal", gestureEnabled: true }} />
      </Stack>
      {bare ? null : <BottomDock />}
      <Toaster />
      <DeskWatcher />
      {/* web mounts the drop alert's watcher app-wide (AppProviders), so an armed bell fires on any screen. */}
      <DropBellWatcher />
      <WriteRecovery />
      {/* S26.4: notification taps, the Live Activity (Android: ongoing notification) and the widget feed. */}
      <AlertsHost />
    </>
  );
}
