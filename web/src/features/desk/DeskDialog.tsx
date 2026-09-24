"use client";

import { Dialog } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * The desk's one modal frame, after 21st's Credenza (#1354: a dialog on desktop, a drawer on phones) done in CSS so
 * the server and client agree: a centred panel from 768 px up, a bottom sheet below it. Above the header and nav.
 */
export function DeskDialog({ open, onOpenChange, title, children }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; children: ReactNode }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="dk-dialog-backdrop" />
        <Dialog.Viewport className="dk-dialog-viewport">
          <Dialog.Popup className="dk-dialog">
            <Dialog.Title className="sr-only">{title}</Dialog.Title>
            <Dialog.Close className="dk-dialog-close" aria-label="Close">
              <XIcon aria-hidden />
            </Dialog.Close>
            {children}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
