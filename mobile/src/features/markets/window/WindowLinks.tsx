import { TICKERS } from "@agari/core/market";
import type { EventMarket } from "@agari/core/types";
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { Button } from "~/components/kit";
import { NATIVE_MARKETS } from "../copy";

/**
 * Where a Window leads next, as web's hero offers it: the asset's own hub (`/tickers/<symbol>`) and Sensei, asked
 * about this Window (`/sensei?m=<id>`, web's SenseiDock).
 */
export function WindowLinks({ market }: { market: EventMarket }) {
  const ticker = TICKERS[market.asset];
  return (
    <View style={styles.row}>
      <Button
        label={NATIVE_MARKETS.links.sensei}
        variant="outline"
        size="sm"
        icon={{ ios: "sparkles", android: "auto_awesome" }}
        onPress={() => router.push({ pathname: "/sensei", params: { m: market.marketId } } as never)}
      />
      <Button
        label={NATIVE_MARKETS.links.ticker(ticker?.name ?? market.asset)}
        variant="ghost"
        size="sm"
        icon={{ ios: "building.columns", android: "account_balance" }}
        onPress={() => router.push({ pathname: "/tickers/[symbol]", params: { symbol: market.asset } } as never)}
      />
    </View>
  );
}

const styles = StyleSheet.create({ row: { gap: 8 } });
