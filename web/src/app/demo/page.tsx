import type { Metadata } from "next";
import { DEMO, DemoPage } from "@/features/demo";

/** Images come from the site's file-based OG route (15a); a route-level image would outrank it with nothing better. */
export const metadata: Metadata = {
  title: DEMO.title,
  description: DEMO.video.description,
  alternates: { canonical: "/demo" },
  openGraph: {
    title: DEMO.video.title,
    description: DEMO.video.description,
    url: "/demo",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: DEMO.video.title,
    description: DEMO.video.description,
  },
};

export default function Page() {
  return <DemoPage />;
}
