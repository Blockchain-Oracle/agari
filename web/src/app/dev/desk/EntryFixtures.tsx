"use client";

import { Lock } from "lucide-react";
import { SectionHeader } from "@/components/chrome";
import { EmptyState } from "@/components/ui/desk-kit";
import { DESK } from "@/features/desk/copy";
import { DeskEntry, SHARED_DESK_ID } from "@/features/desk/entry/DeskEntry";
import { DeskSkeleton } from "@/features/desk/entry/DeskSkeleton";
import { ENTRY } from "@/features/desk/entry/copy-entry";
import { SharedDeskCard } from "@/features/desk/entry/SharedDeskPreview";
import { deskView } from "@/features/desk/view";
import { VIEWS } from "./fixtures";
import { Fixture } from "../states/_sections/Fixture";

const DEV = {
  entry: "/desk before there is a desk — the entry, with a shared desk",
  entryLive: "The entry reading the real shared desk (unavailable where this index lacks it)",
  entryNoPreview: "The entry with no shared desk to show",
  loading: "The desk page while it loads",
  notShared: "Someone else's desk that is not shared",
} as const;

/** S22: the `/desk` entry, the desk's loading shape and its private-desk notice. */
export function EntryFixtures() {
  return (
    <section className="flex flex-col gap-4" id="entry-fixtures">
      <SectionHeader index="13" title={DEV.entry} />
      <div id="entry-main">
        <Fixture label={DEV.entry}>
          <DeskEntry sharedId={SHARED_DESK_ID} preview={<SharedDeskCard id={SHARED_DESK_ID} view={deskView(VIEWS.shared)} />} />
        </Fixture>
      </div>
      <Fixture label={DEV.entryLive}>
        <DeskEntry sharedId={SHARED_DESK_ID} />
      </Fixture>
      <Fixture label={DEV.entryNoPreview}>
        <DeskEntry sharedId={null} />
      </Fixture>
      <Fixture label={DEV.loading}>
        <DeskSkeleton />
      </Fixture>
      <Fixture label={DEV.notShared}>
        <EmptyState icon={<Lock />} title={ENTRY.notSharedTitle} body={DESK.visitor} />
      </Fixture>
    </section>
  );
}
