import type { Metadata } from "next";
import { HOW_IT_WORKS, HowItWorksPage } from "@/features/how-it-works";

export const metadata: Metadata = { title: HOW_IT_WORKS.title };

export default function Page() {
  return <HowItWorksPage />;
}
