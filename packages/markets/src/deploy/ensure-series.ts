/** Ensure-style: a Series, its append-only policy versions and its recyclable Books. */
import {
  AGARI_EVENTS_PROGRAM_ADDRESS,
  getAdminAddBookInstructionAsync,
  getAdminAddPolicyVersionInstructionAsync,
  getAdminRegisterSeriesInstructionAsync,
  type Series,
} from "@agari/clients/agari-events";
import {
  generateKeyPairSigner,
  getProgramDerivedAddress,
  getU16Encoder,
  getU32Encoder,
  getU8Encoder,
  type Address,
  type Instruction,
} from "@solana/kit";
import { getCreateAccountInstruction } from "@solana-program/system";
import { versionDiff } from "./policies";
import { assertNoDrift, diffField, send, type SeriesRecord, type StepContext } from "./send";
import { BOOK_CAPACITY, BOOKS_PER_SERIES, bookSpace, DEFAULT_ADDRESS, type SeriesSpec } from "./venue-spec";

/** `["series", ticker u16 LE, cadence_sec u32 LE, basis u8]` (events-accounts.md §2). */
export async function seriesAddress(ticker: number, cadenceSec: number, basis: number): Promise<Address> {
  const [address] = await getProgramDerivedAddress({
    programAddress: AGARI_EVENTS_PROGRAM_ADDRESS,
    seeds: ["series", getU16Encoder().encode(ticker), getU32Encoder().encode(cadenceSec), getU8Encoder().encode(basis)],
  });
  return address;
}

function seriesDiffs(chain: Series, spec: SeriesSpec): string[] {
  const out: string[] = [];
  diffField(out, "ticker", chain.ticker, spec.ticker);
  diffField(out, "cadenceSec", chain.cadenceSec, spec.cadenceSec);
  diffField(out, "basis", chain.basis, spec.basis);
  for (const [name, want] of Object.entries(spec.params)) diffField(out, name, chain[name as keyof typeof spec.params], want);
  if (chain.versionCount > spec.versions.length) out.push(`versionCount: chain ${chain.versionCount} > ${spec.versions.length} in price-sources.json`);
  for (let i = 0; i < Math.min(chain.versionCount, spec.versions.length); i++) {
    const v = spec.versions[i]!;
    out.push(...versionDiff(chain.policyVersions[i]!, v).map((d) => `version ${i + 1} ${d}`));
  }
  return out;
}

function addVersionIxs(ctx: StepContext, series: Address, spec: SeriesSpec, from: number): Promise<Instruction>[] {
  return spec.versions.slice(from).map((version, offset) =>
    getAdminAddPolicyVersionInstructionAsync({ admin: ctx.client.payer, series, index: from + offset, ...version }),
  );
}

/** A missing Series is registered together with every version, so it never lists without a source. */
export async function ensureSeries(ctx: StepContext, spec: SeriesSpec): Promise<Address> {
  const address = await seriesAddress(spec.ticker, spec.cadenceSec, spec.basis);
  const existing = await ctx.client.agariEvents.accounts.series.fetchMaybe(address);
  if (!existing.exists) {
    const register = getAdminRegisterSeriesInstructionAsync({
      admin: ctx.client.payer, series: address, ticker: spec.ticker, cadenceSec: spec.cadenceSec, basis: spec.basis, ...spec.params,
    });
    const ixs = await Promise.all([register, ...addVersionIxs(ctx, address, spec, 0)]);
    await send(ctx, `series ${spec.key}`, ixs, `registered ${address} with ${spec.versions.length} policy version(s)`);
  } else {
    assertNoDrift(`Series ${spec.key}`, seriesDiffs(existing.data, spec));
    const have = existing.data.versionCount;
    if (have < spec.versions.length) {
      const ixs = await Promise.all(addVersionIxs(ctx, address, spec, have));
      await send(ctx, `versions ${spec.key}`, ixs, `appended versions ${have + 1}..${spec.versions.length}`);
    } else {
      ctx.log({ step: `series ${spec.key}`, signature: null, note: `exists ${address}, ${have} version(s) match` });
    }
  }
  const prior = ctx.record.series?.[spec.key];
  const entry: SeriesRecord = { address, ticker: spec.ticker, cadenceSec: spec.cadenceSec, basis: spec.basis, books: prior?.books ?? [] };
  if (prior && prior.address !== address) assertNoDrift(`Series ${spec.key}`, [`recorded ${prior.address} ≠ derived ${address}`]);
  ctx.save({ ...ctx.record, series: { ...ctx.record.series, [spec.key]: entry } });
  return address;
}

/**
 * Books are keypair accounts, so only the record and the Series' free list know them. Both are read back and every
 * known Book is verified before any new one is created, so a crash between confirm and save never adds a third.
 */
export async function ensureBooks(ctx: StepContext, spec: SeriesSpec, series: Address): Promise<Address[]> {
  const chain = await ctx.client.agariEvents.accounts.series.fetch(series);
  const free = chain.data.freeBooks.slice(0, chain.data.freeBookCount).filter((b) => b !== DEFAULT_ADDRESS);
  const known = [...new Set([...(ctx.record.series?.[spec.key]?.books ?? []), ...free])] as Address[];
  const books = await ctx.client.agariEvents.accounts.book.fetchAll(known);
  const diffs = books.flatMap((b) => (b.data.series === series ? [] : [`book ${b.address} belongs to ${b.data.series}`]));
  assertNoDrift(`Books of ${spec.key}`, diffs);

  const saveBooks = (list: Address[]) =>
    ctx.save({ ...ctx.record, series: { ...ctx.record.series, [spec.key]: { ...ctx.record.series![spec.key]!, books: list } } });
  saveBooks(known);
  for (let n = known.length; n < BOOKS_PER_SERIES; n++) {
    const book = await generateKeyPairSigner();
    const space = bookSpace(BOOK_CAPACITY);
    const lamports = await ctx.client.getMinimumBalance(space);
    const create = getCreateAccountInstruction({ payer: ctx.client.payer, newAccount: book, lamports, space, programAddress: AGARI_EVENTS_PROGRAM_ADDRESS });
    const add = await getAdminAddBookInstructionAsync({ admin: ctx.client.payer, series, book: book.address, capacity: BOOK_CAPACITY });
    await send(ctx, `book ${spec.key}#${n + 1}`, [create, add], `created ${book.address} (${BOOK_CAPACITY} nodes, ${lamports} lamports)`);
    known.push(book.address);
    saveBooks(known);
  }
  if (known.length > BOOKS_PER_SERIES) ctx.log({ step: `books ${spec.key}`, signature: null, note: `${known.length} books (more than ${BOOKS_PER_SERIES})` });
  return known;
}
