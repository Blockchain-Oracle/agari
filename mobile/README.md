# Agari mobile

Agari's Expo app uses the same market, pricing, ticket, wallet-session, and Practice rules as the web app. The phone UI is native React Native: first-run onboarding, Markets, the live Window and ticket, Reels, Practice, Portfolio, and Proof. Other product areas open their current web pages inside the app from More.

## Run locally

From the repository root:

```sh
pnpm install
pnpm --filter @agari/mobile ios
# or, with an Android device or emulator configured:
pnpm --filter @agari/mobile android
```

This is a development build; Expo Go does not include the app's native modules. The default API is `https://useagari.xyz`. To point a local build at another web server, set `EXPO_PUBLIC_SITE_URL` before starting Expo. The app reads the public devnet addresses in `scripts/deploy/addresses.devnet.json` and needs no secret in the client.

## Wallets and test funds

- On iOS, Phantom and Solflare open through wallet links. On Android, those links and the system Mobile Wallet Adapter chooser are available. The practice wallet is a device-local devnet key.
- The app never signs a call from the market card. The native ticket shows the current cost, return, and maximum loss before the wallet presents a signing request.
- The faucet and claims use the existing shared web logic. They require devnet SOL for transaction fees where applicable. Test tUSDC has no real-money value.

## Checks

```sh
pnpm --filter @agari/mobile typecheck
pnpm invariants
pnpm exec vitest run packages/core/src/games/practice.test.ts
```

The iOS simulator can verify the UI and device-local practice wallet. Wallet handoffs and signatures need installed wallet apps on a physical phone; Android Mobile Wallet Adapter needs an Android device or emulator with a compatible wallet.
