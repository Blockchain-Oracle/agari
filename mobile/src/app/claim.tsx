import { invalidateAfterWrite } from "@agari/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { CLAIM } from "@/features/x/copy";
import { useWalletSession } from "@/lib/wallet-session";
import { Screen } from "~/components/kit";
import { ClaimFlow } from "~/features/recovery/ClaimFlow";

/** `/claim` — X recovery: find and take the Trading Balance an X mention's trades landed in. */
export default function ClaimScreen() {
  const queryClient = useQueryClient();
  const { address } = useWalletSession();
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["agari", "x-status"] }),
      address ? invalidateAfterWrite(queryClient, { wallet: address }) : null,
    ]);
  return (
    <Screen title={CLAIM.title} onRefresh={refresh}>
      <ClaimFlow />
    </Screen>
  );
}
