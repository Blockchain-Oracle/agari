//! Pre-open trading on LiteSVM (D-088, "trade in advance"): a **Listed** Window rests PostOnly quotes before its
//! opening print, refuses every taker until it is Trading, and everything downstream — crossing, cancelling,
//! sweeping, voiding and redeeming — behaves exactly as it does inside a session. Codes are the engine's
//! (events-accounts.md §4); the Series seat bond is 250,000.

use agari_common::seeds::{event_authority_address, result_address};
use agari_events::events::OrderHandle;
use agari_events::state::StopReason;
use agari_events_tests::harness::key;
use agari_events_tests::trade::{order_args, Window};
use agari_events_tests::Harness;
use anchor_lang::prelude::Pubkey;
use anchor_lang::solana_program::instruction::Instruction;
use anchor_lang::solana_program::system_program;
use anchor_lang::{InstructionData, ToAccountMetas};
use solana_signer::Signer;

const BUY_YES: u8 = 0;
const BUY_NO: u8 = 2;
const NORMAL: u8 = 0;
const FOK: u8 = 1;
const IOC: u8 = 2;
const POST_ONLY: u8 = 3;
const BOND: u64 = 250_000;

const PRE_OPEN_TAKER_REFUSED: u32 = 6121;
const POST_ONLY_WOULD_CROSS: u32 = 6109;

/// The clock `listed_window` leaves behind: an hour before `trading_start`.
fn listed() -> (Harness, Window) {
    let mut h = Harness::new();
    let w = h.listed_window();
    (h, w)
}

fn void_ix(w: &Window) -> Instruction {
    let accounts = agari_events::accounts::PublicResolveWindow {
        payer: key(3).pubkey(),
        series: w.series,
        market: w.market,
        result: result_address(&agari_events::ID, &w.market).0,
        system_program: system_program::ID,
        event_authority: event_authority_address(&agari_events::ID).0,
        program: agari_events::ID,
    };
    Instruction { program_id: agari_events::ID, accounts: accounts.to_account_metas(None), data: agari_events::instruction::PublicVoidExpired {}.data() }
}

#[test]
fn a_listed_window_rests_post_only_refuses_takers_and_fills_at_the_open() {
    let (mut h, w) = listed();
    let (maker, maker_tok) = h.funded_user(5_000_000);
    let (taker, taker_tok) = h.funded_user(5_000_000);
    assert_eq!(h.market_state(&w.market).open.source, 0, "the Window has no opening print yet");

    // 1. A PostOnly bid rests an hour before the open, escrow and bond pulled like any other resting order.
    let (rested, _) = h.place(&w, &maker, &maker_tok, order_args(&w, BUY_YES, 400, 1_000, POST_ONLY)).unwrap();
    assert_eq!((rested.rested_lots, rested.transferred_in), (1_000, 400_000 + BOND));
    assert_eq!(rested.stop_reason, StopReason::PostOnlyRested as u8);
    assert_eq!(h.token_amount(&w.mvault), 400_000 + BOND);

    // 2. No taker may price itself against a Window that has no open print.
    for order_type in [NORMAL, FOK, IOC] {
        assert_eq!(
            h.place(&w, &taker, &taker_tok, order_args(&w, BUY_NO, 400, 1_000, order_type)).unwrap_err(),
            PRE_OPEN_TAKER_REFUSED,
            "order type {order_type} before the open",
        );
    }
    // 3. A second maker still may not cross the resting quote pre-open.
    assert_eq!(h.place(&w, &taker, &taker_tok, order_args(&w, BUY_NO, 400, 1_000, POST_ONLY)).unwrap_err(), POST_ONLY_WOULD_CROSS);
    assert_eq!(h.book_state(&w.book).order_count, 1, "nothing rested from the refusals");

    // 4. From the open boundary the same taker fills at the resting price: NO costs 1,000 − 400 per lot.
    h.warp_to(w.start + 10);
    let (filled, _) = h.place(&w, &taker, &taker_tok, order_args(&w, BUY_NO, 400, 1_000, IOC)).unwrap();
    assert_eq!((filled.filled_lots, filled.cash_spent, filled.transferred_in), (1_000, 600_000, 600_000 + BOND));
    assert_eq!(h.market_state(&w.market).backing_lots, 1_000, "the pre-open quote minted the pair");
    assert_eq!(h.token_amount(&w.mvault), 1_000_000 + 2 * BOND);
}

#[test]
fn a_pre_open_quote_cancels_while_listed_and_otherwise_sweeps_voids_and_redeems() {
    let (mut h, w) = listed();
    let (maker, maker_tok) = h.funded_user(5_000_000);
    let before = h.token_amount(&maker_tok);

    // 5. A cancel while Listed refunds the escrow (the bond stays with the seat).
    let (first, _) = h.place(&w, &maker, &maker_tok, order_args(&w, BUY_YES, 300, 1_000, POST_ONLY)).unwrap();
    let handle = OrderHandle { node: first.rested.node, seq: first.rested.seq };
    let cancel = h.cancel_orders_ix(&w, &maker.pubkey(), Some(&maker_tok), vec![handle], first.seat);
    h.ok(&[cancel], &[&maker]);
    assert_eq!(h.token_amount(&maker_tok), before - BOND, "the escrow came back, the seat keeps its bond");
    assert_eq!(h.book_state(&w.book).order_count, 0);

    // A second quote rests pre-open and is left alone: the Window locks without an opening print.
    let mut again = order_args(&w, BUY_YES, 400, 1_000, POST_ONLY);
    again.seat_hint = first.seat; // D-020: an authority that already holds a seat names it.
    let (second, _) = h.place(&w, &maker, &maker_tok, again).unwrap();
    assert_eq!(second.rested_lots, 1_000);

    // 6. Past the lock the sweep refunds the expired order to seat credit, the Window voids with no print, and the
    //    crank redeems credit + bond, draining the mvault.
    h.warp_to(w.start + 301);
    let sweep = h.sweep_ix(&w, 32);
    h.ok(&[sweep], &[&key(3)]);
    assert_eq!(h.book_state(&w.book).order_count, 0);
    assert_eq!(h.ledger_state(&w.ledger).1[usize::from(second.seat)].credit, 400_000, "the sweep refunded the escrow to credit");

    h.warp_to(w.start + 901);
    h.ok(&[void_ix(&w)], &[&key(3)]);
    let (ixs, ata) = h.crank_redeem_ixs(&w, &key(3).pubkey(), &maker.pubkey(), second.seat);
    h.ok(&ixs, &[&key(3)]);
    assert_eq!(h.token_amount(&ata), 400_000 + BOND, "credit and bond paid out");
    assert_eq!(h.token_amount(&w.mvault), 0, "the mvault drains to zero");
}
