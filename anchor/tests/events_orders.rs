//! Orders, cancels, sets and withdrawals on LiteSVM (S2 lane M): real token movements, `PlaceResult` return data,
//! on-chain reverts and compute. Codes are the engine's (events-accounts.md §4). The Series seat bond is 250,000.

use agari_events::events::OrderHandle;
use agari_events_tests::harness::key;
use agari_events_tests::trade::{order_args, Window};
use agari_events_tests::Harness;
use solana_signer::Signer;

const BUY_YES: u8 = 0;
const SELL_YES: u8 = 1;
const BUY_NO: u8 = 2;
const NORMAL: u8 = 0;
const FOK: u8 = 1;
const IOC: u8 = 2;
const POST_ONLY: u8 = 3;
const BOND: u64 = 250_000;

fn window() -> (Harness, Window) {
    let mut h = Harness::new();
    let w = h.trading_window();
    (h, w)
}

#[test]
fn example_3_mint_pair_moves_real_tokens_and_returns_the_place_result() {
    let (mut h, w) = window();
    let (a, a_tok) = h.funded_user(20_000_000);
    let (d, d_tok) = h.funded_user(20_000_000);
    let (ra, _) = h.place(&w, &a, &a_tok, order_args(&w, BUY_YES, 620, 10_000, NORMAL)).unwrap();
    assert_eq!((ra.rested_lots, ra.transferred_in), (10_000, 6_200_000 + BOND));
    let (rd, _) = h.place(&w, &d, &d_tok, order_args(&w, BUY_NO, 600, 4_000, IOC)).unwrap();
    assert_eq!((rd.cash_spent, rd.refunded, rd.transferred_in, rd.path_mask, rd.fills), (1_520_000, 80_000, 1_520_000 + BOND, 1 << 2, 1));
    assert_eq!(h.token_amount(&w.mvault), 7_720_000 + 2 * BOND);
    assert_eq!((h.token_amount(&a_tok), h.token_amount(&d_tok)), (20_000_000 - 6_450_000, 20_000_000 - 1_770_000));
    let (_, seats) = h.ledger_state(&w.ledger);
    let (sa, sd) = (seats[usize::from(ra.seat)], seats[usize::from(rd.seat)]);
    assert_eq!((sa.locked_cash, sa.yes_free, sd.no_free), (3_720_000, 4_000, 4_000));
    assert_eq!(h.market_state(&w.market).backing_lots, 4_000);
}

#[test]
fn an_ioc_that_fills_nothing_reverts_its_evictions_on_chain() {
    let (mut h, w) = window();
    let (m, m_tok) = h.funded_user(5_000_000);
    let (t, t_tok) = h.funded_user(5_000_000);
    let mut quote = order_args(&w, BUY_NO, 500, 1_000, NORMAL);
    quote.expire_ts = w.start + 20;
    h.place(&w, &m, &m_tok, quote).unwrap();
    h.warp_to(w.start + 20);
    assert_eq!(h.place(&w, &t, &t_tok, order_args(&w, BUY_YES, 600, 1_000, IOC)).unwrap_err(), 6110);
    assert_eq!(h.book_state(&w.book).order_count, 1, "the eviction rolled back with the refusal");
    let sweep = h.sweep_ix(&w, 32);
    h.ok(&[sweep], &[&key(3)]);
    assert_eq!(h.book_state(&w.book).order_count, 0);
    assert_eq!(h.ledger_state(&w.ledger).1[1].credit, 500_000, "the sweep refunded the maker's escrow to credit");
}

#[test]
fn refusals_carry_the_engine_codes() {
    let (mut h, w) = window();
    let (a, a_tok) = h.funded_user(10_000_000);
    let (b, b_tok) = h.funded_user(10_000_000);
    let (ra, _) = h.place(&w, &a, &a_tok, order_args(&w, BUY_NO, 500, 1_000, NORMAL)).unwrap();
    let mut own = order_args(&w, BUY_YES, 600, 1_000, IOC);
    own.seat_hint = ra.seat;
    assert_eq!(h.place(&w, &a, &a_tok, own).unwrap_err(), 6119, "SelfMatchCancelTaker");
    assert_eq!(h.place(&w, &b, &b_tok, order_args(&w, BUY_YES, 600, 2_000, FOK)).unwrap_err(), 6111, "FillOrKillNotFillable");
    assert_eq!(h.place(&w, &b, &b_tok, order_args(&w, BUY_YES, 500, 1_000, POST_ONLY)).unwrap_err(), 6109, "PostOnlyWouldCross");
    let mut late = order_args(&w, BUY_YES, 400, 1_000, NORMAL);
    late.expire_ts = w.start + 301;
    assert_eq!(h.place(&w, &b, &b_tok, late).unwrap_err(), 6108, "ExpiryAfterLock");
    assert_eq!(h.place(&w, &b, &b_tok, order_args(&w, BUY_YES, 400, 999, NORMAL)).unwrap_err(), 6106, "BelowMinLots");
    assert_eq!(h.place(&w, &b, &a_tok, order_args(&w, BUY_YES, 400, 1_000, NORMAL)).unwrap_err(), 6305, "WrongTokenOwner");
    h.warp_to(w.start + 300);
    assert_eq!(h.place(&w, &b, &b_tok, order_args(&w, BUY_YES, 400, 1_000, NORMAL)).unwrap_err(), 6100, "MarketNotTrading");
}

#[test]
fn credit_is_paid_only_to_the_owners_token_account() {
    let (mut h, w) = window();
    let (a, a_tok) = h.funded_user(10_000_000);
    let (b, b_tok) = h.funded_user(10_000_000);
    let mint = h.mint_set_ix(&w, &a.pubkey(), &a_tok, 1_000, u16::MAX, false);
    h.ok(&[mint], &[&a]);
    let seat = 1u16;
    let mut sell = order_args(&w, SELL_YES, 400, 1_000, NORMAL);
    sell.seat_hint = seat;
    h.place(&w, &a, &a_tok, sell).unwrap();
    h.place(&w, &b, &b_tok, order_args(&w, BUY_YES, 450, 1_000, IOC)).unwrap();
    let steal = h.withdraw_credit_ix(&w, &a.pubkey(), &b_tok, seat, 400_000);
    assert_eq!(h.send(&[steal], &[&a]).unwrap_err(), 6305, "WrongTokenOwner");
    let greedy = h.withdraw_credit_ix(&w, &a.pubkey(), &a_tok, seat, 400_001);
    assert_eq!(h.send(&[greedy], &[&a]).unwrap_err(), 6300, "InsufficientCredit");
    let before = h.token_amount(&a_tok);
    let take = h.withdraw_credit_ix(&w, &a.pubkey(), &a_tok, seat, 400_000);
    h.ok(&[take], &[&a]);
    assert_eq!(h.token_amount(&a_tok), before + 400_000);

    let mut bid = order_args(&w, BUY_NO, 300, 1_000, NORMAL);
    bid.seat_hint = seat;
    let (rested, _) = h.place(&w, &a, &a_tok, bid).unwrap();
    let before = h.token_amount(&a_tok);
    let handle = OrderHandle { node: rested.rested.node, seq: rested.rested.seq };
    let cancel = h.cancel_orders_ix(&w, &a.pubkey(), Some(&a_tok), vec![handle], seat);
    h.ok(&[cancel], &[&a]);
    assert_eq!(h.token_amount(&a_tok), before + 700_000, "cancel with withdraw paid the refund out");
}

#[test]
fn reduce_cancel_all_and_sweep_on_chain() {
    let (mut h, w) = window();
    let (a, a_tok) = h.funded_user(10_000_000);
    let (first, _) = h.place(&w, &a, &a_tok, order_args(&w, BUY_YES, 100, 2_000, NORMAL)).unwrap();
    let seat = first.seat;
    for price in [101, 102] {
        let mut o = order_args(&w, BUY_YES, price, 1_000, NORMAL);
        o.seat_hint = seat;
        h.place(&w, &a, &a_tok, o).unwrap();
    }
    let handle = OrderHandle { node: first.rested.node, seq: first.rested.seq };
    let below = h.reduce_ix(&w, &a.pubkey(), handle, seat, 999);
    assert_eq!(h.send(&[below], &[&a]).unwrap_err(), 6106, "BelowMinLots");
    let reduce = h.reduce_ix(&w, &a.pubkey(), handle, seat, 1_000);
    h.ok(&[reduce], &[&a]);
    assert_eq!(h.ledger_state(&w.ledger).1[usize::from(seat)].credit, 100_000);
    let stale = OrderHandle { node: 200, seq: 99 };
    let cancel = h.cancel_orders_ix(&w, &a.pubkey(), None, vec![stale, handle], seat);
    h.ok(&[cancel], &[&a]);
    assert_eq!(h.book_state(&w.book).order_count, 2);
    let all = h.cancel_all_ix(&w, &a.pubkey(), seat, 64);
    h.ok(&[all], &[&a]);
    assert_eq!((h.book_state(&w.book).order_count, h.ledger_state(&w.ledger).1[usize::from(seat)].open_orders), (0, 0));

    let mut o = order_args(&w, BUY_YES, 150, 1_000, NORMAL);
    o.seat_hint = seat;
    h.place(&w, &a, &a_tok, o).unwrap();
    h.warp_to(w.start + 300);
    let sweep = h.sweep_ix(&w, 32);
    h.ok(&[sweep], &[&key(3)]);
    assert_eq!(h.book_state(&w.book).order_count, 0, "after lock_at the sweep drains every order");
}

#[test]
fn complete_sets_mint_and_merge_exactly() {
    let (mut h, w) = window();
    let (a, a_tok) = h.funded_user(10_000_000);
    let zero = h.mint_set_ix(&w, &a.pubkey(), &a_tok, 0, u16::MAX, false);
    assert_eq!(h.send(&[zero], &[&a]).unwrap_err(), 6105, "InvalidQuantity");
    let mint = h.mint_set_ix(&w, &a.pubkey(), &a_tok, 2_000, u16::MAX, false);
    h.ok(&[mint], &[&a]);
    assert_eq!((h.token_amount(&a_tok), h.token_amount(&w.mvault)), (10_000_000 - 2_000_000 - BOND, 2_000_000 + BOND));
    let too_many = h.merge_set_ix(&w, &a.pubkey(), &a_tok, 2_001, 1, false);
    assert_eq!(h.send(&[too_many], &[&a]).unwrap_err(), 6301, "InsufficientOutcome");
    let merge = h.merge_set_ix(&w, &a.pubkey(), &a_tok, 500, 1, true);
    h.ok(&[merge], &[&a]);
    let seat = h.ledger_state(&w.ledger).1[1];
    assert_eq!((seat.yes_free, seat.no_free, seat.credit), (1_500, 1_500, 0));
    assert_eq!((h.market_state(&w.market).backing_lots, h.token_amount(&a_tok)), (1_500, 10_000_000 - 1_500_000 - BOND));
}

#[test]
fn halted_and_reduce_only_block_placement_but_never_cancel_or_withdraw() {
    let (mut h, w) = window();
    let (a, a_tok) = h.funded_user(10_000_000);
    let mint = h.mint_set_ix(&w, &a.pubkey(), &a_tok, 1_000, u16::MAX, false);
    h.ok(&[mint], &[&a]);
    let mut bid = order_args(&w, BUY_YES, 300, 1_000, NORMAL);
    bid.seat_hint = 1;
    let (rested, _) = h.place(&w, &a, &a_tok, bid).unwrap();
    let admin = key(1);
    for (mode, sell_ok) in [(2u8, false), (1u8, true)] {
        let set = h.set_mode_ix(&admin.pubkey(), mode);
        h.ok(&[set], &[&admin]);
        assert_eq!(h.place(&w, &a, &a_tok, bid).unwrap_err(), 6000, "mode {mode} refuses a buy");
        let again = h.mint_set_ix(&w, &a.pubkey(), &a_tok, 1_000, 1, false);
        assert_eq!(h.send(&[again], &[&a]).unwrap_err(), 6000, "mode {mode} refuses a mint");
        let mut sell = order_args(&w, SELL_YES, 900, 1_000, NORMAL);
        sell.seat_hint = 1;
        assert_eq!(h.place(&w, &a, &a_tok, sell).is_ok(), sell_ok, "mode {mode} sell");
    }
    let handle = OrderHandle { node: rested.rested.node, seq: rested.rested.seq };
    let cancel = h.cancel_orders_ix(&w, &a.pubkey(), Some(&a_tok), vec![handle], 1);
    h.ok(&[cancel], &[&a]);
    assert_eq!(h.ledger_state(&w.ledger).1[1].credit, 0, "the refund was withdrawn in ReduceOnly");
}

#[test]
fn compute_for_a_ten_fill_ioc_a_resting_order_a_cancel_and_a_mint() {
    let (mut h, w) = window();
    let (m, m_tok) = h.funded_user(100_000_000);
    let (t, t_tok) = h.funded_user(100_000_000);
    let (first, rest) = h.place(&w, &m, &m_tok, order_args(&w, BUY_NO, 500, 1_000, NORMAL)).unwrap();
    for price in 501..510u16 {
        let mut o = order_args(&w, BUY_NO, price, 1_000, NORMAL);
        o.seat_hint = first.seat;
        h.place(&w, &m, &m_tok, o).unwrap();
    }
    let mut take = order_args(&w, BUY_YES, 600, 10_000, IOC);
    take.max_fills = 10;
    let (r, ioc) = h.place(&w, &t, &t_tok, take).unwrap();
    assert_eq!((r.fills, r.filled_lots), (10, 10_000));
    let mut o = order_args(&w, BUY_NO, 700, 1_000, NORMAL);
    o.seat_hint = first.seat;
    let (again, _) = h.place(&w, &m, &m_tok, o).unwrap();
    let handle = OrderHandle { node: again.rested.node, seq: again.rested.seq };
    let cancel = h.cancel_orders_ix(&w, &m.pubkey(), None, vec![handle], first.seat);
    let cancel = h.ok(&[cancel], &[&m]);
    let mint = h.mint_set_ix(&w, &t.pubkey(), &t_tok, 1_000, r.seat, false);
    let mint = h.ok(&[mint], &[&t]);
    println!("CU/bytes: rest {}/{} · ioc 10 fills {}/{} · cancel {}/{} · mint {}/{}", rest.compute_units, rest.tx_bytes, ioc.compute_units, ioc.tx_bytes, cancel.compute_units, cancel.tx_bytes, mint.compute_units, mint.tx_bytes);
    assert!(ioc.compute_units < 200_000, "10-fill IOC used {} CU", ioc.compute_units);
    assert!(ioc.tx_bytes <= 1_232);
}
