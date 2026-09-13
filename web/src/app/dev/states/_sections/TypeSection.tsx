import { SectionHeader } from "@/components/chrome";

const SAMPLES: readonly { utility: string; sample: string; ja?: boolean }[] = [
  { utility: "type-display", sample: "Masayume" },
  { utility: "type-headline", sample: "The dream that came true" },
  { utility: "type-title", sample: "Will BTC close above its open?" },
  { utility: "type-body", sample: "Calm, precise, honest. Numbers do the persuading." },
  { utility: "type-body-strong", sample: "Your stake is your max loss — always." },
  { utility: "type-caption", sample: "calculated in your browser from on-chain history" },
  { utility: "type-label-micro", sample: "01 · Live now" },
  { utility: "type-data", sample: "62¢ · 0x9f3b…f809 · 14:35:00 UTC" },
  { utility: "type-data-lg", sample: "10.00 tUSDC" },
  { utility: "type-data-hero", sample: "1,204.50" },
  { utility: "type-stamp", sample: "正夢", ja: true },
  { utility: "type-stamp-hero", sample: "逆夢", ja: true },
];

export function TypeSection() {
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader index="01" title="Type stack" eyebrow="four faces, four jobs" />
      <ul className="flex flex-col divide-y divide-hairline">
        {SAMPLES.map(({ utility, sample, ja }) => (
          <li key={utility} className="flex flex-col gap-1 py-3 md:flex-row md:items-baseline md:gap-6">
            <code className="numbers w-40 shrink-0 text-ink-muted type-caption">{utility}</code>
            <span className={`${utility} text-ink`} lang={ja ? "ja" : undefined}>
              {sample}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
