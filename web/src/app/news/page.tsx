import type { Metadata } from "next";
import { NEWS, NewsScreen } from "@/features/news";

export const metadata: Metadata = { title: NEWS.title };

export default function Page() {
  return <NewsScreen />;
}
