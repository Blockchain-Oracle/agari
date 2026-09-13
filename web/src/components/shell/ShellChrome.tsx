"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import CustomCursor from "./CustomCursor";
import Footer from "./Footer";
import GrainOverlay from "./GrainOverlay";
import Header from "./header/Header";
import Marquee from "./Marquee";
import { MobileBottomNav } from "./header/MobileBottomNav";

/**
 * Routes the reference renders WITHOUT the app's ticker, header and footer — each of those pages
 * mounts its own chrome (`app/trade-from-x/page.tsx` imports no `Header`/`Marquee`; its sticky
 * strip carries the primary nav instead). Every other route gets the shared shell.
 */
export const ISLAND_ROUTES: readonly string[] = ["/trade-from-x"];

export function isIslandRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return ISLAND_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

/** The shell, or none of it: islands paint their own edges, so the shell must not paint over them. */
export function ShellChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (isIslandRoute(pathname)) {
    return (
      <>
        <CustomCursor />
        <main className="page-island">{children}</main>
        <MobileBottomNav />
      </>
    );
  }
  return (
    <>
      <Marquee />
      <Header />
      <GrainOverlay />
      <CustomCursor />
      <main className="page-shell">{children}</main>
      <Footer />
    </>
  );
}
