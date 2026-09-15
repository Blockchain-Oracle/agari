//! The Monday Gap on LiteSVM (S6 lane 6a, session-lanes.md §1.6): the real 09-11 → 09-14 weekend replayed on archived
//! prints, and the PD-6 race at `lock_at` in both orders.
//!
//! - **Pyth:** the `PriceUpdateV2` accounts the default receiver stored when the archived trial updates were posted on a
//!   Surfpool devnet fork (D-021 method, `scripts/fixtures/pyth-accounts.ts`): Fri 09-11 16:00:00 ET and Mon 09-14 09:30:00 ET.
//! - **RedStone check close (TSLA v1):** the five production-signed packages at Mon 09:30:00 ET (`redstone-tsla-1789392600.hex`).
//!   Friday's RedStone packages were never archived (the archiver started 09-13), so TSLA settles single-source.

use agari_events::instructions::{OpenWindowArgs, PlaceOrderArgs, PolicyVersionArgs};
use agari_events_tests::fixtures::{gap_series_args, gap_version, qqq_v1, tsla_v1, QQQ, TSLA};
use agari_events_tests::harness::key;
use agari_events_tests::prints::World;
use agari_events_tests::settlement::{BOND, BUY_NO, BUY_YES, IOC, NORMAL};
use agari_events_tests::trade::{order_args, Window};
use anchor_lang::prelude::Pubkey;
use anchor_lang::solana_program::instruction::Instruction;
use anchor_lang::AccountDeserialize;
use base64::Engine;
use pyth_solana_receiver_sdk::price_update::PriceUpdateV2;
use solana_keypair::Keypair;
use solana_signer::Signer;

const MARKET_NOT_TRADING: u32 = 6100;
const MARKET_ALREADY_TERMINAL: u32 = 6103;
const PRINT_TOO_LATE: u32 = 6206;
const CROSS_CHECK_PENDING: u32 = 6219;
const SETTLEMENT_WINDOW_OPEN: u32 = 6223;

/// Fri 2026-09-11 20:00:00Z = 16:00:00 ET: the Gap's opening boundary (a session close).
const T_FRI: i64 = 1_789_156_800;
/// Sun 2026-09-13 20:00 ET = Mon 00:00:00Z: `lock_at`, and the opening print's deadline.
const LOCK: i64 = 1_789_344_000;
/// Mon 2026-09-14 13:30:00Z = 09:30:00 ET: the closing boundary (a session open).
const T_MON: i64 = 1_789_392_600;
const VOO: u16 = 9;

/// D-002: the RedStone Solana adapter's production signers, in `price-sources.json` order.
const PRODUCTION_SIGNERS: [&str; 5] = [
    "deb22f54738d54976c4c0fe5ce6d408e40d88499",
    "dd682daec5a90dd295d14da4b0bec9281017b5be",
    "51ce04be4b3e32572c4ec9135221d0691ba7d202",
    "9c5ae89c4af6aa32ce58588dbaf90d18a855b6de",
    "8bb8f32df04c8b654987daaed53d6b6091e3b774",
];

/// One archived weekend: the Series, its Pyth feed, both prints at expo −8, and whether TSLA's RedStone check applies.
struct Weekend {
    name: &'static str,
    ticker: u16,
    feed_hex: &'static str,
    friday_e8: i64,
    monday_e8: i64,
    checked: bool,
}

const WEEKENDS: [Weekend; 3] = [
    Weekend { name: "tsla", ticker: TSLA, feed_hex: "16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1", friday_e8: 36_547_600_000, monday_e8: 35_981_147_000, checked: true },
    Weekend { name: "qqq", ticker: QQQ, feed_hex: "9695e2b96ea7b3859da9ed25b7a46a920a776e2fdae19a7bcfdf2b219230452d", friday_e8: 71_490_000_000, monday_e8: 70_332_500_000, checked: false },
    Weekend { name: "voo", ticker: VOO, feed_hex: "236b30dd09a9c00dfeec156c7b1efd646c0f01825a1758e3e4a0679e3bdff179", friday_e8: 70_249_748_000, monday_e8: 69_768_105_000, checked: false },
];

fn unhex(s: &str) -> Vec<u8> {
    let s = s.trim();
    (0..s.len()).step_by(2).map(|i| u8::from_str_radix(&s[i..i + 2], 16).unwrap()).collect()
}

fn vector(file: &str) -> String {
    std::fs::read_to_string(format!("{}/vectors/prints/{file}", env!("CARGO_MANIFEST_DIR"))).unwrap()
}

fn pyth_account(name: &str, t: i64) -> PriceUpdateV2 {
    let bytes = base64::engine::general_purpose::STANDARD.decode(vector(&format!("pyth-{name}-{t}.account.b64")).trim()).unwrap();
    PriceUpdateV2::try_deserialize(&mut bytes.as_slice()).unwrap()
}

fn compute_limit() -> Instruction {
    let mut data = vec![2u8];
    data.extend_from_slice(&400_000u32.to_le_bytes());
    Instruction { program_id: anchor_lang::pubkey!("ComputeBudget111111111111111111111111111111"), accounts: vec![], data }
}

/// The ticker's launch version as `init-gap-series` registers it: the open print admissible until `lock_at`.
fn gap_policy(wk: &Weekend) -> PolicyVersionArgs {
    let mut v = gap_version(if wk.checked { tsla_v1() } else { qqq_v1() });
    v.primary.feed_id = unhex(wk.feed_hex).try_into().unwrap();
    v
}

/// The Gap Window `[Fri 16:00, lock Sun 20:00, Mon 09:30 ET]` listed on a fresh Gap Series (production RedStone signers).
fn listed(wk: &Weekend) -> (World, Pubkey) {
    let mut w = World::new(gap_series_args(wk.ticker), gap_policy(wk), 1);
    let mut authorities = agari_events_tests::prints::print_authorities(&w.keys);
    for (slot, hex) in authorities.redstone_signers.iter_mut().zip(PRODUCTION_SIGNERS) {
        *slot = unhex(hex).try_into().unwrap();
    }
    let admin = key(1);
    let set = w.h.set_authorities_ix(&admin.pubkey(), authorities);
    w.h.ok(&[set], &[&admin]);
    let m = w.open(OpenWindowArgs { index: 0, trading_start: T_FRI, lock_at: LOCK, expiry: T_MON, policy_version: 0, open_kind: 2, close_kind: 1 });
    (w, m)
}

/// Posts the archived Pyth account for boundary `t` and records it into `which` at `now`.
fn pyth_print(w: &mut World, m: Pubkey, wk: &Weekend, t: i64, which: u8, now: i64) -> Result<agari_events_tests::Sent, u32> {
    let update = w.put_price_update(pyth_solana_receiver_sdk::ID, &pyth_account(wk.name, t));
    w.h.warp_to(now);
    let ix = w.pyth_ix(m, update, which);
    w.send(&[ix])
}

fn gap_order(win: &Window, kind: u8, price: u16, lots: u64, order_type: u8) -> PlaceOrderArgs {
    PlaceOrderArgs { expire_ts: LOCK, ..order_args(win, kind, price, lots, order_type) }
}

fn redeem(w: &mut World, win: &Window, user: &Keypair, token: &Pubkey) -> u64 {
    let (_, seats) = w.h.ledger_state(&win.ledger);
    let seat = seats.iter().position(|s| s.owner == user.pubkey()).expect("seat") as u16;
    let before = w.h.token_amount(token);
    let ix = w.h.redeem_ix(win, &user.pubkey(), token, seat, None, None);
    w.h.send(&[ix], &[user]).expect("redeem");
    w.h.token_amount(token) - before
}

#[test]
fn the_real_09_11_to_09_14_weekend_settles_down_on_archived_prints() {
    for wk in &WEEKENDS {
        let (mut w, m) = listed(wk);
        let market = w.h.market_state(&m);
        assert_eq!((market.basis, market.open_deadline, market.close_deadline, market.open_kind, market.close_kind), (1, LOCK, T_MON + 900, 2, 1), "{}", wk.name);
        let win = Window { series: w.series, book: w.books[0], market: m, ledger: market.ledger, mvault: market.mvault, start: T_FRI };

        // Saturday noon ET, 20 h after the boundary: a Regular Window's print would be 19 h late; the Gap's is admissible.
        let saturday = T_FRI + 72_000;
        pyth_print(&mut w, m, wk, T_FRI, 0, saturday).expect("Friday's print lands on Saturday");
        assert_eq!((w.h.market_state(&m).open.price, w.h.market_state(&m).open.source_ts), (wk.friday_e8, T_FRI), "{}", wk.name);

        // Weekend trading: A takes Up at 620, D takes Down against it (a minted pair), both expiring at the lock.
        let (a, d) = (w.h.funded_user(10_000_000), w.h.funded_user(10_000_000));
        w.h.place(&win, &a.0, &a.1, gap_order(&win, BUY_YES, 620, 4_000, NORMAL)).expect("A rests Up");
        w.h.place(&win, &d.0, &d.1, gap_order(&win, BUY_NO, 600, 4_000, IOC)).expect("D fills Down");
        let vault = w.h.token_amount(&win.mvault);
        assert_eq!(vault, 4_000_000 + 2 * BOND, "{}: a minted pair backs 1,000 per lot", wk.name);

        // Sunday 20:00 ET: C still rests a bid one second before `lock_at`; at `lock_at` entries stop.
        let c = w.h.funded_user(1_000_000);
        w.h.warp_to(LOCK - 1);
        w.h.place(&win, &c.0, &c.1, gap_order(&win, BUY_YES, 500, 1_000, NORMAL)).expect("C rests at lock_at - 1");
        w.h.warp_to(LOCK);
        assert_eq!(w.h.place(&win, &d.0, &d.1, gap_order(&win, BUY_YES, 500, 1_000, NORMAL)).unwrap_err(), MARKET_NOT_TRADING, "{}", wk.name);

        // Monday 09:30:00 ET: the close print, then TSLA's RedStone check inside its 60 s strict window.
        pyth_print(&mut w, m, wk, T_MON, 1, T_MON + 3).expect("Monday's print");
        if wk.checked {
            w.h.warp_to(T_MON + 10);
            let ix = w.redstone_ix(m, 3, unhex(&vector("redstone-tsla-1789392600.hex")));
            let sent = w.send(&[compute_limit(), ix]).expect("RedStone check close from 5 production signers");
            println!("tsla check close: {} CU / {} B", sent.compute_units, sent.tx_bytes);
            w.h.warp_to(T_MON + 120);
            assert_eq!(w.settle(m).unwrap_err(), CROSS_CHECK_PENDING, "the missing Friday check holds settlement to the check bound");
            w.h.warp_to(T_MON + 121);
        }
        w.settle(m).expect("settle");

        let result = w.result_state(&m);
        assert_eq!((result.winner, result.payout_yes, result.payout_no, result.void_reason), (1, 0, 10_000_000, 0), "{}: close < open → Down", wk.name);
        assert_eq!((result.open.price, result.close.price, result.open.source, result.close.source), (wk.friday_e8, wk.monday_e8, 1, 1), "{}", wk.name);
        if wk.checked {
            assert_eq!((result.single_source, result.check_open.source, result.check_close.price, result.check_close.signers), (1, 0, 35_962_395_785, 5));
        } else {
            assert_eq!((result.single_source, result.check_close.source), (0, 0));
        }

        let sweep = w.h.sweep_ix(&win, 32);
        w.send(&[sweep]).expect("sweep");
        let (paid_a, paid_d, paid_c) = (redeem(&mut w, &win, &a.0, &a.1), redeem(&mut w, &win, &d.0, &d.1), redeem(&mut w, &win, &c.0, &c.1));
        assert_eq!((paid_a, paid_d, paid_c, w.h.token_amount(&win.mvault)), (BOND, 4_000_000 + BOND, 500_000 + BOND, 0), "{}: Down pays 1,000 per lot; C's swept bid is refunded", wk.name);
        assert_eq!(paid_a + paid_d, vault);
        println!("{} Gap: {} → {} e-8, Down, single_source {}", wk.name, wk.friday_e8, wk.monday_e8, result.single_source);
    }
}

#[test]
fn pd6_race_at_lock_at_on_the_real_friday_print_in_both_orders() {
    for wk in &WEEKENDS {
        // At `lock_at`: a void is refused before and after the print lands.
        let (mut at, m) = listed(wk);
        at.h.warp_to(LOCK);
        assert_eq!(at.void(m).unwrap_err(), SETTLEMENT_WINDOW_OPEN, "{}: the open print is still admissible at lock_at", wk.name);
        pyth_print(&mut at, m, wk, T_FRI, 0, LOCK).expect("the Friday print lands at lock_at");
        assert_eq!(at.void(m).unwrap_err(), SETTLEMENT_WINDOW_OPEN, "{}: nothing is missing", wk.name);

        // At `lock_at + 1`: the print is refused, the void lands, and a print after the void finds a terminal Window.
        let (mut after, m) = listed(wk);
        assert_eq!(pyth_print(&mut after, m, wk, T_FRI, 0, LOCK + 1).unwrap_err(), PRINT_TOO_LATE, "{}", wk.name);
        after.void(m).expect("void at lock_at + 1");
        let result = after.result_state(&m);
        assert_eq!((result.winner, result.void_reason, result.payout_yes, result.payout_no, result.resolved_ts), (2, 1, 5_000_000, 5_000_000, LOCK + 1), "{}: MissingPrint 0.5/0.5 before Monday", wk.name);
        assert_eq!(pyth_print(&mut after, m, wk, T_FRI, 0, LOCK + 1).unwrap_err(), MARKET_ALREADY_TERMINAL, "{}", wk.name);
    }
}
