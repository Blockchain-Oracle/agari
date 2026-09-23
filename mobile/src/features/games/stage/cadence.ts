/** web's `cadenceLabel` (exported from the DOM `SwipeDeck.tsx`, so repeated here): a Window's interval as 5m / 1h / 30s. */
export function cadenceLabel(intervalSec: number): string {
  if (intervalSec % 3_600 === 0) return `${intervalSec / 3_600}h`;
  if (intervalSec % 60 === 0) return `${intervalSec / 60}m`;
  return `${intervalSec}s`;
}
