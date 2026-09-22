//! S21 desk.md §6, §9: the hash chain. Every operator action, "did nothing" included, advances `seq` gap-free and
//! `head = sha256(head ‖ seq ‖ hash)`, recomputed here with an independent sha256 (the `sha2` crate, not the
//! program's hasher) from the events alone.

use agari_desk::constants::MODE_PRACTICE;
use agari_desk::errors::DeskError;
use agari_desk::events::{Bought, Checkpoint, Sold};
use agari_desk::guard::sell_oracle_value;
use agari_events_tests::desk::{DeskWorld, DAILY, MAX_PREMIUM_BPS, MULTIPLIER_E12, ONE_TOKEN, ONE_USDC, PER_ACTION, TOKEN_PRICE_E8};
use agari_events_tests::desk_ix::PubkeyOf;
use agari_events_tests::vault::event;
use sha2::{Digest, Sha256};

const fn code(e: DeskError) -> u32 {
    6000 + e as u32
}

/// `sha256(prev ‖ seq LE u64 ‖ hash)`, independently of the program's crate.
fn next_head(prev: &[u8; 32], seq: u64, hash: &[u8; 32]) -> [u8; 32] {
    Sha256::new().chain_update(prev).chain_update(seq.to_le_bytes()).chain_update(hash).finalize().into()
}

#[test]
fn checkpoints_seal_in_practice_and_while_paused() {
    let mut w = DeskWorld::new();
    w.open(PER_ACTION, DAILY, MAX_PREMIUM_BPS, MODE_PRACTICE);
    let (_, events) = w.checkpoint([1u8; 32]).expect("practice checkpoint");
    let first: Checkpoint = event(&events).expect("Checkpoint");
    assert_eq!((first.seq, first.decision_hash), (1, [1u8; 32]));
    let expected = next_head(&[0u8; 32], 1, &[1u8; 32]);
    assert_eq!(first.head, expected);
    assert_eq!((w.desk().seq, w.desk().head), (1, expected));

    let owner = w.owner.pubkey_of();
    let operator = w.operator.insecure_clone();
    let ix = w.pause_ix(&operator.pubkey_of(), &owner);
    w.send_as(&operator, &[ix]).expect("pause");
    let (_, events) = w.checkpoint([2u8; 32]).expect("paused checkpoint");
    let second: Checkpoint = event(&events).expect("Checkpoint");
    let expected = next_head(&expected, 2, &[2u8; 32]);
    assert_eq!((second.seq, second.head), (2, expected));
    assert_eq!(w.desk().head, expected);

    assert_eq!(w.checkpoint([0u8; 32]).unwrap_err(), code(DeskError::ZeroHash));
    let now = w.now();
    let ix = w.checkpoint_ix(&operator.pubkey_of(), now - 1, [3u8; 32]);
    assert_eq!(w.send_as(&operator, &[ix]).unwrap_err(), code(DeskError::DeadlinePassed));
    assert_eq!(w.desk().seq, 2, "a refused checkpoint leaves no gap and no seal");
}

#[test]
fn buy_sell_and_checkpoint_chain_together_and_replay_from_the_events() {
    let mut w = DeskWorld::new();
    w.open_default();
    w.fund(1_000 * ONE_USDC, 5 * ONE_TOKEN);
    let hashes = [[0xA1u8; 32], [0xB2u8; 32], [0xC3u8; 32], [0xD4u8; 32]];

    let fill = w.honest_fill(PER_ACTION);
    let (_, events) = w.buy(PER_ACTION, 0, hashes[0], PER_ACTION, fill, &[]).expect("buy");
    let bought: Bought = event(&events).expect("Bought");
    let raw = 20_000_000;
    let value = sell_oracle_value(raw, MULTIPLIER_E12, TOKEN_PRICE_E8).unwrap();
    let (_, events) = w.sell(raw, 0, hashes[1], raw, value, &[]).expect("sell");
    let sold: Sold = event(&events).expect("Sold");
    let (_, events) = w.checkpoint(hashes[2]).expect("checkpoint");
    let sealed: Checkpoint = event(&events).expect("Checkpoint");
    let (_, events) = w.checkpoint(hashes[3]).expect("checkpoint");
    let sealed_again: Checkpoint = event(&events).expect("Checkpoint");

    // Gap-free, in order, and every event's head is the replay's.
    let mut head = [0u8; 32];
    let heads: Vec<[u8; 32]> = hashes
        .iter()
        .enumerate()
        .map(|(i, h)| {
            head = next_head(&head, i as u64 + 1, h);
            head
        })
        .collect();
    assert_eq!((bought.seq, bought.head), (1, heads[0]));
    assert_eq!((sold.seq, sold.head), (2, heads[1]));
    assert_eq!((sealed.seq, sealed.head), (3, heads[2]));
    assert_eq!((sealed_again.seq, sealed_again.head), (4, heads[3]));
    let desk = w.desk();
    assert_eq!((desk.seq, desk.head), (4, heads[3]));
    // The program's own helper agrees with the independent hasher.
    assert_eq!(agari_desk::chain::next_head(&heads[2], 4, &hashes[3]), heads[3]);
}
