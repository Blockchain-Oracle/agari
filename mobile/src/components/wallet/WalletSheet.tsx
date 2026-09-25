import { router } from "expo-router";
import type { MutableRefObject, ReactNode } from "react";
import { WALLET_MODAL } from "@/providers/wallet/copy";
import { BottomDrawer, type DrawerClose } from "~/components/drawer/BottomDrawer";
import { useTheme } from "~/theme";

/** Leaves the route the dialog lives on, or lands on Markets when it was opened cold. */
export function dismiss(): void {
  if (router.canGoBack()) router.back();
  else router.replace("/markets");
}

/**
 * web `WalletDialog` below 768 px — RainbowKit's bottom sheet on surface-1 — drawn as the app's one `BottomDrawer`, so
 * connect and account share its spring, grab handle and drag-to-dismiss with Add funds and the ticket.
 */
export function WalletSheet({ children, onClose = dismiss, closeRef }: { children: ReactNode; onClose?: () => void; closeRef?: MutableRefObject<DrawerClose | null> }) {
  const { color } = useTheme();
  return (
    <BottomDrawer onClose={onClose} background={color.surface1} closeLabel={WALLET_MODAL.close} closeRef={closeRef}>
      {children}
    </BottomDrawer>
  );
}
