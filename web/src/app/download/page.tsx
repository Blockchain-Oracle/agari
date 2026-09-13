import type { Metadata } from "next";
import { DownloadPage, INSTALL } from "@/features/install";

export const metadata: Metadata = { title: INSTALL.title };

export default function Page() {
  return <DownloadPage />;
}
