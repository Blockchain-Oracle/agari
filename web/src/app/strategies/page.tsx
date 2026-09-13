import type { Metadata } from "next";
import { StrategiesScreen } from "@/features/strategies";

export const metadata: Metadata = { title: "Strategies" };

/** The house runner's key is the server's to know; the studio names it when a creator picks "Let Masayume run it". */
export default function Page() {
  const houseRunner = process.env.STRATEGY_RUNNER_ADDRESS && /^0x[0-9a-fA-F]{40}$/.test(process.env.STRATEGY_RUNNER_ADDRESS) ? process.env.STRATEGY_RUNNER_ADDRESS.toLowerCase() : null;
  return <StrategiesScreen houseRunner={houseRunner} />;
}
