//! S21 desk.md §9: the operator's guards, in the program's order, each proven by breaking it on the stub router.

use agari_desk::constants::{MODE_PRACTICE, REFERENCE_MAX_AGE_SEC};
use agari_desk::errors::DeskError;
use agari_desk::events::{Bought, Sold};
use agari_desk::guard::{buy_floor, sell_oracle_value};
use agari_events_tests::desk::{DeskWorld, HASH_A, MARK_PRICE_E8, MULTIPLIER_E12, ONE_TOKEN, ONE_USDC, PER_ACTION, RICH_MARK_E8, TOKEN_PRICE_E8};
use agari_events_tests::desk_ix::PubkeyOf;
use agari_events_tests::desk_token::transfer_fee;
use agari_events_tests::vault::event;
use anchor_lang::solana_program::instruction::AccountMeta;
use anchor_lang::solana_program::system_program;

const fn code(e: DeskError) -> u32 {
    6000 + e as u32
}

fn funded() -> DeskWorld {
    let mut w = DeskWorld::new();
    w.open_default();
    w.fund(1_000 * ONE_USDC, 5 * ONE_TOKEN);
    w
}

#[test]
fn a_buy_moves_the_balances_charges_the_caps_and_seals_the_chain() {
    let mut w = funded();
    let fill = w.honest_fill(PER_ACTION);
    let (usdc_before, name_before) = (w.h.token_amount(&w.desk_usdc()), w.h.amount_2022(&w.desk_name()));
    let (_, events) = w.buy(PER_ACTION, 0, HASH_A, PER_ACTION, fill, &[]).expect("buy");
    let received = fill - transfer_fee(fill);
    assert_eq!(w.h.token_amount(&w.desk_usdc()), usdc_before - PER_ACTION);
    assert_eq!(w.h.amount_2022(&w.desk_name()), name_before + received);
    let bought: Bought = event(&events).expect("Bought");
    assert_eq!((bought.seq, bought.usdc_in, bought.token_out, bought.token_price_e8), (1, PER_ACTION, received, TOKEN_PRICE_E8));
    assert_eq!((bought.reference_e8, bought.reference_source, bought.decision_hash), (MARK_PRICE_E8, 0, HASH_A));
    let desk = w.desk();
    assert_eq!((desk.seq, desk.head, desk.spent_in_window, desk.window_start_sec), (1, bought.head, PER_ACTION, w.now()));
    assert_ne!(desk.head, [0u8; 32]);
    // The floor the program applied is the shared arithmetic, and the net fill clears it.
    assert!(received >= buy_floor(PER_ACTION, MULTIPLIER_E12, TOKEN_PRICE_E8).unwrap());
}

#[test]
fn the_caps_per_action_and_across_the_fixed_window() {
    let mut w = funded();
    let fill = w.honest_fill(PER_ACTION + 1);
    assert_eq!(w.buy(PER_ACTION + 1, 0, HASH_A, PER_ACTION + 1, fill, &[]).unwrap_err(), code(DeskError::OverPerActionCap));
    let fill = w.honest_fill(PER_ACTION);
    for _ in 0..3 {
        w.buy(PER_ACTION, 0, HASH_A, PER_ACTION, fill, &[]).expect("within the day");
    }
    assert_eq!(w.buy(PER_ACTION, 0, HASH_A, PER_ACTION, fill, &[]).unwrap_err(), code(DeskError::OverDailyCap));
    assert_eq!(w.desk().remaining_daily_cap(w.now()), 0);
    // A day later the window restarts; the reference must be re-posted first, since it is stale by then.
    let start = w.desk().window_start_sec;
    w.h.warp_to(start + 86_400);
    let now = w.now();
    w.post_reference(TOKEN_PRICE_E8, MARK_PRICE_E8, MULTIPLIER_E12, now).expect("fresh reference");
    w.buy(PER_ACTION, 0, HASH_A, PER_ACTION, fill, &[]).expect("a new window");
    assert_eq!((w.desk().spent_in_window, w.desk().window_start_sec), (PER_ACTION, now));
}

#[test]
fn the_premium_ceiling_measured_against_the_mark() {
    let mut w = funded();
    let now = w.now();
    // OpenAI's real mark that day: 15.2 % above, past the 10 % ceiling.
    w.post_reference(TOKEN_PRICE_E8, RICH_MARK_E8, MULTIPLIER_E12, now + 1).expect("rich mark");
    let fill = w.honest_fill(PER_ACTION);
    assert_eq!(w.buy(PER_ACTION, 0, HASH_A, PER_ACTION, fill, &[]).unwrap_err(), code(DeskError::PremiumTooHigh));
    // A sell is never held to the premium.
    let raw = 20_000_000;
    let value = sell_oracle_value(raw, MULTIPLIER_E12, TOKEN_PRICE_E8).unwrap();
    w.sell(raw, 0, HASH_A, raw, value, &[]).expect("sell at a rich premium");
    // Exactly at the ceiling passes: mark = token / 1.1, rounded up so the inequality holds inclusively.
    let at_ceiling = TOKEN_PRICE_E8 * 10_000 / 11_000 + 1;
    w.post_reference(TOKEN_PRICE_E8, at_ceiling, MULTIPLIER_E12, now + 2).expect("mark at the ceiling");
    w.buy(PER_ACTION, 0, HASH_A, PER_ACTION, fill, &[]).expect("at the ceiling");
}

#[test]
fn the_band_floor_the_exact_spend_and_nothing_received() {
    let mut w = funded();
    let floor = buy_floor(PER_ACTION, MULTIPLIER_E12, TOKEN_PRICE_E8).unwrap();
    // A fill whose net lands under 92 % of the attested amount.
    let short = floor * 99 / 100;
    assert_eq!(w.buy(PER_ACTION, 0, HASH_A, PER_ACTION, short, &[]).unwrap_err(), code(DeskError::BelowOracleFloor));
    // The operator's own minimum is honoured when it is above the floor.
    let fill = w.honest_fill(PER_ACTION);
    assert_eq!(w.buy(PER_ACTION, fill + 1, HASH_A, PER_ACTION, fill, &[]).unwrap_err(), code(DeskError::BelowOracleFloor));
    // The route spent less, or more, than the desk asked.
    assert_eq!(w.buy(PER_ACTION, 0, HASH_A, PER_ACTION - 1, fill, &[]).unwrap_err(), code(DeskError::UnexpectedSpend));
    assert_eq!(w.buy(PER_ACTION, 0, HASH_A, PER_ACTION + 1, fill, &[]).unwrap_err(), code(DeskError::UnexpectedSpend));
    // The route returned nothing.
    assert_eq!(w.buy(PER_ACTION, 0, HASH_A, PER_ACTION, 0, &[]).unwrap_err(), code(DeskError::NothingReceived));
    // Nothing above changed the desk.
    assert_eq!((w.desk().seq, w.desk().spent_in_window), (0, 0));
}

#[test]
fn a_desk_owned_account_slipped_into_the_route_is_a_leak() {
    let mut w = funded();
    // A second USDC account owned by the desk PDA, not its associated one.
    let side = w.h.fresh_key();
    let (usdc, desk) = (w.usdc, w.desk_address());
    w.h.create_token_account(&side, &usdc, &desk);
    let extra = [AccountMeta::new(side.pubkey_of(), false)];
    let fill = w.honest_fill(PER_ACTION);
    assert_eq!(w.buy(PER_ACTION, 0, HASH_A, PER_ACTION, fill, &extra).unwrap_err(), code(DeskError::DeskAccountLeak));
    // Somebody else's token account in the route is not the desk's problem.
    let other = w.h.fresh_key();
    let owner = w.owner.pubkey_of();
    w.h.create_token_account(&other, &usdc, &owner);
    let extra = [AccountMeta::new(other.pubkey_of(), false)];
    w.buy(PER_ACTION, 0, HASH_A, PER_ACTION, fill, &extra).expect("a foreign account is fine");
}

#[test]
fn practice_and_pause_refuse_sends_and_a_stale_reference_refuses() {
    let mut w = funded();
    let owner = w.owner.pubkey_of();
    let owner_key = w.owner.insecure_clone();
    let fill = w.honest_fill(PER_ACTION);
    let ix = w.set_mode_ix(&owner, MODE_PRACTICE);
    w.send_as(&owner_key, &[ix]).expect("practice");
    assert_eq!(w.buy(PER_ACTION, 0, HASH_A, PER_ACTION, fill, &[]).unwrap_err(), code(DeskError::ShadowMode));
    w.checkpoint(HASH_A).expect("a checkpoint is fine in practice");
    let ix = w.set_mode_ix(&owner, 1);
    w.send_as(&owner_key, &[ix]).expect("ask first");
    let operator = w.operator.insecure_clone();
    let ix = w.pause_ix(&operator.pubkey_of(), &owner);
    w.send_as(&operator, &[ix]).expect("pause");
    assert_eq!(w.buy(PER_ACTION, 0, HASH_A, PER_ACTION, fill, &[]).unwrap_err(), code(DeskError::IsPaused));
    let ix = w.unpause_ix(&owner);
    w.send_as(&owner_key, &[ix]).expect("unpause");
    let now = w.now();
    w.h.warp_to(now + REFERENCE_MAX_AGE_SEC + 1);
    assert_eq!(w.buy(PER_ACTION, 0, HASH_A, PER_ACTION, fill, &[]).unwrap_err(), code(DeskError::ReferenceStale));
    let now = w.now();
    w.post_reference(TOKEN_PRICE_E8, MARK_PRICE_E8, MULTIPLIER_E12, now).expect("fresh");
    w.buy(PER_ACTION, 0, HASH_A, PER_ACTION, fill, &[]).expect("fresh again");
}

#[test]
fn a_disallowed_name_still_sells_and_sells_count_the_larger_figure() {
    let mut w = funded();
    let owner = w.owner.pubkey_of();
    let owner_key = w.owner.insecure_clone();
    let mint = w.name.mint;
    let ix = w.disallow_token_ix(&owner, &mint);
    w.send_as(&owner_key, &[ix]).expect("disallow");
    let fill = w.honest_fill(PER_ACTION);
    assert_eq!(w.buy(PER_ACTION, 0, HASH_A, PER_ACTION, fill, &[]).unwrap_err(), code(DeskError::TokenNotEnabled));

    // 0.02 raw tokens: worth about $34 at the attested price; the route returns $33, so the attested value counts.
    let raw = 20_000_000;
    let value = sell_oracle_value(raw, MULTIPLIER_E12, TOKEN_PRICE_E8).unwrap();
    let floor = value * 92 / 100;
    let name_before = w.h.amount_2022(&w.desk_name());
    let (_, events) = w.sell(raw, 0, HASH_A, raw, floor + 1, &[]).expect("sell below the attested value");
    let sold: Sold = event(&events).expect("Sold");
    assert_eq!((sold.token_in, sold.usdc_out, sold.counted_usdc), (raw, floor + 1, value));
    assert_eq!(w.h.amount_2022(&w.desk_name()), name_before - raw, "the gross amount leaves the desk");
    assert_eq!(w.desk().spent_in_window, value);
    // The route returns more than the attested value: what came back counts.
    let (_, events) = w.sell(raw, 0, HASH_A, raw, value + 5_000_000, &[]).expect("sell above");
    assert_eq!(event::<Sold>(&events).unwrap().counted_usdc, value + 5_000_000);
    assert_eq!(w.desk().spent_in_window, 2 * value + 5_000_000);
    // A sell worth more than the per-action cap is refused before anything moves.
    let big = 50_000_000;
    assert!(sell_oracle_value(big, MULTIPLIER_E12, TOKEN_PRICE_E8).unwrap() > PER_ACTION);
    assert_eq!(w.sell(big, 0, HASH_A, big, PER_ACTION, &[]).unwrap_err(), code(DeskError::OverPerActionCap));
    // The band floor on a sell, the exact spend, and nothing received.
    assert_eq!(w.sell(raw, 0, HASH_A, raw, floor - 1, &[]).unwrap_err(), code(DeskError::BelowOracleFloor));
    assert_eq!(w.sell(raw, 0, HASH_A, raw - 1, value, &[]).unwrap_err(), code(DeskError::UnexpectedSpend));
    assert_eq!(w.sell(raw, 0, HASH_A, raw, 0, &[]).unwrap_err(), code(DeskError::NothingReceived));
}

#[test]
fn who_may_call_the_hash_the_deadline_and_the_router() {
    let mut w = funded();
    let fill = w.honest_fill(PER_ACTION);
    let stranger = w.h.fresh_key();
    w.h.svm.airdrop(&stranger.pubkey_of(), 10_000_000_000).unwrap();
    let deadline = w.now() + 60;
    let ix = w.buy_ix(&stranger.pubkey_of(), PER_ACTION, 0, deadline, HASH_A, PER_ACTION, fill, &[]);
    assert_eq!(w.send_as(&stranger, &[ix]).unwrap_err(), code(DeskError::NotOperator));
    assert_eq!(w.buy(PER_ACTION, 0, [0u8; 32], PER_ACTION, fill, &[]).unwrap_err(), code(DeskError::ZeroHash));
    assert_eq!(w.buy(0, 0, HASH_A, 0, fill, &[]).unwrap_err(), code(DeskError::ZeroAmount));
    let operator = w.operator.insecure_clone();
    let ix = w.buy_ix(&operator.pubkey_of(), PER_ACTION, 0, w.now() - 1, HASH_A, PER_ACTION, fill, &[]);
    assert_eq!(w.send_as(&operator, &[ix]).unwrap_err(), code(DeskError::DeadlinePassed));
    // A router that is not the configured one: the address constraint carries the desk's own error.
    let mut ix = w.buy_ix(&operator.pubkey_of(), PER_ACTION, 0, w.now() + 60, HASH_A, PER_ACTION, fill, &[]);
    let swap_program = ix.accounts.iter_mut().find(|m| m.pubkey == agari_swap_stub::ID).expect("router meta");
    swap_program.pubkey = system_program::ID;
    assert_eq!(w.send_as(&operator, &[ix]).unwrap_err(), code(DeskError::WrongSwapProgram));
    assert_eq!(w.desk().seq, 0);
}

#[test]
fn the_pyth_leg_must_be_present_when_the_owner_requires_it() {
    let mut w = funded();
    let owner = w.owner.pubkey_of();
    let owner_key = w.owner.insecure_clone();
    let ix = w.set_limits_ix(&owner, PER_ACTION, 3 * PER_ACTION, 1000, true);
    w.send_as(&owner_key, &[ix]).expect("require pyth");
    let fill = w.honest_fill(PER_ACTION);
    assert_eq!(w.buy(PER_ACTION, 0, HASH_A, PER_ACTION, fill, &[]).unwrap_err(), code(DeskError::PythIndexRequired));
}
