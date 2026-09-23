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
} as const;

export type CaptureName = keyof typeof captures;
