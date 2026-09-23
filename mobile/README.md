# Agari mobile

Agari's Expo app shares market, pricing, signing, and game rules with the web app. Product navigation stays in native React Native screens. The More tab opens a browser for external documentation; explorer records, source articles, wallet installation, and composing an X post are also external links. See [TAKEOVER_STATUS.md](./TAKEOVER_STATUS.md) for the route inventory, verification evidence, and remaining gaps. A route file or successful export alone is not release acceptance.

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

- On iOS, Phantom and Solflare open through wallet links. On Android, those links and the system Mobile Wallet Adapter chooser are available. Agari checks whether an MWA wallet supports sign-only transactions before calling it connected, because the shared sponsored submitter needs that capability. The practice wallet is a device-local devnet key.
- The app never signs a call from the market card. The native ticket shows the current cost, return, and maximum loss before the wallet presents a signing request.
- The faucet and claims use the existing shared web logic. They require devnet SOL for transaction fees where applicable. Test tUSDC has no real-money value.

## Checks

```sh
pnpm --filter @agari/mobile typecheck
pnpm invariants
pnpm exec vitest run packages/core/src/games/practice.test.ts packages/core/src/games/arcade/arcade.test.ts
pnpm --filter @agari/mobile exec expo export --platform ios
pnpm --filter @agari/mobile exec expo export --platform android
```

The iOS simulator can verify the UI and device-local practice wallet. Wallet handoffs and signatures need installed wallet apps on a physical phone; Android Mobile Wallet Adapter needs an Android device or emulator with a compatible wallet. Wired and Bluetooth headphone routing also needs physical-device verification.
