import type { Metadata } from "next";
import { DEMO, DemoPage } from "@/features/demo";

export const metadata: Metadata = {
  title: DEMO.title,
  description: DEMO.video.description,
  alternates: { canonical: "https://masayume.app/demo" },
  openGraph: {
    title: DEMO.video.title,
    description: DEMO.video.description,
    url: "https://masayume.app/demo",
    type: "website",
    images: [{ url: DEMO.video.coverUrl, alt: DEMO.video.title }],
  },
  twitter: {
    card: "summary_large_image",
    title: DEMO.video.title,
    description: DEMO.video.description,
    images: [DEMO.video.coverUrl],
  },
};

export default function Page() {
  return <DemoPage />;
}
