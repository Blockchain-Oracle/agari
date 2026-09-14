//! Closure on LiteSVM (S2.13): release the Book, close the Ledger and mvault (donation-safe), close the Market and
//! its result after retention (PD-7), dependents, a recycled Book's stale handles, and Ledger growth (PD-8).

use agari_common::seeds::result_address;
use agari_events_tests::fixtures::regular_window;
use agari_events_tests::harness::key;
use agari_events_tests::settlement::*;
use agari_events_tests::trade::order_args;
use solana_signer::Signer;

const NOT_PROGRAM_AUTHORITY: u32 = 6021;
const LEDGER_MARKET_MISMATCH: u32 = 6010;
const MARKET_NOT_TRADING: u32 = 6100;
const MARKET_NOT_LOCKED: u32 = 6101;
const MARKET_NOT_TERMINAL: u32 = 6102;
const RETENTION_NOT_ELAPSED: u32 = 6220;
const OPEN_ORDERS_REMAIN: u32 = 6224;
const LEDGER_NOT_EMPTY: u32 = 6226;
const DEPENDENTS_REMAIN: u32 = 6229;
const BOOK_NOT_RELEASED: u32 = 6230;
const LEDGER_NOT_CLOSED: u32 = 6231;
const MATH_OVERFLOW: u32 = 6304;
const WRONG_TOKEN_OWNER: u32 = 6305;
const BAD_GROW_AMOUNT: u32 = 6307;
const RETENTION: i64 = 21_600;

/// Every seat redeemed by its own owner (A and D to their token accounts, the product to its own).
fn redeem_everyone(t: &mut Traded) {
    let p = product();
    let users = [(t.a.0.insecure_clone(), t.a.1), (t.d.0.insecure_clone(), t.d.1), (p, t.product_token)];
    for (user, token) in users {
        let (_, seats) = t.w.h.ledger_state(&t.win.ledger);
        let seat = seats.iter().position(|s| s.owner == user.pubkey()).expect("seat") as u16;
        let ix = t.w.h.redeem_ix(&t.win, &user.pubkey(), &token, seat, None, None);
        t.w.h.ok(&[ix], &[&user]);
    }
}

#[test]
fn the_ledger_closes_only_when_every_seat_is_redeemed_and_a_donation_goes_to_the_treasury() {
    let mut t = Traded::new();
    let (admin, treasury) = (key(1).pubkey(), t.w.h.treasury);
    let close = t.w.h.close_ledger_ix(&t.win, &treasury, &admin);
    assert_eq!(t.crank_send(&[close.clone()]).unwrap_err(), MARKET_NOT_TERMINAL);

    t.resolve(Outcome::Up);
    t.sweep();
    t.w.h.donate(&t.win.mvault, 123_456);
    assert_eq!(t.crank_send(&[close.clone()]).unwrap_err(), LEDGER_NOT_EMPTY, "no seat redeemed yet");
    let wrong_payer = t.w.h.close_ledger_ix(&t.win, &treasury, &t.crank.pubkey());
    assert_eq!(t.crank_send(&[wrong_payer]).unwrap_err(), LEDGER_MARKET_MISMATCH);
    let wrong_treasury = t.w.h.close_ledger_ix(&t.win, &t.a.1, &admin);
    assert_eq!(t.crank_send(&[wrong_treasury]).unwrap_err(), WRONG_TOKEN_OWNER);

    // The donation changes nobody's payout: accounting never reads the mvault balance.
    let (a_before, d_before) = (t.w.h.token_amount(&t.a.1), t.w.h.token_amount(&t.d.1));
    redeem_everyone(&mut t);
    assert_eq!((t.w.h.token_amount(&t.a.1) - a_before, t.w.h.token_amount(&t.d.1) - d_before), (7_970_000, BOND));
    assert_eq!(t.w.h.token_amount(&t.win.mvault), 123_456, "only the donation is left");

    let (treasury_before, admin_before) = (t.w.h.token_amount(&treasury), t.w.h.lamports(&admin));
    let rent_back = t.w.h.lamports(&t.win.ledger) + t.w.h.lamports(&t.win.mvault);
    let sent = t.crank_send(&[close]).expect("close ledger");
    assert_eq!(t.w.h.token_amount(&treasury) - treasury_before, 123_456, "the residue went to the treasury");
    assert_eq!(t.w.h.lamports(&admin) - admin_before, rent_back, "the Ledger and mvault rent went back to the roller's payer");
    assert_eq!((t.w.h.lamports(&t.win.ledger), t.w.h.lamports(&t.win.mvault)), (0, 0));
    assert_eq!(t.w.h.market_state(&t.win.market).flags & 0b10, 0b10, "LEDGER_CLOSED");
    println!("public_close_ledger: {} CU / {} B; rent back {rent_back} lamports", sent.compute_units, sent.tx_bytes);
}

#[test]
fn the_market_and_result_close_after_release_ledger_close_dependents_and_retention() {
    let mut t = Traded::new();
    let (m, admin, settler, p) = (t.win.market, key(1).pubkey(), key(3).pubkey(), product());
    let result = result_address(&agari_events::ID, &m).0;

    // A product registers while trading; a key that isn't a program authority can't.
    let add = t.w.h.dependent_ix(&p.pubkey(), &m, true);
    t.w.h.ok(&[add], &[&p]);
    let stranger_add = t.w.h.dependent_ix(&t.crank.pubkey(), &m, true);
    assert_eq!(t.crank_send(&[stranger_add]).unwrap_err(), NOT_PROGRAM_AUTHORITY);
    let release_early = t.w.h.release_book_ix(&t.win);
    assert_eq!(t.crank_send(&[release_early.clone()]).unwrap_err(), MARKET_NOT_LOCKED, "still trading");

    t.resolve(Outcome::Up);
    assert_eq!(t.crank_send(&[release_early.clone()]).unwrap_err(), OPEN_ORDERS_REMAIN, "A's bid still rests");
    let close_market = t.w.h.close_market_ix(&m, &admin, &settler);
    assert_eq!(t.crank_send(&[close_market.clone()]).unwrap_err(), BOOK_NOT_RELEASED);
    t.sweep();
    let released = t.crank_send(&[release_early]).expect("release book");
    let series = t.w.h.series_state(&t.win.series);
    assert_eq!((series.free_book_count, series.free_books[1], t.w.h.book_state(&t.win.book).market), (2, t.win.book, Default::default()));
    assert_eq!(t.crank_send(&[close_market.clone()]).unwrap_err(), LEDGER_NOT_CLOSED);

    redeem_everyone(&mut t);
    let close_ledger = t.w.h.close_ledger_ix(&t.win, &t.w.h.treasury.clone(), &admin);
    t.crank_send(&[close_ledger]).expect("close ledger");
    assert_eq!(t.crank_send(&[close_market.clone()]).unwrap_err(), DEPENDENTS_REMAIN);
    let release = t.w.h.dependent_ix(&p.pubkey(), &m, false);
    t.w.h.ok(&[release.clone()], &[&p]);
    assert_eq!(t.w.h.send(&[release], &[&p]).unwrap_err(), MATH_OVERFLOW, "releasing twice is a product bug");

    let resolved_ts = t.w.result_state(&m).resolved_ts;
    t.w.h.warp_to(resolved_ts + RETENTION - 1);
    assert_eq!(t.crank_send(&[close_market.clone()]).unwrap_err(), RETENTION_NOT_ELAPSED);
    t.w.h.warp_to(resolved_ts + RETENTION);
    let swapped = t.w.h.close_market_ix(&m, &settler, &admin);
    assert_eq!(t.crank_send(&[swapped]).unwrap_err(), LEDGER_MARKET_MISMATCH, "rent goes to each account's own payer");

    let (market_rent, result_rent) = (t.w.h.lamports(&m), t.w.h.lamports(&result));
    let (admin_before, settler_before) = (t.w.h.lamports(&admin), t.w.h.lamports(&settler));
    let sent = t.crank_send(&[close_market]).expect("close market");
    assert_eq!((t.w.h.lamports(&admin) - admin_before, t.w.h.lamports(&settler) - settler_before), (market_rent, result_rent));
    // PD-7: a product claiming after cleanup finds no MarketResult (and no Market): it must use its own copy.
    assert!(t.w.h.account_data(&result).is_empty() && t.w.h.account_data(&m).is_empty());
    println!(
        "public_release_book: {} CU / {} B; public_close_market: {} CU / {} B; rent back market {market_rent} + result {result_rent}",
        released.compute_units, released.tx_bytes, sent.compute_units, sent.tx_bytes
    );
}

#[test]
fn a_released_book_binds_the_next_window_with_a_new_generation_and_old_handles_stay_stale() {
    let mut t = Traded::new();
    t.resolve(Outcome::Up);
    t.sweep();
    let release = t.w.h.release_book_ix(&t.win);
    t.crank_send(&[release]).expect("release");
    let generation = t.w.h.book_state(&t.win.book).generation;

    // Window 1 on the same Book (the World's second book is still free, so name this one explicitly).
    let now = t.w.h.now();
    let args = regular_window(1, T + 300, 300, 0);
    assert!(now < args.lock_at);
    t.w.h.open_window(&t.win.series, &t.win.book, args).expect("open window 1 on the recycled book");
    assert_eq!(t.w.h.book_state(&t.win.book).generation, generation + 1);
    let w1 = agari_events_tests::ix::window_accounts(&t.win.series, 1);
    let win1 = agari_events_tests::trade::Window { series: t.win.series, book: t.win.book, market: w1.market, ledger: w1.ledger, mvault: w1.mvault, start: T + 300 };

    // A new order takes node 0 again with a new seq; A's old handle (node 0, old seq) no longer names anything.
    let (u, u_tok) = t.w.h.funded_user(5_000_000);
    let (r, _) = t.w.h.place(&win1, &u, &u_tok, order_args(&win1, BUY_YES, 500, 1_000, NORMAL)).expect("rest on window 1");
    assert_eq!(r.rested.node, t.a_handle.node);
    assert!(r.rested.seq > t.a_handle.seq);
    let stale = t.w.h.cancel_orders_ix(&win1, &u.pubkey(), None, vec![t.a_handle], r.seat);
    t.w.h.ok(&[stale], &[&u]);
    assert_eq!(t.w.h.book_state(&t.win.book).order_count, 1, "the stale handle was skipped, the new order still rests");
}

#[test]
fn a_ledger_grows_116_seats_a_call_to_1024_while_trading_and_the_new_seats_are_usable() {
    let mut t = Traded::new();
    let crank = t.crank.pubkey();
    let too_many = t.w.h.grow_ledger_ix(&t.win, &crank, 117);
    assert_eq!(t.crank_send(&[too_many]).unwrap_err(), BAD_GROW_AMOUNT);
    let zero = t.w.h.grow_ledger_ix(&t.win, &crank, 0);
    assert_eq!(t.crank_send(&[zero]).unwrap_err(), BAD_GROW_AMOUNT);

    let (lamports_before, payer_before) = (t.w.h.lamports(&t.win.ledger), t.w.h.lamports(&crank));
    let grow = t.w.h.grow_ledger_ix(&t.win, &crank, 116);
    let sent = t.crank_send(&[grow.clone()]).expect("grow");
    let rent = t.w.h.lamports(&t.win.ledger) - lamports_before;
    assert_eq!((t.w.h.ledger_state(&t.win.ledger).0.capacity, t.w.h.ledger_seat_bytes(&t.win.ledger)), (212, 212 * 88));
    assert_eq!(payer_before - t.w.h.lamports(&crank), rent + 5_000, "the payer funds the rent (plus its fee)");
    for _ in 0..7 {
        t.crank_send(&[grow.clone()]).expect("grow");
    }
    assert_eq!(t.w.h.ledger_state(&t.win.ledger).0.capacity, 1_024);
    let one_more = t.w.h.grow_ledger_ix(&t.win, &crank, 1);
    assert_eq!(t.crank_send(&[one_more]).unwrap_err(), BAD_GROW_AMOUNT, "1,024 is the cap");

    // A seat past the initial 96 is claimable by hint.
    let (u, u_tok) = t.w.h.funded_user(5_000_000);
    let mut args = order_args(&t.win, BUY_YES, 400, 1_000, NORMAL);
    args.seat_hint = 1_000;
    let (r, _) = t.w.h.place(&t.win, &u, &u_tok, args).expect("rest from seat 1000");
    assert_eq!(r.seat, 1_000);

    t.w.h.warp_to(T + 300);
    let late = t.w.h.grow_ledger_ix(&t.win, &crank, 1);
    assert_eq!(t.crank_send(&[late]).unwrap_err(), MARKET_NOT_TRADING);
    println!("public_grow_ledger +116: {} CU / {} B; rent {rent} lamports", sent.compute_units, sent.tx_bytes);
}
