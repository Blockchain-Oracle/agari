import type { Metadata } from "next";
import { PortfolioScreen } from "@/features/markets/portfolio";
import { PORTFOLIO } from "@/lib/copy";

export const metadata: Metadata = { title: PORTFOLIO.title };

export default function Page() {
  return <PortfolioScreen />;
}
