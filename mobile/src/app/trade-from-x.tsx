import { invalidateAfterWrite } from "@agari/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { TRADE_FROM_X } from "@/features/x/copy";
import { useWalletSession } from "@/lib/wallet-session";
import { Screen } from "~/components/kit";
import { TradeFromX } from "~/features/x/TradeFromX";

/** `/trade-from-x` — web's X-trade: fund a bounded executor, link X, and post calls it places for you. */
export default function TradeFromXScreen() {
  const queryClient = useQueryClient();
  const { address } = useWalletSession();
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["agari"] }),
      address ? invalidateAfterWrite(queryClient, { wallet: address }) : null,
    ]);
  return (
    <Screen title={TRADE_FROM_X.title} onRefresh={refresh}>
      <TradeFromX />
    </Screen>
  );
}
