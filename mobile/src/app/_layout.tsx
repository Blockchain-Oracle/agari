import { MarketsProvider } from "@agari/markets/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { UserSessionProvider } from "@/providers/UserSessionProvider";
import { marketsEnv } from "~/lib/env";
import { ThemeProvider, useTheme } from "~/theme";
import { useAppFonts } from "~/theme/fonts";
import { WalletProvider } from "~/wallet/WalletProvider";

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
    <QueryClientProvider client={client}>
      <MarketsProvider env={marketsEnv}>
        <ThemeProvider>
          <WalletProvider>
            <UserSessionProvider>
              <RootStack />
            </UserSessionProvider>
          </WalletProvider>
        </ThemeProvider>
      </MarketsProvider>
    </QueryClientProvider>
  );
}

function RootStack() {
  const { name, color } = useTheme();
  return (
    <>
      <StatusBar style={name === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.ground } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="connect" options={{ presentation: "formSheet", sheetAllowedDetents: [0.55, 0.9], sheetGrabberVisible: true, sheetCornerRadius: 24 }} />
        <Stack.Screen name="account" options={{ presentation: "formSheet", sheetAllowedDetents: [0.5], sheetGrabberVisible: true, sheetCornerRadius: 24 }} />
      </Stack>
    </>
  );
}
