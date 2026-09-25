import Svg, { Circle, Path, Rect } from "react-native-svg";
import { PITCH_PAPER as PP } from "~/theme/web/explore/pitch";

/** web pitch/marks.tsx: the folio's monochrome marks, in the folio's ink unless a colour is passed. */
export const LogoX = ({ s = 12, fill = PP.ink }: { s?: number; fill?: string }) => (
  <Svg width={s} height={s} viewBox="0 0 1200 1227">
    <Path
      fill={fill}
      d="M714.163 519.284 1160.89 0h-105.86L667.137 450.887 357.328 0H0l468.492 681.821L0 1226.37h105.866l409.625-476.152 327.181 476.152H1200L714.137 519.284h.026ZM569.165 687.828l-47.468-67.894-377.686-540.24h162.604l304.797 435.991 47.468 67.894 396.2 566.721H892.476L569.165 687.854v-.026Z"
    />
  </Svg>
);

export const LogoCard = ({ s = 22 }: { s?: number }) => (
  <Svg width={s} height={s * 0.7} viewBox="0 0 32 22" fill="none">
    <Rect x="1.2" y="1.2" width="29.6" height="19.6" rx="3.2" strokeWidth="2.2" stroke={PP.ink} />
    <Rect x="1.2" y="5.6" width="29.6" height="3.6" fill={PP.ink} />
    <Rect x="5" y="14" width="9" height="2.6" rx="1.3" fill={PP.ink} />
  </Svg>
);

/** web's own-drawn chain stand-in: three slanted bars in a ring. */
export const SolanaMark = ({ s = 19 }: { s?: number }) => (
  <Svg width={s} height={s} viewBox="0 0 40 40">
    <Circle cx="20" cy="20" r="17" strokeWidth="2.6" stroke={PP.ink} fill="none" />
    <Path d="M13 14.6h13.2l-3 3.2H10zM13 18.4h13.2l-3 3.2H10zM13 22.2h13.2l-3 3.2H10z" fill={PP.ink} />
  </Svg>
);
