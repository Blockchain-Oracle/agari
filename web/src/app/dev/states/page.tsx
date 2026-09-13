import type { Metadata } from "next";
import { ChromeSection } from "./_sections/ChromeSection";
import { DataSection } from "./_sections/DataSection";
import { HonestStatesSection } from "./_sections/HonestStatesSection";
import { ReceiptSection } from "./_sections/ReceiptSection";
import { TypeSection } from "./_sections/TypeSection";
import { UiSection } from "./_sections/UiSection";

export const metadata: Metadata = { title: "Fixtures · states" };

export default function StatesPage() {
  return (
    <div className="mx-auto flex w-full max-w-(--content-wide) flex-col gap-section px-gutter py-8 lg:px-gutter-desktop">
      <TypeSection />
      <HonestStatesSection />
      <DataSection />
      <ChromeSection />
      <ReceiptSection />
      <UiSection />
    </div>
  );
}
