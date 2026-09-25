import { StyleSheet } from "react-native";
import { FONT, useTheme } from "~/theme";
import { ticketTokens, type TicketTokens } from "~/theme/web/markets-ticket";

/** The ticket's web tokens for the theme in force. */
export function useTk(): TicketTokens {
  return ticketTokens(useTheme().name);
}

/**
 * The type the ticket's blocks share, as web computes it (letter-spacing em → points at each size): the mono
 * control label (`.tk-amount-label`, `.tk-control-label`), the mono chip (`.tk-add`, `.tk-lev`), the mono caption
 * (`.tk-caption`, `.tk-note`, `.tk-foot`) and the tray tile (`.tk-mode`, `.tk-pp-btn`).
 */
export const tkType = StyleSheet.create({
  label: { fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14.4, letterSpacing: 1.44, textTransform: "uppercase" },
  chip: { fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14.4, textAlign: "center" },
  caption: { fontFamily: FONT.dataRegular, fontSize: 8.5, lineHeight: 13.8 },
  tile: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 1.4, textTransform: "uppercase", textAlign: "center" },
  /** type-caption (Inter 13 / 1.45) */
  body: { fontFamily: FONT.body, fontSize: 13, lineHeight: 18.85 },
});
