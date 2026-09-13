import type { Metadata } from "next";
import { SurfaceScreen } from "@/features/surface";

export const metadata: Metadata = { title: "Market surface" };

export default function Page() {
  return <SurfaceScreen />;
}
