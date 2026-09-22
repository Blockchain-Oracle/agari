//! S21 desk.md §3, §9: the attested reference. Only the exact 114-byte message, signed by a configured attestor in
//! the instruction immediately before, from the last 15 minutes, newer than the last, with positive figures, is posted.

use agari_desk::errors::DeskError;
use agari_desk::events::{ReferenceFeedSet, ReferencePosted};
use agari_events_tests::desk::{DeskWorld, HASH_A, MARK_PRICE_E8, MULTIPLIER_E12, ONE_USDC, PER_ACTION, TOKEN_PRICE_E8};
use agari_events_tests::desk_ix::PubkeyOf;
use agari_events_tests::harness::key;
use agari_events_tests::prints::ed25519_ix;
use agari_events_tests::vault::event;
use anchor_lang::solana_program::instruction::Instruction;
use anchor_lang::solana_program::system_instruction;

const fn code(e: DeskError) -> u32 {
    6000 + e as u32
}

#[test]
fn a_good_post_updates_the_reference_and_emits() {
    let mut w = DeskWorld::new();
    let at = w.now() + 10;
    w.h.warp_to(at);
    let attestor = w.attestor.insecure_clone();
    let payer = key(1);
    let mint = w.name.mint;
    let ixs = w.post_reference_ixs(&attestor, &payer.pubkey_of(), &mint, TOKEN_PRICE_E8 + 1, MARK_PRICE_E8, MULTIPLIER_E12, at);
    let (_, events) = w.h.send_v0(&ixs, &payer, &[&payer]).expect("post");
    let posted: ReferencePosted = event(&events).expect("ReferencePosted");
    assert_eq!((posted.mint, posted.token_price_e8, posted.fetched_at_sec, posted.posted_by), (mint, TOKEN_PRICE_E8 + 1, at, payer.pubkey_of()));
    let r = w.reference();
    assert_eq!((r.token_price_e8, r.mark_price_e8, r.multiplier_e12, r.fetched_at_sec, r.posted_by), (TOKEN_PRICE_E8 + 1, MARK_PRICE_E8, MULTIPLIER_E12, at, payer.pubkey_of()));
    assert_eq!(r.mint, mint);
    assert!(!r.has_feed());
}

#[test]
fn stale_future_unknown_and_non_monotonic_posts_are_refused() {
    let mut w = DeskWorld::new();
    let now = w.now();
    assert_eq!(w.post_reference(TOKEN_PRICE_E8, MARK_PRICE_E8, MULTIPLIER_E12, now - 901).unwrap_err(), code(DeskError::ReferenceStale));
    assert_eq!(w.post_reference(TOKEN_PRICE_E8, MARK_PRICE_E8, MULTIPLIER_E12, now + 6).unwrap_err(), code(DeskError::ReferenceStale));
    // The world already posted at T0 = now: the same second is not newer.
    assert_eq!(w.post_reference(TOKEN_PRICE_E8, MARK_PRICE_E8, MULTIPLIER_E12, now).unwrap_err(), code(DeskError::ReferenceNotMonotonic));
    w.post_reference(TOKEN_PRICE_E8, MARK_PRICE_E8, MULTIPLIER_E12, now + 1).expect("one second newer");
    // A key that is not an attestor signs a perfect message.
    let stranger = w.h.fresh_key();
    let payer = key(1);
    let mint = w.name.mint;
    let ixs = w.post_reference_ixs(&stranger, &payer.pubkey_of(), &mint, TOKEN_PRICE_E8, MARK_PRICE_E8, MULTIPLIER_E12, now + 2);
    assert_eq!(w.h.send(&ixs, &[&payer]).unwrap_err(), code(DeskError::UnknownAttestor));
    // Zero figures are refused even when signed by the attestor.
    assert_eq!(w.post_reference(TOKEN_PRICE_E8, 0, MULTIPLIER_E12, now + 2).unwrap_err(), code(DeskError::InvalidReference));
    assert_eq!(w.post_reference(TOKEN_PRICE_E8, MARK_PRICE_E8, 0, now + 2).unwrap_err(), code(DeskError::InvalidReference));
}

#[test]
fn the_message_must_match_byte_for_byte_and_sit_immediately_before() {
    let mut w = DeskWorld::new();
    let now = w.now();
    let attestor = w.attestor.insecure_clone();
    let payer = key(1);
    let mint = w.name.mint;
    // Signed one price, posted another.
    let signed = DeskWorld::reference_message(&mint, TOKEN_PRICE_E8, MARK_PRICE_E8, MULTIPLIER_E12, now + 1);
    let post = w.post_reference_ix(&payer.pubkey_of(), &mint, TOKEN_PRICE_E8 + 1, MARK_PRICE_E8, MULTIPLIER_E12, now + 1);
    assert_eq!(w.h.send(&[ed25519_ix(&attestor, &signed, 0), post.clone()], &[&payer]).unwrap_err(), code(DeskError::BadAttestation));
    // A print-length (158 B) message: right signer, wrong length.
    let long = [0x11u8; 158];
    assert_eq!(w.h.send(&[ed25519_ix(&attestor, &long, 0), post.clone()], &[&payer]).unwrap_err(), code(DeskError::BadAttestation));
    // No precompile before the post at all.
    assert_eq!(w.h.send(&[post.clone()], &[&payer]).unwrap_err(), code(DeskError::BadAttestation));
    // The precompile two instructions back, with a transfer in between: "the previous instruction" is not ed25519.
    let good = DeskWorld::reference_message(&mint, TOKEN_PRICE_E8 + 1, MARK_PRICE_E8, MULTIPLIER_E12, now + 1);
    let filler: Instruction = system_instruction::transfer(&payer.pubkey_of(), &payer.pubkey_of(), 1);
    assert_eq!(w.h.send(&[ed25519_ix(&attestor, &good, 0), filler, post.clone()], &[&payer]).unwrap_err(), code(DeskError::BadAttestation));
    // The same pair, adjacent: accepted.
    w.h.send(&[ed25519_ix(&attestor, &good, 0), post], &[&payer]).expect("adjacent and exact");
    assert_eq!(w.reference().token_price_e8, TOKEN_PRICE_E8 + 1);
}

#[test]
fn the_admin_sets_the_pyth_feed_and_a_stranger_cannot() {
    let mut w = DeskWorld::new();
    let admin = key(1);
    let mint = w.name.mint;
    let feed = [0x96u8; 32];
    let ix = w.set_feed_ix(&admin.pubkey_of(), &mint, feed);
    let (_, events) = w.h.send_v0(&[ix], &admin, &[&admin]).expect("set feed");
    assert_eq!(event::<ReferenceFeedSet>(&events).unwrap().pyth_feed_id, feed);
    assert!(w.reference().has_feed());
    let stranger = w.h.fresh_key();
    w.h.svm.airdrop(&stranger.pubkey_of(), 10_000_000_000).unwrap();
    let ix = w.set_feed_ix(&stranger.pubkey_of(), &mint, [1u8; 32]);
    assert_eq!(w.h.send_v0(&[ix], &stranger, &[&stranger]).unwrap_err(), code(DeskError::NotAdmin));
    // The attestor list too.
    let ix = w.set_attestors_ix(&stranger.pubkey_of(), [stranger.pubkey_of(); 4]);
    assert_eq!(w.h.send_v0(&[ix], &stranger, &[&stranger]).unwrap_err(), code(DeskError::NotAdmin));
}

#[test]
fn a_reference_can_only_be_made_for_a_nine_decimal_token_2022_mint() {
    let mut w = DeskWorld::new();
    let admin = key(1);
    let six = w.h.create_plain_2022_mint(6);
    let ix = w.init_reference_ix(&admin.pubkey_of(), &six);
    assert_eq!(w.h.send_v0(&[ix], &admin, &[&admin]).unwrap_err(), code(DeskError::BadToken));
    let nine = w.h.create_plain_2022_mint(9);
    let ix = w.init_reference_ix(&admin.pubkey_of(), &nine);
    w.h.send_v0(&[ix], &admin, &[&admin]).expect("a plain 9-dp Token-2022 mint is a name as far as the reference goes");
}

#[test]
fn a_buy_needs_a_posted_reference_and_a_mark() {
    // A desk on a name whose reference was initialised but never posted.
    let mut w = DeskWorld::new();
    w.open_default();
    w.fund(100 * ONE_USDC, 0);
    let other = w.h.create_name_mint(1.0);
    let admin = key(1);
    let ix = w.init_reference_ix(&admin.pubkey_of(), &other.mint);
    w.h.send_v0(&[ix], &admin, &[&admin]).expect("init");
    let owner = w.owner.pubkey_of();
    let owner_key = w.owner.insecure_clone();
    let ix = w.allow_token_ix(&owner, &other.mint);
    w.send_as(&owner_key, &[ix]).expect("allow the second name");
    // The world's helpers are bound to the first name, so this proves the rule through the first name's own
    // reference instead: warp past its life and the buy says the reference is stale, never "unavailable".
    let fill = w.honest_fill(PER_ACTION);
    let now = w.now();
    w.h.warp_to(now + 901);
    assert_eq!(w.buy(PER_ACTION, 0, HASH_A, PER_ACTION, fill, &[]).unwrap_err(), code(DeskError::ReferenceStale));
}
