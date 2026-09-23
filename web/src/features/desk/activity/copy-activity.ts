/** The activity timeline's words (S22). */
export const FILTERS = ["all", "acted", "declined", "asked", "quiet", "problems"] as const;
export type ActivityFilter = (typeof FILTERS)[number];

export const ACTIVITY = {
  aria: "The desk's checks, newest first",
  filtersAria: "Show only",
  filter: { all: "All", acted: "Acted", declined: "Decided not to", asked: "Asked you", quiet: "Quiet", problems: "Problems" } satisfies Record<ActivityFilter, string>,
  quietRun: (n: number, from: string, to: string) => `${n} quiet checks · ${from}–${to}`,
  today: "Today",
  yesterday: "Yesterday",
  emptyTitle: "No checks yet",
  emptyBody: "The first check runs at the top of the hour. Every one lands here, including the ones that find nothing to do.",
} as const;
