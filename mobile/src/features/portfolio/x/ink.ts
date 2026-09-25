import { StyleSheet } from "react-native";
import { usePortfolioTokens } from "~/components/portfolio/web";
import { FONT } from "~/theme";
import { usePlateInk } from "../usePlateInk";

/** x-card.css `.xw` tokens: the plate's ink, muted ink, line and raised paper; vermilion, loss and mint fixed. */
export function useXInk(standalone = false) {
  const ink = usePlateInk();
  const t = usePortfolioTokens();
  return {
    ink: ink.ink,
    mute: ink.mute,
    line: standalone ? t.xFootLine : ink.line,
    paper: ink.raised,
    plate: ink.paper,
    v: t.vermilion,
    vBorder: t.actionBorder,
    loss: t.xLoss,
    mint: t.xMint,
    wash: t.xInkWash,
    slab: t.slabBorder,
    slabFill: t.actionWash,
    slabHard: t.xSlabHard,
    slabHardFill: t.xSlabHardFill,
    sourceOn: t.xSourceOn,
    permissionWash: t.xPermissionWash,
  };
}
export type XInk = ReturnType<typeof useXInk>;

/** x-card.css, rule for rule (px = pt). */
export const xs = StyleSheet.create({
  slab: { marginBottom: 16, borderRadius: 8, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 14 },
  slabQuiet: { borderWidth: 0, padding: 0, backgroundColor: "transparent" },
  slabTitle: { fontFamily: FONT.bodyBold, fontSize: 13, lineHeight: 20.8 },
  slabBody: { marginTop: 4, fontFamily: FONT.body, fontSize: 12, lineHeight: 16.5 },
  slabNote: { marginTop: 8, fontFamily: FONT.body, fontSize: 11, lineHeight: 15.1 },
  mono: { fontFamily: FONT.dataRegular },
  btnV: { marginTop: 10, flexDirection: "row", alignSelf: "flex-start", alignItems: "center", gap: 8, borderRadius: 12, borderWidth: 1, paddingVertical: 8, paddingHorizontal: 16 },
  btnVText: { fontFamily: FONT.bodyBold, fontSize: 14, lineHeight: 22.4 },
  btnInk: { flexDirection: "row", alignSelf: "flex-start", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, borderWidth: 1, paddingVertical: 8, paddingHorizontal: 16 },
  btnInkText: { fontFamily: FONT.bodyBold, fontSize: 12, lineHeight: 19.2 },
  err: { marginTop: 8, fontFamily: FONT.body, fontSize: 12, lineHeight: 19.2 },
  foot: { marginTop: 12, borderTopWidth: 1, paddingTop: 12, fontFamily: FONT.body, fontSize: 12, lineHeight: 19.2 },
  disabled: { opacity: 0.6 },
});
