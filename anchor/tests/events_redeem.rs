//! Redeem on LiteSVM (S2.12): real tokens out of the mvault after Up, Down and void, the refusals in the spec's
//! order, a product's partial redeem on its PROGRAM seat, and a crank paying a user only to their own ATA.

use agari_events_tests::settlement::*;
use anchor_lang::prelude::Pubkey;
use solana_signer::Signer;

const MARKET_NOT_TERMINAL: u32 = 6102;
const SEAT_MISMATCH: u32 = 6115;
const INVALID_ORDER_ARGS: u32 = 6120;
const OPEN_ORDERS_REMAIN: u32 = 6224;
const PROGRAM_SEAT_NOT_PUBLIC: u32 = 6225;
const PARTIAL_REDEEM_NOT_ALLOWED: u32 = 6232;
const WRONG_TOKEN_OWNER: u32 = 6305;

/// The Ledger seat `owner` holds.
fn seat_of(t: &Traded, owner: &Pubkey) -> u16 {
    let (_, seats) = t.w.h.ledger_state(&t.win.ledger);
    seats.iter().position(|s| s.owner == *owner).expect("seat") as u16
}

/// Full redeem by `user` to its own token account; returns what the account received.
fn redeem_self(t: &mut Traded, user: &solana_keypair::Keypair, token: &Pubkey) -> (u64, agari_events_tests::Sent) {
    let seat = seat_of(t, &user.pubkey());
    let before = t.w.h.token_amount(token);
    let ix = t.w.h.redeem_ix(&t.win, &user.pubkey(), token, seat, None, None);
    let sent = t.w.h.send(&[ix], &[user]).expect("redeem");
    (t.w.h.token_amount(token) - before, sent)
}

#[test]
fn full_redeem_pays_example_8_under_up_down_and_void_to_the_base_unit_bonds_included() {
    // A: credit 3,720,000 + 4,000 YES + bond. D: 4,000 NO + bond. The product: 2,000 complete sets, worth 2,000,000
    // whatever happens. The mvault holds exactly the sum, and ends empty.
    for (outcome, a_paid, d_paid) in [(Outcome::Up, 7_970_000, BOND), (Outcome::Down, 3_970_000, 4_000_000 + BOND), (Outcome::Void, 5_970_000, 2_000_000 + BOND)] {
        let mut t = Traded::new();
        let start = t.w.h.token_amount(&t.win.mvault);
        assert_eq!(start, 7_720_000 + 2 * BOND + 2_000_000);
        t.resolve(outcome);
        t.sweep();
        let (a, a_tok, d, d_tok) = (t.a.0.insecure_clone(), t.a.1, t.d.0.insecure_clone(), t.d.1);
        let (paid_a, sent) = redeem_self(&mut t, &a, &a_tok);
        let (paid_d, _) = redeem_self(&mut t, &d, &d_tok);
        let p = product();
        let product_token = t.product_token;
        let (paid_p, partial) = if outcome == Outcome::Up {
            // A product takes part of its YES first (1,500 lots), then the rest.
            let before = t.w.h.token_amount(&product_token);
            let part = t.w.h.redeem_ix(&t.win, &p.pubkey(), &product_token, PRODUCT_SEAT, Some(0), Some(1_500));
            let partial_sent = t.w.h.send(&[part], &[&p]).expect("partial redeem");
            assert_eq!(t.w.h.token_amount(&product_token) - before, 1_500_000);
            let (rest, _) = redeem_self(&mut t, &p, &product_token);
            (1_500_000 + rest, Some(partial_sent))
        } else {
            (redeem_self(&mut t, &p, &product_token).0, None)
        };
        assert_eq!((paid_a, paid_d, paid_p), (a_paid, d_paid, 2_000_000), "{outcome:?}");
        assert_eq!((paid_a + paid_d + paid_p, t.w.h.token_amount(&t.win.mvault)), (start, 0), "{outcome:?}: paid exactly what the mvault held");
        let (_, seats) = t.w.h.ledger_state(&t.win.ledger);
        assert_eq!((seats[usize::from(PRODUCT_SEAT)].owner, seats[usize::from(PRODUCT_SEAT)].flags), (p.pubkey(), 1), "the PROGRAM seat stays the product's");
        if outcome == Outcome::Up {
            println!("user_redeem full: {} CU / {} B; partial: {:?}", sent.compute_units, sent.tx_bytes, partial.map(|s| (s.compute_units, s.tx_bytes)));
        }
    }
}

#[test]
fn redeem_refuses_before_terminal_with_open_orders_and_on_a_second_try() {
    let mut t = Traded::new();
    let (a, a_tok, d, d_tok) = (t.a.0.insecure_clone(), t.a.1, t.d.0.insecure_clone(), t.d.1);
    let (a_seat, d_seat) = (seat_of(&t, &a.pubkey()), seat_of(&t, &d.pubkey()));
    let early = t.w.h.redeem_ix(&t.win, &d.pubkey(), &d_tok, d_seat, None, None);
    assert_eq!(t.w.h.send(&[early], &[&d]).unwrap_err(), MARKET_NOT_TERMINAL);

    t.resolve(Outcome::Up);
    let resting = t.w.h.redeem_ix(&t.win, &a.pubkey(), &a_tok, a_seat, None, None);
    assert_eq!(t.w.h.send(&[resting], &[&a]).unwrap_err(), OPEN_ORDERS_REMAIN, "A's bid still rests");
    let one_arg = t.w.h.redeem_ix(&t.win, &d.pubkey(), &d_tok, d_seat, Some(1), None);
    assert_eq!(t.w.h.send(&[one_arg], &[&d]).unwrap_err(), INVALID_ORDER_ARGS);
    let partial = t.w.h.redeem_ix(&t.win, &d.pubkey(), &d_tok, d_seat, Some(1), Some(1_000));
    assert_eq!(t.w.h.send(&[partial], &[&d]).unwrap_err(), PARTIAL_REDEEM_NOT_ALLOWED, "only PROGRAM seats redeem part");
    let theirs = t.w.h.redeem_ix(&t.win, &d.pubkey(), &d_tok, a_seat, None, None);
    assert_eq!(t.w.h.send(&[theirs], &[&d]).unwrap_err(), SEAT_MISMATCH, "D can't redeem A's seat");

    t.sweep();
    assert_eq!(redeem_self(&mut t, &a, &a_tok).0, 7_970_000);
    // The cleared seat no longer resolves: a second redeem is refused rather than paying 0 (D-022).
    let again = t.w.h.redeem_ix(&t.win, &a.pubkey(), &a_tok, a_seat, None, None);
    assert_eq!(t.w.h.send(&[again], &[&a]).unwrap_err(), SEAT_MISMATCH);
}

#[test]
fn a_crank_pays_a_user_only_to_their_own_ata_and_never_redeems_a_program_seat() {
    let mut t = Traded::new();
    t.resolve(Outcome::Up);
    t.sweep();
    let (a, a_tok, crank) = (t.a.0.pubkey(), t.a.1, t.crank.pubkey());
    let a_seat = seat_of(&t, &a);

    // A token account A owns but that isn't its ATA: refused (AD-5 pins the destination to the derivation).
    let not_ata = t.w.h.redeem_for_ix(&t.win, &a, &a_tok, a_seat);
    assert_eq!(t.crank_send(&[not_ata]).unwrap_err(), WRONG_TOKEN_OWNER);
    // A stranger named as owner of A's seat: refused.
    let (wrong_owner, _) = t.w.h.crank_redeem_ixs(&t.win, &crank, &crank, a_seat);
    assert_eq!(t.crank_send(&wrong_owner).unwrap_err(), SEAT_MISMATCH);
    // The product's PROGRAM seat: a crank never touches it, whatever account it names.
    let program_seat = t.w.h.redeem_for_ix(&t.win, &product().pubkey(), &t.product_token, PRODUCT_SEAT);
    assert_eq!(t.crank_send(&[program_seat]).unwrap_err(), PROGRAM_SEAT_NOT_PUBLIC);

    // Create A's ATA and redeem into it in one transaction.
    let (ixs, ata) = t.w.h.crank_redeem_ixs(&t.win, &crank, &a, a_seat);
    let sent = t.crank_send(&ixs).expect("redeem_for");
    assert_eq!((t.w.h.token_amount(&ata), t.w.h.token_account(&ata).owner), (7_970_000, a));
    let (_, seats) = t.w.h.ledger_state(&t.win.ledger);
    assert_eq!(seats[usize::from(a_seat)].owner, Pubkey::default(), "the seat is cleared");
    let redeem_only = t.w.h.redeem_for_ix(&t.win, &a, &ata, a_seat);
    assert_eq!(t.crank_send(&[redeem_only]).unwrap_err(), SEAT_MISMATCH, "and can't be paid twice");
    println!("create ATA + public_redeem_for: {} CU / {} B", sent.compute_units, sent.tx_bytes);
}
