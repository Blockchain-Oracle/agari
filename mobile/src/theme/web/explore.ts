import type { ThemeName } from "../index";

/**
 * The Explore and Learn family's shared web values, as the browser computes them at 402 px (useagari.xyz, per theme):
 * the gray ramp steps web paints with that the app palette has no role for. Each route's own values live beside this
 * file in `explore/<route>.ts`.
 */
const DARK = {
  /** --gray-300: the light row ink of mono tables (stats rows, the proof feed). */
  gray300: "#D4D4D4",
  /** --gray-200 */
  gray200: "#E5E5E5",
  /** web's page ground behind the container. */
  ground: "#050505",
};

const LIGHT: typeof DARK = {
  gray300: "#453E33",
  gray200: "#2E2821",
  ground: "#F4EEE3",
};

export type ExploreTokens = typeof DARK;
export const exploreTokens = (name: ThemeName): ExploreTokens => (name === "dark" ? DARK : LIGHT);
