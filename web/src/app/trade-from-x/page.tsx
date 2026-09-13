import type { Metadata } from "next";
import { TRADE_FROM_X, TradeFromXScreen } from "@/features/x";
import "@/features/x/x.css";
import "@/features/x/x-card.css";

export const metadata: Metadata = { title: TRADE_FROM_X.title };

export default function Page() {
  return <TradeFromXScreen />;
}
