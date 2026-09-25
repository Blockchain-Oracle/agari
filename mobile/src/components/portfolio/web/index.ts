import { useTheme } from "~/theme";
import { portfolioTokens, type PortfolioTokens } from "~/theme/web/portfolio";

export { WebButton, type WebButtonSize, type WebButtonVariant } from "./Button";
export { Chevron } from "./Chevron";
export { Pager } from "./Pager";
export { PillButton } from "./PillButton";
export { SectionHeader } from "./SectionHeader";
export { EmptyState, ErrorState, LoadingState, ReadingBoundary, Skeleton, type LoadingShape, type NextAction } from "./states";

/** This family's web tokens for the active theme. */
export function usePortfolioTokens(): PortfolioTokens {
  return portfolioTokens(useTheme().name);
}
