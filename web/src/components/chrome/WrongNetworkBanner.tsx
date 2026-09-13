"use client";

import { TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BANNER, CONNECT } from "@/lib/copy";

interface WrongNetworkBannerProps {
  chainName: string;
  onSwitch: () => void;
  switching?: boolean;
}

/** Above content, never a modal; every write control beneath it renders blocked-with-reason. */
export function WrongNetworkBanner({ chainName, onSwitch, switching = false }: WrongNetworkBannerProps) {
  return (
    <div role="alert" className="flex items-center justify-between gap-3 border-b border-hairline bg-surface-2 px-gutter py-2 lg:px-gutter-desktop">
      <span className="flex items-center gap-2 type-caption text-ink">
        <TriangleAlertIcon className="size-4 shrink-0 text-warning" aria-hidden="true" />
        <span className="text-warning">{CONNECT.wrongChain}</span>
        <span>{BANNER.wrongNetwork(chainName)}</span>
      </span>
      <Button size="sm" onClick={onSwitch} disabled={switching}>
        {switching ? BANNER.switching : BANNER.switchTo(chainName)}
      </Button>
    </div>
  );
}
