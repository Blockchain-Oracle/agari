export const MARKETS_PATH = "/markets";

/** `?note=` carries a one-line explanation across a redirect (routing law: nothing 404s, moved routes say so). */
export const NOTE_PARAM = "note";

export const NOTE_KIND = {
  moved: "moved",
} as const;

export type NoteKind = (typeof NOTE_KIND)[keyof typeof NOTE_KIND];

export function marketsWithNote(kind: NoteKind): string {
  return `${MARKETS_PATH}?${NOTE_PARAM}=${kind}`;
}
