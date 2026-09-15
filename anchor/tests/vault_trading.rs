//! Trading and settlement through the vault seat on LiteSVM (vault.md §3.4–3.5, §10), ported from Masayume
//! `EventVault.trading.t.sol:21-311` over a real book: a maker rests at 0.60 YES, so YES fills at 0.60 and NO at 0.40.
//! Every landed step checks the §1 invariants. New on Solana: WindowPredatesVault, and the Ledger closing after the
//! last crank. The measured rows feed vault.md §9.

use agari_events_tests::settlement::Outcome;
use agari_events_tests::vault::{caps, ledger_open, VaultWorld, BUY_NO, MIDNIGHT, ONE, STRATEGY};
use agari_events_tests::vault_ix::{buy, sell, GrantArgs};
use agari_events_tests::vault_trade::{report, Refused, DEPOSIT};
use solana_signer::Signer;

const ZERO_AMOUNT: u32 = 7000;
const INSUFFICIENT: u32 = 7001;
const NO_SUCH_GRANT: u32 = 7100;
const NOT_GRANT_ACTOR: u32 = 7101;
const NOT_GRANT_OWNER: u32 = 7102;
const GRANT_IS_REVOKED: u32 = 7103;
const GRANT_EXPIRED: u32 = 7104;
const OVER_STAKE_CAP: u32 = 7108;
const OVER_DAILY_CAP: u32 = 7109;
const OVER_POSITION_CAP: u32 = 7110;
const OVER_PRICE_CAP: u32 = 7111;
const GRANT_ACCOUNT_MISSING: u32 = 7112;
const MARKET_NOT_TRADING: u32 = 7201;
const MARKET_NOT_SETTLED: u32 = 7202;
const NOTHING_TO_SETTLE: u32 = 7203;
const BAD_OUTCOME: u32 = 7204;
const BAD_PRICE: u32 = 7205;
const VAULT_NOT_REGISTERED: u32 = 7206;
const WINDOW_PREDATES_VAULT: u32 = 7207;
const IOC_NO_FILL: u32 = 6110;
const LEDGER_NOT_EMPTY: u32 = 6226;
const CONSTRAINT_SEEDS: u32 = 2006;
const ACCOUNT_OWNED_BY_WRONG_PROGRAM: u32 = 3007;
const DEEP: u64 = 1_000_000;

#[test]
fn place_books_the_lots_and_charges_the_actual_fill_not_the_limit() {
    let mut vw = VaultWorld::new();
    let (owner, win) = (vw.owner(DEPOSIT), vw.win);
    vw.liquidity(0, DEEP);
    let (e, sent) = vw.place(&owner, &win, buy(0, 700, 100_000)).expect("buy");
    assert_eq!((e.lots_delta, e.cash_delta, e.grant_id, e.actor, e.fills), (100_000, 60 * ONE, 0, owner.pubkey(), 1));
    assert_eq!(vw.account(&owner.pubkey()).available, DEPOSIT - 60 * ONE);
    assert_eq!((vw.slot(&owner, &win).yes_lots, vw.slot(&owner, &win).yes_grant), (100_000, 0));
    report("owner_place, 1 fill", sent);
}

#[test]
fn a_partial_fill_charges_what_filled_and_an_empty_ioc_books_nothing() {
    let mut vw = VaultWorld::new();
    let (owner, win) = (vw.owner(DEPOSIT), vw.win);
    vw.maker_rest(&win, BUY_NO, 600, 25_000);
    let (e, _) = vw.place(&owner, &win, buy(0, 700, 100_000)).expect("partial");
    assert_eq!((e.lots_delta, e.cash_delta), (25_000, 15 * ONE));
    // The book is empty now: the engine reverts the IOC and the vault books nothing.
    assert_eq!(vw.place(&owner, &win, buy(0, 700, 1_000)).refused(), IOC_NO_FILL);
    vw.liquidity(0, DEEP);
    assert_eq!(vw.place(&owner, &win, buy(0, 500, 100_000)).refused(), IOC_NO_FILL, "a limit under the book");
    assert_eq!(vw.account(&owner.pubkey()).available, DEPOSIT - 15 * ONE);
}

#[test]
fn a_no_buy_runs_in_no_terms_and_a_sell_credits_the_owner() {
    let mut vw = VaultWorld::new();
    let (owner, win) = (vw.owner(DEPOSIT), vw.win);
    vw.liquidity(0, DEEP);
    vw.place(&owner, &win, buy(0, 700, 100_000)).expect("buy YES");
    vw.liquidity(1, DEEP);
    let (no, _) = vw.place(&owner, &win, buy(1, 500, 100_000)).expect("buy NO");
    assert_eq!((no.lots_delta, no.cash_delta), (100_000, 40 * ONE));
    assert_eq!(vw.place(&owner, &win, sell(0, 500, 100_001)).refused(), INSUFFICIENT);
    assert_eq!(vw.place(&owner, &win, sell(0, 500, 0)).refused(), ZERO_AMOUNT);
    let (s, _) = vw.place(&owner, &win, sell(0, 500, 40_000)).expect("sell into the bid");
    assert_eq!((s.is_buy, s.lots_delta, s.cash_delta), (false, 40_000, 24 * ONE));
    let slot = vw.slot(&owner, &win);
    assert_eq!((slot.yes_lots, slot.no_lots), (60_000, 100_000));
    assert_eq!(vw.account(&owner.pubkey()).available, DEPOSIT - 60 * ONE - 40 * ONE + 24 * ONE);
}

#[test]
fn orders_are_refused_beyond_available_with_bad_arguments_and_outside_trading() {
    let mut vw = VaultWorld::new();
    let (owner, win) = (vw.owner(DEPOSIT), vw.win);
    vw.liquidity(0, DEEP);
    assert_eq!(vw.place(&owner, &win, buy(0, 600, 2_000_000)).refused(), INSUFFICIENT, "escrow 1,200 > 1,000");
    assert_eq!(vw.place(&owner, &win, buy(2, 600, 1_000)).refused(), BAD_OUTCOME);
    assert_eq!(vw.place(&owner, &win, buy(0, 0, 1_000)).refused(), BAD_PRICE);
    assert_eq!(vw.place(&owner, &win, buy(0, 1_000, 1_000)).refused(), BAD_PRICE);
    vw.h().warp_to(win.start + 300);
    assert_eq!(vw.place(&owner, &win, buy(0, 700, 1_000)).refused(), MARKET_NOT_TRADING);
}

#[test]
fn place_for_spends_the_budget_only_the_actor_places_and_sponsored_costs() {
    let mut vw = VaultWorld::new();
    let (owner, other, win) = (vw.owner(DEPOSIT), vw.owner(DEPOSIT), vw.win);
    let (actor, stranger, sponsor) = (vw.key(), vw.key(), vw.key());
    let id = vw.grant_strategy(&owner, &actor.pubkey(), 200 * ONE, caps(50 * ONE, 100 * ONE, 5, 0));
    vw.liquidity(0, DEEP);
    assert_eq!(vw.place_for(&stranger, &owner, id, &win, buy(0, 700, 1_000)).refused(), NOT_GRANT_ACTOR);
    // An id with no Grant account fails Anchor's account validation first (D-019); a real Grant under another id is NoSuchGrant.
    assert_eq!(vw.place_for(&actor, &owner, id + 1, &win, buy(0, 700, 1_000)).refused(), ACCOUNT_OWNED_BY_WRONG_PROGRAM);
    let theirs = vw.grant_strategy(&other, &actor.pubkey(), 0, caps(1, 1, 1, 0));
    let mut mismatched = vw.w.h.vault_place_for_ix(&actor.pubkey(), &owner.pubkey(), theirs, &win, buy(0, 700, 1_000));
    mismatched.accounts[2].pubkey = agari_events_tests::vault_ix::grant_address(id);
    assert_eq!(vw.h().vault_send(&[mismatched], &[&actor]).refused(), NO_SUCH_GRANT);
    assert_eq!(vw.place_for(&actor, &other, id, &win, buy(0, 700, 1_000)).refused(), NOT_GRANT_OWNER, "never another owner's balance");

    let (e, one_fill) = vw.place_for_paid(&sponsor, &actor, &owner, id, &win, buy(0, 700, 50_000)).expect("sponsored tap");
    assert_eq!((e.cash_delta, e.lots_delta, e.grant_id, e.actor, e.owner), (30 * ONE, 50_000, id, actor.pubkey(), owner.pubkey()));
    let g = vw.grant(id);
    assert_eq!((g.budget, g.open_positions, g.spent_today), (170 * ONE, 1, 30 * ONE));
    assert_eq!(vw.account(&owner.pubkey()).available, DEPOSIT - 200 * ONE, "the owner's free balance is untouched");
    assert_eq!((vw.slot(&owner, &win).yes_lots, vw.slot(&owner, &win).yes_grant), (50_000, id), "the position is the owner's");

    // Ten maker orders, one tap: the 10-fill cost.
    vw.maker_cancel_all(&win);
    for _ in 0..10 {
        vw.maker_rest(&win, BUY_NO, 600, 1_000);
    }
    let (ten, ten_fills) = vw.place_for_paid(&sponsor, &actor, &owner, id, &win, buy(0, 700, 10_000)).expect("10 fills");
    assert_eq!((ten.fills, ten.cash_delta), (10, 6 * ONE));
    report("actor_place_for sponsored (2 sigs), 1 fill", one_fill);
    report("actor_place_for sponsored (2 sigs), 10 fills", ten_fills);
}

#[test]
fn revoked_and_expired_grants_stop_and_caps_revert_the_whole_fill() {
    let mut vw = VaultWorld::new();
    let (owner, win) = (vw.owner(DEPOSIT), vw.win);
    let actor = vw.key();
    vw.liquidity(0, DEEP);
    let now = vw.h().now();
    let g = GrantArgs { grant_id: 1, kind: STRATEGY, actor: actor.pubkey(), caps: caps(10 * ONE, 100 * ONE, 5, 0), expires_at_sec: now + 30, budget: 200 * ONE };
    let ix = vw.h().vault_grant_ix(&owner.pubkey(), g, None);
    vw.h().ok(&[ix], &[&owner.key]);
    assert_eq!(vw.place_for(&actor, &owner, 1, &win, buy(0, 700, 50_000)).refused(), OVER_STAKE_CAP, "30 > 10 on the actual charge");
    assert_eq!((vw.grant(1).budget, vw.slot(&owner, &win).yes_lots), (200 * ONE, 0));
    vw.place_for(&actor, &owner, 1, &win, buy(0, 700, 10_000)).expect("6 ≤ 10");
    vw.h().warp_to(now + 30);
    vw.place_for(&actor, &owner, 1, &win, buy(0, 700, 1_000)).expect("equality is live");
    vw.h().warp_to(now + 31);
    assert_eq!(vw.place_for(&actor, &owner, 1, &win, buy(0, 700, 1_000)).refused(), GRANT_EXPIRED);
    vw.h().warp_to(now + 20);
    let revoke = vw.h().vault_revoke_ix(&owner.pubkey(), 1);
    vw.h().ok(&[revoke], &[&owner.key]);
    assert_eq!(vw.place_for(&actor, &owner, 1, &win, sell(0, 500, 1_000)).refused(), GRANT_IS_REVOKED, "sells too");
}

#[test]
fn the_daily_cap_buckets_by_utc_day() {
    let mut vw = VaultWorld::new();
    let (owner, win) = (vw.owner(DEPOSIT), vw.win);
    let actor = vw.key();
    let id = vw.grant_strategy(&owner, &actor.pubkey(), 500 * ONE, caps(50 * ONE, 50 * ONE, 9, 0));
    vw.liquidity(0, DEEP);
    vw.place_for(&actor, &owner, id, &win, buy(0, 700, 50_000)).expect("30");
    assert_eq!(vw.place_for(&actor, &owner, id, &win, buy(0, 700, 50_000)).refused(), OVER_DAILY_CAP, "30 + 30 > 50");
    // The next Window opens at 00:00 UTC: a new day.
    let next = vw.open_window(1, MIDNIGHT);
    vw.liquidity_on(&next, 0, DEEP);
    vw.place_for(&actor, &owner, id, &next, buy(0, 700, 50_000)).expect("a new UTC day");
    let g = vw.grant(id);
    assert_eq!((g.spent_today, g.spent_day, g.open_positions), (30 * ONE, (MIDNIGHT / 86_400) as u64, 2));
}

#[test]
fn position_and_price_caps_and_the_budget_ceiling() {
    let mut vw = VaultWorld::new();
    let (owner, win) = (vw.owner(DEPOSIT), vw.win);
    let actor = vw.key();
    let id = vw.grant_strategy(&owner, &actor.pubkey(), 500 * ONE, caps(50 * ONE, 500 * ONE, 1, 0));
    vw.liquidity(0, DEEP);
    vw.place_for(&actor, &owner, id, &win, buy(0, 700, 10_000)).expect("opens YES");
    vw.place_for(&actor, &owner, id, &win, buy(0, 700, 10_000)).expect("same position, not a new one");
    vw.liquidity(1, DEEP);
    assert_eq!(vw.place_for(&actor, &owner, id, &win, buy(1, 500, 10_000)).refused(), OVER_POSITION_CAP);

    // Replace it with a price-capped grant (650 own-side ticks).
    let priced = vw.grant_strategy(&owner, &actor.pubkey(), 20 * ONE, caps(50 * ONE, 500 * ONE, 9, 650));
    vw.liquidity(0, DEEP);
    assert_eq!(vw.place_for(&actor, &owner, priced, &win, buy(0, 700, 10_000)).refused(), OVER_PRICE_CAP);
    assert_eq!(vw.place_for(&actor, &owner, priced, &win, buy(1, 300, 10_000)).refused(), OVER_PRICE_CAP, "YES 0.30 is NO at 0.70");
    // Refused up front at the escrow the book would take (50 × 0.60 NO), not at the 0.40 fill.
    vw.liquidity(1, DEEP);
    assert_eq!(vw.place_for(&actor, &owner, priced, &win, buy(1, 400, 50_000)).refused(), INSUFFICIENT, "budget 20 < escrow 30");
    let (e, _) = vw.place_for(&actor, &owner, priced, &win, buy(1, 400, 10_000)).expect("NO at 0.60 limit, under the cap");
    assert_eq!((e.lots_delta, e.cash_delta), (10_000, 4 * ONE));
    assert_eq!(vw.slot(&owner, &win).no_grant, priced, "a side the replaced grant never opened");
}

#[test]
fn sale_proceeds_go_to_the_owner_never_back_to_the_budget() {
    let mut vw = VaultWorld::new();
    let (owner, win) = (vw.owner(DEPOSIT), vw.win);
    let actor = vw.key();
    let id = vw.grant_strategy(&owner, &actor.pubkey(), 200 * ONE, caps(50 * ONE, 100 * ONE, 5, 0));
    vw.liquidity(0, DEEP);
    vw.place_for(&actor, &owner, id, &win, buy(0, 700, 50_000)).expect("buy");
    vw.liquidity(1, DEEP);
    let (s, _) = vw.place_for(&actor, &owner, id, &win, sell(0, 500, 50_000)).expect("sell");
    assert_eq!((s.is_buy, s.cash_delta), (false, 30 * ONE));
    assert_eq!(vw.grant(id).budget, 170 * ONE, "budget only ever goes down");
    assert_eq!(vw.account(&owner.pubkey()).available, DEPOSIT - 200 * ONE + 30 * ONE);
    let slot = vw.slot(&owner, &win);
    assert_eq!((slot.yes_lots, slot.yes_grant), (0, id), "the attribution stays until the crank");
}

#[test]
fn a_stranger_cranks_a_winner_into_the_owners_balance_and_a_loser_pays_zero() {
    let mut vw = VaultWorld::new();
    let (owner, win) = (vw.owner(DEPOSIT), vw.win);
    let (actor, stranger) = (vw.key(), vw.key());
    let id = vw.grant_strategy(&owner, &actor.pubkey(), 200 * ONE, caps(50 * ONE, 100 * ONE, 5, 0));
    vw.liquidity(0, DEEP);
    vw.place_for(&actor, &owner, id, &win, buy(0, 700, 50_000)).expect("YES through the grant");
    vw.liquidity(1, DEEP);
    vw.place(&owner, &win, buy(1, 500, 10_000)).expect("NO attended");
    assert_eq!(vw.crank(&stranger, &owner, &win, Some(id), None).refused(), MARKET_NOT_SETTLED);

    vw.resolve(&win, Outcome::Up);
    assert_eq!(vw.crank(&stranger, &owner, &win, None, None).refused(), GRANT_ACCOUNT_MISSING);
    let other = vw.grant_strategy(&owner, &actor.pubkey(), 0, caps(1, 1, 1, 0));
    assert_eq!(vw.crank(&stranger, &owner, &win, Some(other), None).refused(), GRANT_ACCOUNT_MISSING, "a different grant");
    let (settled, sent) = vw.crank(&stranger, &owner, &win, Some(id), None).expect("crank");
    assert_eq!((settled.payout, settled.yes_redeemed, settled.no_redeemed, settled.by), (50 * ONE, 50_000, 10_000, stranger.pubkey()));
    assert_eq!(vw.account(&owner.pubkey()).available, DEPOSIT - 200 * ONE - 4 * ONE + 50 * ONE + 170 * ONE, "the replaced grant's budget came back too");
    assert_eq!((vw.grant(id).open_positions, vw.account(&owner.pubkey()).slots_used), (0, 0));
    assert_eq!(vw.crank(&stranger, &owner, &win, Some(id), None).refused(), NOTHING_TO_SETTLE);
    report("public_crank_settle, both sides", sent);
}

#[test]
fn a_void_pays_half_to_both_sides_and_the_ledger_closes_after_the_last_crank() {
    let mut vw = VaultWorld::new();
    let (owner, win) = (vw.owner(DEPOSIT), vw.win);
    let stranger = vw.key();
    vw.liquidity(0, DEEP);
    vw.place(&owner, &win, buy(0, 700, 100_000)).expect("YES");
    vw.liquidity(1, DEEP);
    vw.place(&owner, &win, buy(1, 500, 100_000)).expect("NO");
    vw.resolve(&win, Outcome::Void);
    let (maker, maker_token) = (vw.maker.0.insecure_clone(), vw.maker.1);
    let sweep = vw.w.h.sweep_ix(&win, 32);
    vw.h().ok(&[sweep], &[&stranger]);
    let seat = vw.seat_of(&win, &maker.pubkey()).unwrap();
    let redeem = vw.w.h.redeem_ix(&win, &maker.pubkey(), &maker_token, seat, None, None);
    vw.h().ok(&[redeem], &[&maker]);
    let (treasury, rent_payer) = (vw.w.h.treasury, agari_events_tests::harness::key(1).pubkey());
    let close = vw.w.h.close_ledger_ix(&win, &treasury, &rent_payer);
    assert_eq!(vw.h().send(&[close.clone()], &[&stranger]).refused(), LEDGER_NOT_EMPTY, "the vault seat still holds the owner's lots");

    let (settled, _) = vw.crank(&stranger, &owner, &win, None, None).expect("crank");
    assert_eq!(settled.payout, 100 * ONE);
    assert_eq!(vw.account(&owner.pubkey()).available, DEPOSIT - 60 * ONE - 40 * ONE + 100 * ONE);
    assert_eq!(vw.crank(&stranger, &owner, &win, None, None).refused(), NOTHING_TO_SETTLE);
    vw.h().send(&[close], &[&stranger]).expect("the Ledger closes once the vault seat is drained");
    assert!(!ledger_open(&vw, &win));
}

#[test]
fn ad5_a_leaked_grant_key_opens_in_cap_positions_for_the_owner_and_nothing_else() {
    let mut vw = VaultWorld::new();
    let (owner, win) = (vw.owner(DEPOSIT), vw.win);
    let actor = vw.owner(0);
    let stranger = vw.key();
    let id = vw.grant_strategy(&owner, &actor.pubkey(), 200 * ONE, caps(50 * ONE, 100 * ONE, 5, 0));
    vw.liquidity(0, DEEP);
    vw.place_for(&actor.key, &owner, id, &win, buy(0, 700, 50_000)).expect("buy");
    vw.liquidity(1, DEEP);
    vw.place_for(&actor.key, &owner, id, &win, sell(0, 500, 20_000)).expect("sell");
    let withdraw = vw.w.h.vault_withdraw_ix(&actor.pubkey(), &actor.ata, 1, false);
    assert_eq!(vw.h().send(&[withdraw], &[&actor.key]).refused(), INSUFFICIENT, "the actor has no balance of its own");
    let fund = vw.w.h.vault_fund_grant_ix(&actor.pubkey(), id, 1);
    assert_eq!(vw.h().send(&[fund], &[&actor.key]).refused(), NOT_GRANT_OWNER);
    // Naming the owner's account and custody while the actor signs fails the PDA seeds.
    let mut divert = vw.w.h.vault_withdraw_ix(&owner.pubkey(), &actor.ata, 1, false);
    divert.accounts[0] = anchor_lang::solana_program::instruction::AccountMeta::new_readonly(actor.pubkey(), true);
    assert_eq!(vw.h().send(&[divert], &[&actor.key]).refused(), CONSTRAINT_SEEDS);

    vw.resolve(&win, Outcome::Up);
    vw.crank(&stranger, &owner, &win, Some(id), None).expect("crank");
    assert_eq!(vw.w.h.token_amount(&actor.ata), 10_000 * ONE, "the actor never receives collateral");
    let (spent, proceeds, payout) = (30 * ONE, 12 * ONE, 30 * ONE);
    assert_eq!(vw.account(&owner.pubkey()).available + vw.grant(id).budget, DEPOSIT - spent + proceeds + payout);
}

#[test]
fn a_window_listed_before_the_vault_registered_is_refused_until_the_next_one() {
    let mut vw = VaultWorld::build(MIDNIGHT - 300, false);
    let (owner, win) = (vw.owner(DEPOSIT), vw.win);
    vw.liquidity(0, DEEP);
    let refused = |vw: &mut VaultWorld| {
        let ix = vw.w.h.vault_place_ix(&owner.pubkey(), &win, buy(0, 700, 1_000));
        vw.h().vault_send(&[ix], &[&owner.key]).refused()
    };
    assert_eq!(refused(&mut vw), VAULT_NOT_REGISTERED);
    let keys = agari_events_tests::prints::print_keys();
    vw.h().register_vault_seat(&keys);
    assert_eq!(refused(&mut vw), WINDOW_PREDATES_VAULT, "seat 0 of this Ledger isn't the vault's PROGRAM seat");
    assert_eq!(vw.account(&owner.pubkey()).available, DEPOSIT);

    let next = vw.open_window(1, MIDNIGHT);
    vw.liquidity_on(&next, 0, DEEP);
    let (e, _) = vw.place(&owner, &next, buy(0, 700, 1_000)).expect("the next Window pre-allocates the vault seat");
    assert_eq!(e.lots_delta, 1_000);
}
