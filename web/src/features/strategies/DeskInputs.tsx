import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { STRATEGIES } from "./copy";
import { RISK_MODES, type RiskMode } from "./format";
import "./desk.css";

const chipCls = "desk-chip desk-chip-sized rounded-md border px-2 py-0.5 font-mono hover:border-vermilion/50 transition-colors";

/** One amount input in the house style: big figure, unit tag, hint line, additive chips (`AmountRow`). */
export function AmountRow(props: { value: string; onChange: (s: string) => void; hint: ReactNode; chips: number[]; onChip: (n: number) => void; extra?: ReactNode; action?: ReactNode; symbol: string }) {
  const { value, onChange, hint, chips, onChip, extra, action, symbol } = props;
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
      <div className="desk-amount min-w-0 flex-1 rounded-xl border px-4 py-2 transition-colors focus-within:border-vermilion/50 sm:max-w-xs">
        <div className="flex items-center justify-between">
          <input inputMode="decimal" placeholder="0.00" value={value} onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))} className="desk-amount-input desk-amount-figure" aria-label="Amount" />
          <span className="desk-amount-unit desk-note shrink-0 font-semibold">{symbol}</span>
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="desk-amount-hint desk-fine min-w-0">{hint}</span>
          <div className="flex shrink-0 gap-1.5">
            {chips.map((n) => (
              <button key={n} type="button" onClick={() => onChip(n)} className={chipCls}>
                +{n}
              </button>
            ))}
            {extra}
          </div>
        </div>
      </div>
      {action && <div className="shrink-0 self-start sm:self-center">{action}</div>}
    </div>
  );
}

export function MaxChip({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={chipCls}>
      max
    </button>
  );
}

export function RiskModePicker({ value, onChange }: { value: RiskMode; onChange: (mode: RiskMode) => void }) {
  return (
    <div>
      <div className="desk-eyebrow mb-1.5 text-ink/35">{STRATEGIES.desk.risk.title}</div>
      <div className="desk-modes" role="radiogroup" aria-label="Copy trading risk mode">
        {RISK_MODES.map((mode) => {
          const selected = mode.id === value;
          return (
            <button key={mode.id} type="button" role="radio" aria-checked={selected} onClick={() => onChange(mode.id)} className={cn("desk-mode", selected && "desk-mode--on")}>
              <span className={cn("desk-mode-label", selected ? "text-ink" : "text-ink/60")}>{mode.label}</span>
              <span className="desk-mode-detail">{mode.detail}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** The advanced guardrail editor only exposes the one value users may need to tune. */
export function CapsEditor({ capStr, setCapStr, suggested, symbol }: { capStr: string; setCapStr: (s: string) => void; suggested: string; symbol: string }) {
  return (
    <label className="block">
      <span className="desk-field-label">{STRATEGIES.desk.capsLabel}</span>
      <div className="desk-caps">
        <input inputMode="decimal" placeholder={STRATEGIES.desk.suggested(suggested)} value={capStr} onChange={(e) => setCapStr(e.target.value.replace(/[^0-9.]/g, ""))} className="desk-caps-input" />
        <span className="desk-fine ml-1 shrink-0 text-ink-muted">{symbol}</span>
      </div>
    </label>
  );
}

/** One cell of the record trio under the sparkline. A loss reads in muted white — a fact, not a scare. */
export function RecordStat({ label, value, accent }: { label: string; value: string; accent?: "up" | "down" }) {
  const tone = accent === "up" ? "text-vermilion" : accent === "down" ? "text-ink/80" : "text-ink";
  return (
    <div>
      <div className="desk-eyebrow mb-1.5 whitespace-normal text-ink/40">{label}</div>
      <div className={cn("desk-trio-value", tone)}>{value}</div>
    </div>
  );
}
