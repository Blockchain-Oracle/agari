import type { Metadata } from "next";
import { SURFACE } from "@/features/surface";
import { SurfaceFixtures } from "./SurfaceFixtures";

export const metadata: Metadata = { title: `Fixtures · ${SURFACE.devTitle}` };

export default function SurfaceFixturesPage() {
  return <SurfaceFixtures />;
}
