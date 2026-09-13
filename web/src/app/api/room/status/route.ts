import { isDbConfigured } from "@masayume/db";
import { NextResponse } from "next/server";

/**
 * Whether this deployment has a social store at all.
 *
 * The browser cannot know that, and it is the difference between "the Room is not
 * connected here" and "nobody has said anything" — two states that must never look
 * alike. Cheap enough to ask on open, and it reveals nothing but a boolean.
 */
export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({ configured: isDbConfigured() });
}
