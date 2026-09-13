import { darkTheme, type Theme } from "@rainbow-me/rainbowkit";

const base = darkTheme({ borderRadius: "medium", fontStack: "system", overlayBlur: "small" });
const NO_SHADOW = "none";

/** RainbowKit's modal reads our tokens by reference; vermilion marks live/selected, warning marks errors (color law). */
export const rainbowKitTheme: Theme = {
  ...base,
  colors: {
    ...base.colors,
    accentColor: "var(--color-accent)",
    accentColorForeground: "var(--color-cream-ink)",
    actionButtonBorder: "var(--color-hairline)",
    actionButtonBorderMobile: "var(--color-hairline)",
    actionButtonSecondaryBackground: "var(--color-surface-2)",
    closeButton: "var(--color-ink-secondary)",
    closeButtonBackground: "var(--color-surface-2)",
    connectButtonBackground: "var(--color-surface-1)",
    connectButtonBackgroundError: "var(--color-surface-2)",
    connectButtonInnerBackground: "var(--color-surface-2)",
    connectButtonText: "var(--color-ink)",
    connectButtonTextError: "var(--color-warning)",
    connectionIndicator: "var(--color-accent)",
    downloadBottomCardBackground: "var(--color-surface-1)",
    downloadTopCardBackground: "var(--color-surface-2)",
    error: "var(--color-warning)",
    generalBorder: "var(--color-hairline)",
    generalBorderDim: "var(--color-hairline)",
    menuItemBackground: "var(--color-surface-2)",
    modalBackdrop: "var(--color-scrim)",
    modalBackground: "var(--color-surface-1)",
    modalBorder: "var(--color-hairline)",
    modalText: "var(--color-ink)",
    modalTextDim: "var(--color-ink-muted)",
    modalTextSecondary: "var(--color-ink-secondary)",
    profileAction: "var(--color-surface-2)",
    profileActionHover: "var(--color-surface-3)",
    profileForeground: "var(--color-surface-1)",
    selectedOptionBorder: "var(--color-accent)",
    standby: "var(--color-warning)",
  },
  fonts: { body: "var(--font-body)" },
  radii: {
    actionButton: "var(--radius-md)",
    connectButton: "var(--radius-md)",
    menuButton: "var(--radius-md)",
    modal: "var(--radius-xl)",
    modalMobile: "var(--radius-xl)",
  },
  shadows: {
    connectButton: NO_SHADOW,
    dialog: NO_SHADOW,
    profileDetailsAction: NO_SHADOW,
    selectedOption: NO_SHADOW,
    selectedWallet: NO_SHADOW,
    walletLogo: NO_SHADOW,
  },
};
