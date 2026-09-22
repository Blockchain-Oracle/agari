//! S21 desk.md §9: money in and out. Deposits pay the name's 1 % transfer fee; withdrawals pay only the owner's
//! associated account, whole balances included, and are never blocked.

use agari_desk::errors::DeskError;
use agari_desk::events::{Deposited, Withdrawn};
use agari_events_tests::desk::{DeskWorld, HASH_A, ONE_TOKEN, ONE_USDC};
use agari_events_tests::desk_ix::PubkeyOf;
use agari_events_tests::desk_token::transfer_fee;
use agari_events_tests::harness::Harness;
use agari_events_tests::vault::event;
use anchor_spl::associated_token::get_associated_token_address;
use anchor_spl::token::spl_token;

const fn code(e: DeskError) -> u32 {
    6000 + e as u32
}
const NO_SUCH_DESK: u32 = 3007;

#[test]
fn deposits_move_usdc_whole_and_the_name_net_of_its_fee() {
    let mut w = DeskWorld::new();
    w.open_default();
    let owner = w.owner.pubkey_of();
    let owner_key = w.owner.insecure_clone();
    let (usdc_before, name_before) = (w.h.token_amount(&w.owner_usdc), w.h.amount_2022(&w.owner_name));

    let deposit_usdc = w.deposit_ix(&owner, &w.usdc, &w.owner_usdc, 100 * ONE_USDC);
    let deposit_name = w.deposit_ix(&owner, &w.name.mint, &w.owner_name, ONE_TOKEN);
    let (_, events) = w.send_as(&owner_key, &[deposit_usdc, deposit_name]).expect("deposits");
    let deposited: Vec<Deposited> = events.iter().filter_map(|e| event::<Deposited>(std::slice::from_ref(e))).collect();
    assert_eq!(deposited.len(), 2);
    assert_eq!((deposited[0].mint, deposited[0].amount), (w.usdc, 100 * ONE_USDC));
    assert_eq!((deposited[1].mint, deposited[1].amount), (w.name.mint, ONE_TOKEN));

    assert_eq!(w.h.token_amount(&w.desk_usdc()), 100 * ONE_USDC);
    assert_eq!(w.h.token_amount(&w.owner_usdc), usdc_before - 100 * ONE_USDC);
    // The whole token leaves the owner; the desk receives it net of PreStocks' 100 bps.
    assert_eq!(w.h.amount_2022(&w.owner_name), name_before - ONE_TOKEN);
    assert_eq!(w.h.amount_2022(&w.desk_name()), ONE_TOKEN - transfer_fee(ONE_TOKEN));
    assert_eq!(transfer_fee(ONE_TOKEN), 10_000_000);
}

#[test]
fn deposits_refuse_zero_and_a_mint_the_desk_does_not_hold() {
    let mut w = DeskWorld::new();
    w.open_default();
    let owner = w.owner.pubkey_of();
    let owner_key = w.owner.insecure_clone();
    let ix = w.deposit_ix(&owner, &w.usdc, &w.owner_usdc, 0);
    assert_eq!(w.send_as(&owner_key, &[ix]).unwrap_err(), code(DeskError::ZeroAmount));
    // Another PreStocks-shaped name the owner holds but never allowed: the desk has no account for it.
    let other = w.h.create_name_mint(1.0);
    let owner_other = w.h.ata_2022(&owner_key, &owner, &other.mint);
    w.h.mint_name(&other, &owner_other, ONE_TOKEN);
    let desk = w.desk_address();
    w.h.ata_2022(&owner_key, &desk, &other.mint);
    let ix = w.deposit_ix(&owner, &other.mint, &owner_other, ONE_TOKEN);
    assert_eq!(w.send_as(&owner_key, &[ix]).unwrap_err(), code(DeskError::TokenNotConfigured));
}

#[test]
fn withdrawals_pay_only_the_owners_associated_account_and_take_the_whole_balance_on_max() {
    let mut w = DeskWorld::new();
    w.open_default();
    w.fund(100 * ONE_USDC, ONE_TOKEN);
    let owner = w.owner.pubkey_of();
    let owner_key = w.owner.insecure_clone();
    let held = w.h.amount_2022(&w.desk_name());

    let ix = w.withdraw_ix(&owner, &w.usdc, &w.owner_usdc, 40 * ONE_USDC);
    let (_, events) = w.send_as(&owner_key, &[ix]).expect("withdraw 40");
    assert_eq!(event::<Withdrawn>(&events).unwrap().amount, 40 * ONE_USDC);
    assert_eq!(w.h.token_amount(&w.desk_usdc()), 60 * ONE_USDC);

    let owner_name_before = w.h.amount_2022(&w.owner_name);
    let ix = w.withdraw_ix(&owner, &w.name.mint, &w.owner_name, u64::MAX);
    let (_, events) = w.send_as(&owner_key, &[ix]).expect("withdraw all");
    assert_eq!(event::<Withdrawn>(&events).unwrap().amount, held);
    assert_eq!(w.h.amount_2022(&w.desk_name()), 0);
    // The fee is paid again on the way out: the owner gets the balance net of 100 bps.
    assert_eq!(w.h.amount_2022(&w.owner_name), owner_name_before + held - transfer_fee(held));
    let ix = w.withdraw_ix(&owner, &w.name.mint, &w.owner_name, u64::MAX);
    assert_eq!(w.send_as(&owner_key, &[ix]).unwrap_err(), code(DeskError::ZeroAmount));

    // Somebody else's associated account, and a non-associated account of the owner's own, are both refused.
    let stranger = w.h.fresh_key();
    w.h.svm.airdrop(&stranger.pubkey_of(), 10_000_000_000).unwrap();
    let stranger_usdc = get_associated_token_address(&stranger.pubkey_of(), &w.usdc);
    let create = anchor_spl::associated_token::spl_associated_token_account::instruction::create_associated_token_account_idempotent(&stranger.pubkey_of(), &stranger.pubkey_of(), &w.usdc, &spl_token::ID);
    w.h.ok(&[create], &[&stranger]);
    let ix = w.withdraw_ix(&owner, &w.usdc, &stranger_usdc, ONE_USDC);
    assert_eq!(w.send_as(&owner_key, &[ix]).unwrap_err(), code(DeskError::WrongTokenOwner));
    let side_account = w.h.fresh_key();
    let usdc = w.usdc;
    w.h.create_token_account(&side_account, &usdc, &owner);
    let ix = w.withdraw_ix(&owner, &usdc, &side_account.pubkey_of(), ONE_USDC);
    assert_eq!(w.send_as(&owner_key, &[ix]).unwrap_err(), code(DeskError::WrongTokenOwner));
}

#[test]
fn withdrawals_are_never_blocked() {
    let mut w = DeskWorld::new();
    w.open_default();
    w.fund(100 * ONE_USDC, 0);
    let owner = w.owner.pubkey_of();
    let owner_key = w.owner.insecure_clone();
    let operator = w.operator.insecure_clone();
    // Paused by the operator, the operator revoked, the reference long stale: the owner still gets paid.
    let ix = w.pause_ix(&operator.pubkey_of(), &owner);
    w.send_as(&operator, &[ix]).expect("pause");
    let ix = w.revoke_operator_ix(&owner);
    w.send_as(&owner_key, &[ix]).expect("revoke");
    let now = w.now();
    w.h.warp_to(now + 7 * 86_400);
    let ix = w.withdraw_ix(&owner, &w.usdc, &w.owner_usdc, u64::MAX);
    w.send_as(&owner_key, &[ix]).expect("withdraw while paused, revoked and stale");
    assert_eq!(w.h.token_amount(&w.desk_usdc()), 0);
    // And nothing the operator could do would have moved it: no operator, no checkpoint.
    assert_eq!(w.checkpoint(HASH_A).unwrap_err(), code(DeskError::NotOperator));
}

#[test]
fn a_stranger_cannot_withdraw_or_deposit_into_another_desk() {
    let mut w = DeskWorld::new();
    w.open_default();
    w.fund(100 * ONE_USDC, 0);
    let stranger = w.h.fresh_key();
    w.h.svm.airdrop(&stranger.pubkey_of(), 10_000_000_000).unwrap();
    let stranger_usdc = Harness::ata_2022_address(&stranger.pubkey_of(), &w.usdc);
    let ix = w.withdraw_ix(&stranger.pubkey_of(), &w.usdc, &stranger_usdc, ONE_USDC);
    assert_eq!(w.send_as(&stranger, &[ix]).unwrap_err(), NO_SUCH_DESK);
}
