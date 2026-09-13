import type { Metadata } from "next";
import { AppStrip, ShellChrome } from "@/components/shell";
import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BRAND } from "@/lib/copy";
import { fontVariables } from "@/lib/fonts";
import { cn } from "@/lib/utils";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { AppProviders } from "@/providers";
import "@/styles/index.css";

export const metadata: Metadata = {
  title: { default: BRAND.name, template: `%s · ${BRAND.name}` },
  description: `${BRAND.name} — ${BRAND.tagline}. Live price windows, one-tap calls, and settlement receipts you can click.`,
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: BRAND.name },
  other: { "mobile-web-app-capable": "yes" },
  // The installable web app: the manifest carries the identity, colours and icons (public/).
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn("antialiased cursor-custom", fontVariables)} suppressHydrationWarning>
        {/* Paint the resolved theme on the FIRST frame (no flash of dark). Runs
            synchronously before the app renders; mirrors lib/theme resolveTheme. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <AppStrip />
        <AppProviders>
          <TooltipProvider>
            <Toaster limit={1}>
              {/* The ticker, header and footer — or, on the reference's island routes, none of them. */}
              <ShellChrome>{children}</ShellChrome>
            </Toaster>
          </TooltipProvider>
        </AppProviders>
      </body>
    </html>
  );
}
