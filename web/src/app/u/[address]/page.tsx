import { isAddress } from "@agari/core/types";
import { shortHex } from "@agari/core/units";
import { isDbConfigured, xLinkByWallet } from "@agari/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PROFILE } from "@/features/profile/copy";
import { ProfileScreen } from "@/features/profile/ProfileScreen";

interface Props {
  params: Promise<{ address: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { address } = await params;
  return { title: isAddress(address) ? PROFILE.title(shortHex(address)) : undefined };
}

/** A handle is shown only from a live `x_links` row (S11): a link the wallet signed, never a name someone typed. */
async function verifiedHandle(address: string): Promise<string | null> {
  if (!isDbConfigured()) return null;
  try {
    return (await xLinkByWallet(address))?.handle ?? null;
  } catch {
    return null;
  }
}

export default async function Page({ params }: Props) {
  const { address } = await params;
  // Base58 is case-sensitive (D-010): an address that isn't exactly one is no one's profile.
  if (!isAddress(address)) notFound();
  return <ProfileScreen address={address} xHandle={await verifiedHandle(address)} />;
}
