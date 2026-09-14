import { messageSignatureSchema } from "@agari/core/auth";
import { addressSchema } from "@agari/core/types";
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyWalletMessage } from "@/lib/auth/verify-signed-message.server";

/**
 * `/dev/wallet`'s round trip (S1 gate: "signed-message verify works"). The server gives its ed25519 verdict on the exact
 * text the wallet signed, and on the same text with one byte appended, which must fail. A verifier that says "valid" to
 * both would be broken, so the fixture shows both answers. Stateless: nothing is stored or trusted.
 */
export const runtime = "nodejs";

const bodySchema = z.object({ text: z.string().min(1).max(2_000), signature: messageSignatureSchema, signer: addressSchema });

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "expected { text, signature, signer } with a base58 signature and address" }, { status: 400 });
  const { text, signature, signer } = parsed.data;
  const [valid, tamperedValid] = await Promise.all([
    verifyWalletMessage({ text, signature, signer }),
    verifyWalletMessage({ text: `${text} `, signature, signer }),
  ]);
  return NextResponse.json({ valid, tamperedValid });
}
