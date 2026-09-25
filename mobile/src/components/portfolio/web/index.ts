import { useTheme } from "~/theme";
import { portfolioTokens, type PortfolioTokens } from "~/theme/web/portfolio";

export { WebButton, type WebButtonSize, type WebButtonVariant } from "./Button";
export { Pager } from "./Pager";
export { SectionHeader } from "./SectionHeader";
export { EmptyState, ErrorState, LoadingState, ReadingBoundary, Skeleton, type LoadingShape, type NextAction } from "./states";

/** This family's web tokens for the active theme. */
export function usePortfolioTokens(): PortfolioTokens {
  return portfolioTokens(useTheme().name);
}
