type Annotation = { label: string; x: number; y: number; toX: number; toY: number };
function connected(title: string, file: string, alt: string, state: string, annotations: Annotation[]) {
  return { title, file: `${file}-2026-09-23.jpg`, alt, state, annotations };
}

export const captures = {
  markets: {
    title: 'The Markets ticket after hours',
    file: 'markets-desktop-2026-09-23.jpg',
    alt: 'Agari Markets desktop page with TSLA last price, a countdown to the next Window and the signed-out Up/Down ticket.',
    state: 'Signed out; NYSE closed; listed pre-open TSLA Window; no stake entered.',
  },
  phone: {
    title: 'Markets on a phone',
    file: 'markets-phone-2026-09-23.jpg',
    alt: 'Agari Markets at a 390-pixel viewport, with the TSLA chart and bottom navigation visible.',
    state: 'Signed out; 390-pixel viewport; NYSE closed.',
  },
  portfolio: {
    title: 'The signed-out Portfolio',
    file: 'portfolio-desktop-2026-09-23.jpg',
    alt: 'Agari Portfolio with a Connect Wallet gate and a separate X-Predict wallet panel.',
    state: 'Signed out; no personal balances or claims are shown.',
  },
  baskets: {
    title: 'Five baskets on the public app',
    file: 'baskets-desktop-2026-09-23.jpg',
    alt: 'Agari Baskets page with AI Labs and Frontier AI cards. Each shows index points and Predict, Cover and Hold actions.',
    state: 'Signed out; basket cards with public prices and a listed Window.',
  },
  studio: {
    title: 'Choose the AI Labs basket',
    file: 'desk-studio-2026-09-23.jpg',
    alt: 'Desk studio step one: the AI Labs preset, member weights and cash sleeve, with a side card summarizing the draft.',
    state: 'Signed out; AI Labs preset; no wallet signature.',
  },
  limits: {
    title: 'Set the desk limits',
    file: 'desk-limits-2026-09-23.jpg',
    alt: 'Desk studio step two: default drift, position, per-action, daily, premium and loss limits.',
    state: 'Signed out; default limits; no wallet signature.',
  },
  testRead: {
    title: 'The practice test-read gate',
    file: 'desk-test-read-2026-09-23.jpg',
    alt: 'Desk studio step three shows a paper practice balance and asks for a wallet connection before a test read.',
    state: 'Signed out; test read not run; paper balance only.',
  },
  walletFunds: connected('Connected wallet: test funds', 'wallet-funds-connected', 'Agari test-funds dialog showing SOL for network fees, tUSDC for trading, claim timing and prior confirmed claims.', 'Connected wallet; devnet; claim already used in the preceding 24 hours; dialog opened only; account label masked.', [
    { label: 'Check the SOL and tUSDC balances before requesting more test funds.', x: 82, y: 29, toX: 51, toY: 40 },
    { label: 'The dialog names the next eligible claim times and links earlier confirmed claims.', x: 84, y: 62, toX: 48, toY: 66 },
  ]),
  portfolioConnected: connected('A connected Portfolio', 'portfolio-connected', 'Agari Portfolio showing ready-to-bet tUSDC, the wallet and Trading Balance split, a separate Private balance and settled-position count.', 'Connected wallet; devnet tUSDC; no open position; seven settled; account label masked.', [
    { label: 'Ready to bet combines the wallet and Trading Balance amounts.', x: 84, y: 31, toX: 48, toY: 36 },
    { label: 'Private funds sit elsewhere and cannot be spent by the ordinary ticket.', x: 83, y: 65, toX: 57, toY: 69 },
  ]),
  portfolioBalance: connected('Trading Balance and grants', 'portfolio-balance-connected', 'Open Trading Balance panel with wallet balance, deposit and withdraw controls, available funds and the amount reserved by a strategy grant.', 'Connected wallet; devnet; panel opened; no deposit, withdrawal or grant change; account label masked.', [
    { label: 'Deposit and Withdraw act on the Trading Balance, not the Private balance.', x: 83, y: 38, toX: 51, toY: 54 },
    { label: 'Available, in trades and in grants have separate meanings.', x: 83, y: 65, toX: 52, toY: 66 },
  ]),
  portfolioHistory: connected('Settled positions and receipts', 'portfolio-history-connected', 'Portfolio History tab with settled devnet positions, results, an automatically paid win and receipt controls.', 'Connected wallet; devnet; History tab opened; no claim action; account label masked.', [
    { label: 'History lists each settled outcome and its result.', x: 87, y: 54, toX: 51, toY: 67 },
    { label: 'Receipt opens the outcome details; the arrow links the entry transaction.', x: 89, y: 81, toX: 73, toY: 74 },
  ]),
  basketsConnected: connected('Predict, Cover or Hold a basket', 'baskets-connected', 'AI Labs and Frontier AI basket cards with index points, live 24/7 Windows and Predict, Cover and Hold actions.', 'Connected wallet; no stock tokens held; Cover unavailable; live devnet basket prices; account label masked.', [
    { label: 'The basket index is measured in points and reads PreStocks names together.', x: 81, y: 38, toX: 30, toY: 52 },
    { label: 'Predict uses devnet test collateral; Hold starts a separate desk draft.', x: 81, y: 66, toX: 30, toY: 70 },
  ]),
  basketQuote: connected('Preview a live basket call', 'basket-quote-connected', 'Connected AI Labs 24/7 Window with Down selected, 5 tUSDC entered and live cost, return and maximum loss before buying.', 'Connected wallet; live 24/7 basket Window; Down and 5 tUSDC preview only; no order submitted; account label masked.', [
    { label: 'Read the opening line in points and the time remaining.', x: 53, y: 28, toX: 34, toY: 41 },
    { label: 'Compare quoted cost, return and maximum loss before using Buy.', x: 88, y: 45, toX: 79, toY: 72 },
  ]),
  deskOverview: connected('Practice desk cockpit', 'desk-overview-connected', 'Connected Frontier AI practice desk with value chart, next check and six completed practice checks.', 'Connected owner wallet; paper practice desk; real price and quote checks, no mainnet desk transaction; account label masked.', [
    { label: 'The value chart records each practice check, with 1D, 1W and All views.', x: 76, y: 35, toX: 37, toY: 61 },
    { label: 'Go live is gated and remains unavailable on this screen.', x: 83, y: 74, toX: 83, toY: 84 },
  ]),
  deskActivity: connected('Every desk check has a reason', 'desk-activity-connected', 'Practice desk Activity timeline showing decisions not to act and links to individual decision pages.', 'Connected owner wallet; paper practice; Activity tab opened; no check triggered; account label masked.', [
    { label: 'Each card opens the full decision and its price and limit checks.', x: 87, y: 56, toX: 52, toY: 76 },
  ]),
  deskRules: connected('Who enforces each desk rule', 'desk-rules-connected', 'Practice desk Rules tab showing basket weights and separate labels for on-chain limits and desk-code checks.', 'Connected owner wallet; practice mandate; rules read only; mainnet program is not deployed; account label masked.', [
    { label: 'Money caps and the premium ceiling are program rules for a future live desk.', x: 85, y: 47, toX: 79, toY: 84 },
    { label: 'Drift, concentration and loss-stop checks belong to the desk runner.', x: 45, y: 51, toX: 36, toY: 84 },
  ]),
  earnMaker: connected('Maker Vault supply screen', 'earn-maker-connected', 'Connected Earn Maker Vault tab showing share price, value, utilization and supply form without a deposit.', 'Connected wallet; devnet Maker Vault; no supply or withdrawal submitted; account label masked.', [
    { label: 'Share price is a cumulative result since launch, not a promised annual rate.', x: 84, y: 31, toX: 67, toY: 32 },
  ]),
  earnRange: connected('Range and Moonshot reserve', 'earn-range-connected', 'Connected Earn Range reserve tab showing share price, value, utilization and the supply form.', 'Connected wallet; devnet Range reserve; no supply or withdrawal submitted; account label masked.', [
    { label: 'The Range reserve has separate share accounting from the Maker Vault.', x: 84, y: 45, toX: 67, toY: 32 },
  ]),
  strategiesConnected: connected('Browse published strategies', 'strategies-connected', 'Connected Strategies Copy tab showing published strategies with track record and per-trade maximums.', 'Connected wallet; published catalogue opened; no subscription changed; account label masked.', [
    { label: 'Review the strategy and its settled record before opening copy settings.', x: 84, y: 59, toX: 33, toY: 94 },
  ]),
  strategyCopy: connected('Permission and operation are separate', 'strategy-copy-connected', 'Strategy drawer showing Copying enabled while the runner reports Awaiting settlement.', 'Connected wallet; existing copy permission inspected; no permission or budget change; account label masked.', [
    { label: 'Copying enabled describes the current permission.', x: 59, y: 51, toX: 78, toY: 61 },
    { label: 'Awaiting settlement describes why this strategy is not opening another position yet.', x: 59, y: 75, toX: 81, toY: 78 },
  ]),
  shortConnected: connected('Short only a tradable Window', 'short-connected', 'Connected Short picker listing 24/7 PreStocks names first and stock Windows later, with a capped stake input.', 'Connected wallet; devnet Short preview; no position opened; account label masked.', [
    { label: '24/7 names trade while the US stock session is closed.', x: 46, y: 57, toX: 30, toY: 86 },
    { label: 'Size and read the quote before a wallet signature.', x: 87, y: 49, toX: 81, toY: 83 },
  ]),
  proofFeed: connected('Settled Window proof feed', 'proof-feed-connected', 'Agari Proof feed listing settled PreStocks Windows with opening and closing prints in dollars or basket points.', 'Public proof data viewed in a connected session; no transaction; account label masked.', [
    { label: 'Filter by the policy source used for settlement.', x: 80, y: 36, toX: 21, toY: 46 },
    { label: 'Open a row to inspect its prints and recording transactions.', x: 84, y: 74, toX: 93, toY: 68 },
  ]),
  basketProof: connected('A basket print in points', 'basket-proof-connected', 'AI Labs proof page showing PreStocks opening and closing prints in index points and their recording transactions.', 'Public settled devnet Window viewed in a connected session; no transaction; account label masked.', [
    { label: 'The basket print is in points, with separate open and close values.', x: 83, y: 49, toX: 48, toY: 56 },
    { label: 'The source is PreStocks data signed by Agari’s attestor, not an independent Pyth update.', x: 85, y: 80, toX: 63, toY: 91 },
  ]),
  studioCurrent: connected('Choose the current AI Labs preset', 'studio-basket-current', 'Current desk studio first step with AI Labs, five basket presets, build-your-own and a paper allocation preview.', 'Signed out; public drafting step; AI Labs selected; no signature or money movement.', [
    { label: 'Choose a basket or build from the eight supported companies.', x: 66, y: 45, toX: 23, toY: 70 },
    { label: 'The right-hand summary shows the practice starting allocation.', x: 62, y: 82, toX: 83, toY: 74 },
  ]),
  limitsCurrent: connected('Money limits and desk checks', 'studio-limits-current', 'Current desk studio limits with a premium ceiling marked enforced on-chain and drift, concentration and loss stop marked enforced by the desk.', 'Signed out; limits step read only; Balanced defaults; no signature or money movement.', [
    { label: 'Premium and spending caps are intended for program enforcement in a live desk.', x: 44, y: 43, toX: 62, toY: 20 },
    { label: 'Drift, concentration and loss stop are checked by the runner.', x: 42, y: 72, toX: 65, toY: 68 },
  ]),
  testReadCurrent: connected('What one practice test read does', 'studio-test-read-current', 'Current desk studio third step explaining a real PreStocks and Jupiter read with a paper balance and wallet connection gate.', 'Signed out; public step shown; test read not started; no wallet message signed.', [
    { label: 'The one-cycle preview lists prices, quotes, timing and a written decision.', x: 66, y: 57, toX: 31, toY: 84 },
    { label: 'The right-hand balance is paper practice money.', x: 61, y: 82, toX: 83, toY: 75 },
  ]),
  createCurrent: connected('Practice creation waits for an owner', 'studio-create-current', 'Current desk studio final step with Connect gate, paper practice allocation and one-signature label.', 'Signed out; final gate read only; no wallet connection, signature or desk creation.', [
    { label: 'Connect and sign a message to create the paper desk.', x: 63, y: 49, toX: 47, toY: 48 },
    { label: 'The preview still shows a paper balance and selected limits.', x: 60, y: 74, toX: 83, toY: 72 },
  ]),
} as const;

export type CaptureName = keyof typeof captures;
