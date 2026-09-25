import { invalidateAfterWrite } from "@agari/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { useWalletSession } from "@/lib/wallet-session";
import { TradeFromX } from "~/features/x/TradeFromX";

/**
 * `/trade-from-x` — web's app/trade-from-x/page.tsx: the one island route. The app shell hides its strip, marquee and
 * header here (keeping the floating dock), so the screen paints its own top edge from the status bar down.
 */
export default function TradeFromXScreen() {
  const queryClient = useQueryClient();
  const { address } = useWalletSession();
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["agari"] }),
      address ? invalidateAfterWrite(queryClient, { wallet: address }) : null,
    ]);
  return <TradeFromX onRefresh={refresh} />;
}
