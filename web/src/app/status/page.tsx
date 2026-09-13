import type { Metadata } from "next";
import { STATUS, StatusScreen } from "@/features/status";

export const metadata: Metadata = { title: STATUS.title };

export default function Page() {
  return <StatusScreen />;
}
