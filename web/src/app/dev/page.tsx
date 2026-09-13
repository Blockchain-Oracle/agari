import Link from "next/link";
import { SectionHeader } from "@/components/chrome";
import { DEV } from "@/lib/copy";

const FIXTURES = [
  { href: "/dev/states", label: "States", note: "honest-state primitives, data, chrome, receipt, ui" },
  { href: "/dev/wallet", label: "Wallet", note: "connect ladder, network banner, balance plate, faucet" },
  { href: "/dev/hero", label: "Hero market", note: "chart as ticket on the soonest live window (?m= to pick one)" },
  { href: "/dev/balance", label: "Balance plate", note: "every money state from canned sheets, then live" },
  { href: "/dev/verdict", label: "Verdict", note: "win, loss, void, both-sides-net, then live (?m=)" },
  { href: "/dev/claims", label: "Claim-all", note: "idle plate, mid-run progress, success receipt, then live" },
  { href: "/dev/history", label: "Fill projection", note: "settled rows, record, Trader Edge and leaderboard from canned rounds" },
  { href: "/dev/takes", label: "Takes", note: "the take card — backed, open, no note, closed Window" },
  { href: "/dev/share", label: "Share cards", note: "The Call on screen, then both PNG exports from canned records" },
  { href: "/dev/port", label: "Chain port", note: "live lanes as Reading<LaneSet>, venue and clock" },
  { href: "/dev/boot", label: "Boot check", note: "zero-env round-trip to the Shannon indexer" },
  { href: "/dev/strategies", label: "Strategies", note: "record card, archive tiers, runner pulse states, recent copy-trades, not-deployed" },
  { href: "/dev/x", label: "X rail", note: "the X-Predict wallet card in every link state, the claim ticket, receipts of every status" },
  { href: "/dev/session", label: "Session key", note: "tap-trading chip, manager, route control, enable sheet — canned states, then live" },
  { href: "/dev/vault", label: "Trading Balance", note: "every vault state from canned readings, the pool row, open vault bets, then live" },
  { href: "/dev/parlay", label: "Parlay", note: "every slip card and every ticket state from canned readings; the builder is live on /parlay" },
  { href: "/dev/private", label: "Private", note: "the route control, the budget line, the desk's quote rows, the claims list with real signatures, then the live panel" },
  { href: "/dev/surface", label: "Surface", note: "the book tiles, the depth chart, the slippage ladder and the term structure from canned books; live on /surface" },
] as const;

export default function DevIndexPage() {
  return (
    <div className="mx-auto flex w-full max-w-(--content-reading) flex-col gap-6 px-gutter py-8">
      <SectionHeader index="00" title={DEV.title} />
      <p className="type-body text-ink-secondary">{DEV.intro}</p>
      <ul className="flex flex-col gap-3">
        {FIXTURES.map(({ href, label, note }) => (
          <li key={href} className="flex flex-col gap-1 rounded-lg border border-hairline bg-surface-1 p-4">
            <Link href={href} className="type-body-strong text-ink hover:text-accent">
              {label} →
            </Link>
            <span className="type-caption text-ink-secondary">{note}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
