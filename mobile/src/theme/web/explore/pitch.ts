/**
 * web's /pitch folio (styles/pitch.css, pitch-slides.css): paper in both themes, so one set of values whatever the
 * app's theme. The mocks are dark drawings on the paper, as web's are.
 */
export const PITCH_PAPER = {
  paper: "#F1EADC",
  paper2: "#F4EEE3",
  card: "#FBF7EF",
  ink: "#141210",
  verm: "#E04D26",
  green: "#2E6B4F",
  body: "rgba(20, 18, 16, 0.82)",
  mute: "rgba(20, 18, 16, 0.62)",
  faint: "rgba(20, 18, 16, 0.48)",
  hair: "rgba(20, 18, 16, 0.14)",
  soft: "rgba(20, 18, 16, 0.03)",
  dot: "rgba(20, 18, 16, 0.2)",
  tagBorder: "rgba(224, 77, 38, 0.4)",
} as const;

/** The dark mocks: the phone, the X card and the frozen custodial phone (pitch-slides.css). */
export const PITCH_MOCK = {
  chartGreen: "#2E6B4F",
  chartLine: "#4FB985",
  lock: "#EE8888",
  phoneFrame: "#0D0B09",
  phoneScreen: "#16120E",
  phoneBorder: "rgba(255, 255, 255, 0.06)",
  phoneShadow: "rgba(40, 28, 18, 0.62)",
  cream: "#F1EADC",
  white55: "rgba(255, 255, 255, 0.55)",
  white50: "rgba(255, 255, 255, 0.5)",
  white45: "rgba(255, 255, 255, 0.45)",
  white04: "rgba(255, 255, 255, 0.04)",
  upFill: "rgba(46, 107, 79, 0.16)",
  upBorder: "rgba(79, 185, 133, 0.45)",
  downFill: "rgba(224, 77, 38, 0.12)",
  downBorder: "rgba(224, 77, 38, 0.4)",
  white: "#FFFFFF",
  xBg: "#000000",
  xInk: "#E7E9EA",
  xMute: "#71767B",
  xBorder: "rgba(255, 255, 255, 0.08)",
  xBlue: "#1D9BF0",
  replyFrom: "#3A3A44",
  replyTo: "#22232A",
  receiptFill: "rgba(46, 107, 79, 0.15)",
  receiptBorder: "rgba(79, 185, 133, 0.4)",
  frozenFrame: "#191A1D",
  frozenScreen: "#232428",
  frozenShadow: "rgba(20, 18, 16, 0.5)",
  white40: "rgba(255, 255, 255, 0.4)",
  white82: "rgba(255, 255, 255, 0.82)",
  white05: "rgba(255, 255, 255, 0.05)",
  white28: "rgba(255, 255, 255, 0.28)",
} as const;

/** The mocks' drop shadows (pitch-slides.css box-shadow), as RN boxShadow strings. */
export const PITCH_SHADOW = {
  phone: "0px 55px 120px -40px rgba(40, 28, 18, 0.62)",
  xcard: "0px 46px 105px -40px rgba(40, 28, 18, 0.55)",
  frozen: "0px 46px 105px -44px rgba(20, 18, 16, 0.5)",
} as const;
