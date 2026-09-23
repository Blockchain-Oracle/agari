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
import { Toaster } from "~/components/toast/Toaster";
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
  return (
    <>
      <StatusBar style={name === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.ground } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="connect" options={{ presentation: "formSheet", sheetAllowedDetents: [0.55, 0.9], sheetGrabberVisible: true, sheetCornerRadius: 24 }} />
        <Stack.Screen name="ticket" options={{ presentation: "formSheet", sheetAllowedDetents: [0.92], sheetGrabberVisible: true, sheetCornerRadius: 24 }} />
        <Stack.Screen name="funds" options={{ presentation: "formSheet", sheetAllowedDetents: [0.75, 1], sheetGrabberVisible: true, sheetCornerRadius: 24 }} />
        <Stack.Screen name="account" options={{ presentation: "formSheet", sheetAllowedDetents: [0.5], sheetGrabberVisible: true, sheetCornerRadius: 24 }} />
      </Stack>
      <Toaster />
    </>
  );
}
