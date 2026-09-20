import { messageSignatureSchema } from "@agari/core/auth";
import { readMemoryMessage, sealMemoryMessage, SEALED_BODY_MAX, SEALED_TITLE_MAX } from "@agari/core/strategies";
import { addressSchema } from "@agari/core/types";
import { z } from "zod";

/** The two signed texts live in `@agari/core/strategies` (pure), so the routes, the browser and the devnet drive sign and verify one string. */
export { readMemoryMessage, sealMemoryMessage, SEALED_BODY_MAX, SEALED_TITLE_MAX };

const strategyId = z.string().regex(/^\d+$/);

export const sealMemoryRequestSchema = z.object({
  strategyId,
  creator: addressSchema,
  issuedAtMs: z.number().int(),
  title: z.string().trim().min(1).max(SEALED_TITLE_MAX),
  body: z.string().min(1).max(SEALED_BODY_MAX),
  signature: messageSignatureSchema,
});

export const readMemoryRequestSchema = z.object({
  strategyId,
  reader: addressSchema,
  issuedAtMs: z.number().int(),
  signature: messageSignatureSchema,
});

export const readMemoryResponseSchema = z.object({ title: z.string(), body: z.string(), updatedAtMs: z.number() });
export type SealedMemory = z.infer<typeof readMemoryResponseSchema>;

/** What the catalogue may show of a sealed memory: that it exists, its title and its length. Never the body. */
export const sealedMemoryWireSchema = z.object({ title: z.string(), chars: z.number(), updatedAtMs: z.number() });
