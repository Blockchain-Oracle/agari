//! S21 desk.md §9: opening a desk, allowing names, the owner's controls, and who may do what.

use agari_desk::constants::{MAX_TOKENS, MODE_PRACTICE};
use agari_desk::errors::DeskError;
use agari_desk::events::{DeskOpened, Paused, TokenAllowed};
use agari_events_tests::desk::{DeskWorld, DAILY, HASH_A, MAX_PREMIUM_BPS, MODE_ON_ITS_OWN, PER_ACTION};
use agari_events_tests::desk_ix::PubkeyOf;
use agari_events_tests::desk_token::NAME_MULTIPLIER;
use agari_events_tests::harness::key;
use agari_events_tests::vault::event;
use anchor_lang::prelude::Pubkey;
use anchor_spl::token::spl_token;

const fn code(e: DeskError) -> u32 {
    6000 + e as u32
}
/// Anchor `AccountOwnedByWrongProgram`: a desk derived from a key that never opened one is an empty system account.
const NO_SUCH_DESK: u32 = 3007;

#[test]
fn opens_with_the_config_and_allows_the_name() {
    let mut w = DeskWorld::new();
    let owner = w.owner.pubkey_of();
    let open = w.open_desk_ix(&owner, w.operator.pubkey_of(), PER_ACTION, DAILY, MAX_PREMIUM_BPS, MODE_ON_ITS_OWN);
    let owner_key = w.owner.insecure_clone();
    let (_, events) = w.send_as(&owner_key, &[open]).expect("open");
    let opened: DeskOpened = event(&events).expect("DeskOpened");
    assert_eq!((opened.owner, opened.per_action_cap, opened.daily_cap, opened.mode), (owner, PER_ACTION, DAILY, MODE_ON_ITS_OWN));
    let allow = w.allow_token_ix(&owner, &w.name.mint);
    let (_, events) = w.send_as(&owner_key, &[allow]).expect("allow");
    let allowed: TokenAllowed = event(&events).expect("TokenAllowed");
    assert_eq!((allowed.mint, allowed.index), (w.name.mint, 0));

    let desk = w.desk();
    assert_eq!((desk.owner, desk.operator), (owner, w.operator.pubkey_of()));
    assert_eq!((desk.per_action_cap, desk.daily_cap, desk.max_premium_bps, desk.mode, desk.paused), (PER_ACTION, DAILY, MAX_PREMIUM_BPS, MODE_ON_ITS_OWN, 0));
    assert_eq!((desk.seq, desk.head, desk.spent_in_window, desk.token_count), (0, [0u8; 32], 0, 1));
    assert_eq!((desk.tokens[0].mint, desk.tokens[0].enabled), (w.name.mint, 1));
    assert!(desk.tokens[1].is_free());
    // Both associated accounts exist and are empty.
    assert_eq!(w.h.token_amount(&w.desk_usdc()), 0);
    assert_eq!(w.h.amount_2022(&w.desk_name()), 0);
    let config = w.config();
    assert_eq!((config.admin, config.usdc_mint, config.swap_program, config.cluster_tag), (key(1).pubkey_of(), w.usdc, agari_swap_stub::ID, 104));
    assert_eq!(config.attestors[0], w.attestor.pubkey_of());
}

#[test]
fn open_refuses_bad_caps_modes_and_operators() {
    let mut w = DeskWorld::new();
    let owner = w.owner.pubkey_of();
    let owner_key = w.owner.insecure_clone();
    let operator = w.operator.pubkey_of();
    for (per_action, daily, mode, operator, expected) in [
        (DAILY + 1, DAILY, MODE_ON_ITS_OWN, operator, DeskError::BadConfig),
        (0, DAILY, MODE_ON_ITS_OWN, operator, DeskError::BadConfig),
        (PER_ACTION, DAILY, 3, operator, DeskError::BadConfig),
        (PER_ACTION, DAILY, MODE_ON_ITS_OWN, owner, DeskError::BadOperator),
    ] {
        let ix = w.open_desk_ix(&owner, operator, per_action, daily, MAX_PREMIUM_BPS, mode);
        assert_eq!(w.send_as(&owner_key, &[ix]).unwrap_err(), code(expected));
    }
    // A desk with no operator yet is allowed: the owner names one later.
    let ix = w.open_desk_ix(&owner, Pubkey::default(), PER_ACTION, DAILY, MAX_PREMIUM_BPS, MODE_PRACTICE);
    w.send_as(&owner_key, &[ix]).expect("open without an operator");
    assert_eq!(w.desk().operator, Pubkey::default());
}

#[test]
fn allow_refuses_the_collateral_the_wrong_decimals_and_a_ninth_name() {
    let mut w = DeskWorld::new();
    w.open_default();
    let owner = w.owner.pubkey_of();
    let owner_key = w.owner.insecure_clone();
    // The collateral, under its own program.
    let usdc = w.usdc;
    let ix = w.allow_token_with_program_ix(&owner, &usdc, &spl_token::ID);
    assert_eq!(w.send_as(&owner_key, &[ix]).unwrap_err(), code(DeskError::BadToken));
    // A Token-2022 mint with 6 decimals.
    let six = w.h.create_plain_2022_mint(6);
    let ix = w.allow_token_ix(&owner, &six);
    assert_eq!(w.send_as(&owner_key, &[ix]).unwrap_err(), code(DeskError::BadToken));
    // Seven more names fill the desk; the ninth is refused; the first can be allowed again (re-enabled).
    for i in 1..MAX_TOKENS {
        let name = w.h.create_name_mint(NAME_MULTIPLIER);
        let ix = w.allow_token_ix(&owner, &name.mint);
        let (_, events) = w.send_as(&owner_key, &[ix]).expect("allow");
        assert_eq!(event::<TokenAllowed>(&events).unwrap().index, i as u8);
    }
    assert_eq!(w.desk().token_count, MAX_TOKENS as u8);
    let ninth = w.h.create_name_mint(NAME_MULTIPLIER);
    let ix = w.allow_token_ix(&owner, &ninth.mint);
    assert_eq!(w.send_as(&owner_key, &[ix]).unwrap_err(), code(DeskError::TooManyTokens));
    let first = w.name.mint;
    let ix = w.disallow_token_ix(&owner, &first);
    w.send_as(&owner_key, &[ix]).expect("disallow");
    assert_eq!(w.desk().tokens[0].enabled, 0);
    let ix = w.allow_token_ix(&owner, &first);
    w.send_as(&owner_key, &[ix]).expect("re-allow");
    assert_eq!((w.desk().tokens[0].enabled, w.desk().token_count), (1, MAX_TOKENS as u8));
    // Disallowing a name that was never configured is refused.
    let ix = w.disallow_token_ix(&owner, &ninth.mint);
    assert_eq!(w.send_as(&owner_key, &[ix]).unwrap_err(), code(DeskError::TokenNotConfigured));
}

#[test]
fn a_stranger_has_no_desk_to_act_on() {
    let mut w = DeskWorld::new();
    w.open_default();
    let stranger = w.h.fresh_key();
    w.h.svm.airdrop(&stranger.pubkey_of(), 10_000_000_000).unwrap();
    let mint = w.name.mint;
    let ix = w.disallow_token_ix(&stranger.pubkey_of(), &mint);
    assert_eq!(w.send_as(&stranger, &[ix]).unwrap_err(), NO_SUCH_DESK);
    let ix = w.set_mode_ix(&stranger.pubkey_of(), MODE_PRACTICE);
    assert_eq!(w.send_as(&stranger, &[ix]).unwrap_err(), NO_SUCH_DESK);
}

#[test]
fn the_owners_controls_and_the_pause_rules() {
    let mut w = DeskWorld::new();
    w.open_default();
    let owner = w.owner.pubkey_of();
    let owner_key = w.owner.insecure_clone();
    let operator = w.operator.insecure_clone();

    let ix = w.set_limits_ix(&owner, 20_000_000, 60_000_000, 500, true);
    w.send_as(&owner_key, &[ix]).expect("limits");
    let desk = w.desk();
    assert_eq!((desk.per_action_cap, desk.daily_cap, desk.max_premium_bps, desk.require_pyth_index), (20_000_000, 60_000_000, 500, 1));
    let ix = w.set_limits_ix(&owner, 70_000_000, 60_000_000, 500, false);
    assert_eq!(w.send_as(&owner_key, &[ix]).unwrap_err(), code(DeskError::BadConfig));

    let ix = w.set_mode_ix(&owner, 3);
    assert_eq!(w.send_as(&owner_key, &[ix]).unwrap_err(), code(DeskError::BadConfig));
    let ix = w.set_mode_ix(&owner, MODE_PRACTICE);
    w.send_as(&owner_key, &[ix]).expect("mode");
    assert_eq!(w.desk().mode, MODE_PRACTICE);

    for bad in [owner, Pubkey::default()] {
        let ix = w.set_operator_ix(&owner, bad);
        assert_eq!(w.send_as(&owner_key, &[ix]).unwrap_err(), code(DeskError::BadOperator));
    }

    // The operator may pause; a stranger may not; only the owner unpauses.
    let ix = w.pause_ix(&operator.pubkey_of(), &owner);
    let (_, events) = w.send_as(&operator, &[ix]).expect("operator pauses");
    assert_eq!(event::<Paused>(&events).unwrap().by, operator.pubkey_of());
    assert_eq!(w.desk().paused, 1);
    let stranger = w.h.fresh_key();
    w.h.svm.airdrop(&stranger.pubkey_of(), 10_000_000_000).unwrap();
    let ix = w.pause_ix(&stranger.pubkey_of(), &owner);
    assert_eq!(w.send_as(&stranger, &[ix]).unwrap_err(), code(DeskError::NotOwnerOrOperator));
    let ix = w.unpause_ix(&owner);
    w.send_as(&owner_key, &[ix]).expect("unpause");
    assert_eq!(w.desk().paused, 0);

    // Revoking the operator pauses the desk and takes its access away at once.
    let ix = w.revoke_operator_ix(&owner);
    w.send_as(&owner_key, &[ix]).expect("revoke");
    let desk = w.desk();
    assert_eq!((desk.operator, desk.paused), (Pubkey::default(), 1));
    assert_eq!(w.checkpoint(HASH_A).unwrap_err(), code(DeskError::NotOperator));
    let ix = w.set_operator_ix(&owner, operator.pubkey_of());
    w.send_as(&owner_key, &[ix]).expect("set operator");
    // Paused still: the operator may checkpoint but not pause-bypass anything else (desk_guards proves the sends).
    w.checkpoint(HASH_A).expect("checkpoint while paused");
}
