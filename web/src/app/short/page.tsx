import type { Metadata } from "next";
import { ShortScreen } from "@/features/short";

export const metadata: Metadata = { title: "Short" };

export default function Page() {
  return <ShortScreen />;
}
