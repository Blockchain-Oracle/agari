import { diagnosis, err, ok } from "@masayume/core";
import type { Address } from "@masayume/core/types";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ collateral: vi.fn(), balance: vi.fn(), portfolio: vi.fn() }));
vi.mock("../collateral", () => ({ loadCollateral: mocks.collateral }));
vi.mock("../runtime/read-runtime", () => ({ getClient: () => ({ getErc20Balance: mocks.balance, getPortfolio: mocks.portfolio }) }));
import { getWalletCollateral } from "./wallet-collateral";
import { forgetReading } from "./reading";

const wallet = `0x${"aa".repeat(20)}` as Address;
const token = `0x${"bb".repeat(20)}` as Address;
beforeEach(() => {
  vi.resetAllMocks();
  forgetReading(`wallet-collateral:${wallet}`);
  mocks.collateral.mockResolvedValue(ok({ address: token, decimals: 6, symbol: "tUSDC" }, Date.now()));
  mocks.balance.mockResolvedValue(123_456_789n);
  mocks.portfolio.mockRejectedValue(new Error("Portfolio indexer unavailable"));
});

it("reads the token without portfolio or venue discovery and retains a labelled last balance on RPC failure", async () => {
  const first = await getWalletCollateral(wallet);
  expect(first).toMatchObject({ ok: true, stale: false, value: { amountBase: 123_456_789n, decimals: 6, symbol: "tUSDC" } });
  expect(mocks.balance).toHaveBeenCalledWith(token, wallet);
  expect(mocks.portfolio).not.toHaveBeenCalled();
  mocks.balance.mockRejectedValue(new Error("RPC unavailable"));
  expect(await getWalletCollateral(wallet)).toMatchObject({ ...first, stale: true, staleReason: "refresh-failed" });
});

it("does not guess decimals or show zero when metadata fails", async () => {
  mocks.collateral.mockResolvedValue(err(diagnosis("rpc-down", "metadata unavailable")));
  expect(await getWalletCollateral(wallet)).toMatchObject({ ok: false });
  expect(mocks.balance).not.toHaveBeenCalled();
});
