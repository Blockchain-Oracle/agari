//! Funding and grants on LiteSVM (vault.md §3.2–3.3), ported from Masayume `EventVault.funding.t.sol:9-114`: the round
//! trip, over-withdraw, zero amounts, the private bucket, a grant replacing the previous one budget-first, expiry and
//! actor refusals, revoke (owner only, expired too), funding a live grant only, and deposit-and-grant as one
//! instruction under one signature. The ERC-2771 cases have no Solana counterpart (the sponsor only pays fees).

use agari_events_tests::harness::Sent;
use agari_events_tests::vault::{caps, check_invariants, compute_limit_ix, event, Owner, VaultWorld, ONE, SESSION, STRATEGY};
use agari_events_tests::vault_ix::{account_address, grant_address, GrantArgs};
use agari_vault::events::{Deposited, GrantRevoked, Withdrawn};
use anchor_lang::prelude::Pubkey;
use anchor_lang::solana_program::system_instruction;
use anchor_spl::associated_token::spl_associated_token_account::instruction::create_associated_token_account_idempotent;
use anchor_spl::token::spl_token;
use solana_signer::Signer;

const DEPOSIT: u64 = 1_000 * ONE;
const ZERO_AMOUNT: u32 = 7000;
const INSUFFICIENT: u32 = 7001;
const WRONG_TOKEN_OWNER: u32 = 7003;
const NOT_GRANT_OWNER: u32 = 7102;
const GRANT_IS_REVOKED: u32 = 7103;
const GRANT_EXPIRED: u32 = 7104;
const BAD_EXPIRY: u32 = 7105;
const ZERO_ACTOR: u32 = 7106;
const BAD_GRANT_KIND: u32 = 7107;
const ACTIVE_GRANT_MISMATCH: u32 = 7113;
const STALE_GRANT_ID: u32 = 7114;

fn available(vw: &VaultWorld, owner: &Owner) -> u64 {
    vw.account(&owner.pubkey()).available
}

fn send(vw: &mut VaultWorld, owner: &Owner, ix: anchor_lang::solana_program::instruction::Instruction) -> Result<Vec<Vec<u8>>, u32> {
    vw.h().vault_send(&[ix], &[&owner.key]).map(|(_, events)| events)
}

#[test]
fn deposit_withdraw_round_trip() {
    let mut vw = VaultWorld::new();
    let owner = vw.owner(0);
    let deposit = vw.h().vault_deposit_ix(&owner.pubkey(), &owner.ata, DEPOSIT);
    let events = send(&mut vw, &owner, deposit).expect("deposit");
    let d: Deposited = event(&events).unwrap();
    assert_eq!((d.owner, d.amount, d.available), (owner.pubkey(), DEPOSIT, DEPOSIT));

    let withdraw = vw.h().vault_withdraw_ix(&owner.pubkey(), &owner.ata, 400 * ONE, false);
    let w: Withdrawn = event(&send(&mut vw, &owner, withdraw).expect("withdraw")).unwrap();
    assert_eq!((w.amount, w.available), (400 * ONE, 600 * ONE));
    let a = vw.account(&owner.pubkey());
    assert_eq!((a.available, a.total_deposited, a.total_withdrawn), (600 * ONE, DEPOSIT, 400 * ONE));
    assert_eq!(vw.w.h.token_amount(&owner.ata), 10_000 * ONE - 600 * ONE);
    check_invariants(&vw, &vw.win.clone(), &[&owner]);
}

#[test]
fn withdraw_refuses_more_than_available_zero_amounts_and_every_destination_but_the_owners_ata() {
    let mut vw = VaultWorld::new();
    let owner = vw.owner(DEPOSIT);
    let other = vw.wallet();
    let over = vw.h().vault_withdraw_ix(&owner.pubkey(), &owner.ata, DEPOSIT + 1, false);
    assert_eq!(send(&mut vw, &owner, over).unwrap_err(), INSUFFICIENT);
    let zero_deposit = vw.h().vault_deposit_ix(&owner.pubkey(), &owner.ata, 0);
    assert_eq!(send(&mut vw, &owner, zero_deposit).unwrap_err(), ZERO_AMOUNT);
    let zero_withdraw = vw.h().vault_withdraw_ix(&owner.pubkey(), &owner.ata, 0, false);
    assert_eq!(send(&mut vw, &owner, zero_withdraw).unwrap_err(), ZERO_AMOUNT);

    // AD-5: a token account the owner owns that isn't its ATA, and someone else's ATA, are both refused.
    let (mint, key) = (vw.w.h.mint, vw.w.h.fresh_key());
    vw.w.h.create_token_account(&key, &mint, &owner.pubkey());
    let not_ata = vw.h().vault_withdraw_ix(&owner.pubkey(), &key.pubkey(), ONE, false);
    assert_eq!(send(&mut vw, &owner, not_ata).unwrap_err(), WRONG_TOKEN_OWNER);
    let theirs = vw.h().vault_withdraw_ix(&owner.pubkey(), &other.ata, ONE, false);
    assert_eq!(send(&mut vw, &owner, theirs).unwrap_err(), WRONG_TOKEN_OWNER);
    assert_eq!(available(&vw, &owner), DEPOSIT);
}

#[test]
fn private_bucket() {
    let mut vw = VaultWorld::new();
    let owner = vw.owner(DEPOSIT);
    let mv = vw.h().vault_move_private_ix(&owner.pubkey(), 300 * ONE);
    send(&mut vw, &owner, mv).expect("move to private");
    let a = vw.account(&owner.pubkey());
    assert_eq!((a.available, a.private_available), (700 * ONE, 300 * ONE));
    let over = vw.h().vault_withdraw_ix(&owner.pubkey(), &owner.ata, 300 * ONE + 1, true);
    assert_eq!(send(&mut vw, &owner, over).unwrap_err(), INSUFFICIENT);
    let out = vw.h().vault_withdraw_ix(&owner.pubkey(), &owner.ata, 300 * ONE, true);
    send(&mut vw, &owner, out).expect("withdraw private");
    assert_eq!(vw.account(&owner.pubkey()).private_available, 0);
    assert_eq!(vw.w.h.token_amount(&owner.ata), 10_000 * ONE - 700 * ONE);
    check_invariants(&vw, &vw.win.clone(), &[&owner]);
}

#[test]
fn a_grant_moves_budget_and_replaces_the_previous_one_budget_first() {
    let mut vw = VaultWorld::new();
    let owner = vw.owner(DEPOSIT);
    let actor = vw.key().pubkey();
    let first = vw.grant_strategy(&owner, &actor, 200 * ONE, caps(10 * ONE, 100 * ONE, 5, 0));
    assert_eq!((first, available(&vw, &owner)), (1, 800 * ONE));

    let now = vw.h().now();
    let next = GrantArgs { grant_id: 2, kind: STRATEGY, actor, caps: caps(10 * ONE, 100 * ONE, 5, 0), expires_at_sec: now + 86_400, budget: 300 * ONE };
    let without_previous = vw.h().vault_grant_ix(&owner.pubkey(), next, None);
    assert_eq!(send(&mut vw, &owner, without_previous).unwrap_err(), ACTIVE_GRANT_MISMATCH);
    let future_id = vw.h().vault_grant_ix(&owner.pubkey(), GrantArgs { grant_id: 3, ..next }, Some(first));
    assert_eq!(send(&mut vw, &owner, future_id).unwrap_err(), STALE_GRANT_ID);

    let replace = vw.h().vault_grant_ix(&owner.pubkey(), next, Some(first));
    let events = send(&mut vw, &owner, replace).expect("replace");
    let revoked: GrantRevoked = event(&events).unwrap();
    assert_eq!((revoked.grant_id, revoked.returned), (first, 200 * ONE));
    assert_eq!((vw.grant(first).revoked, vw.grant(first).budget), (1, 0));
    assert_eq!(available(&vw, &owner), 700 * ONE, "old budget returned before the new one is taken");
    assert_eq!(vw.account(&owner.pubkey()).active_grants[usize::from(STRATEGY)], 2);

    // An id already taken is stale, refused by name before anything is allocated.
    let taken = vw.h().vault_grant_ix(&owner.pubkey(), GrantArgs { grant_id: first, kind: SESSION, ..next }, None);
    assert_eq!(send(&mut vw, &owner, taken).unwrap_err(), STALE_GRANT_ID);
    check_invariants(&vw, &vw.win.clone(), &[&owner]);
}

#[test]
fn grant_refuses_past_expiry_zero_actor_and_unknown_kind() {
    let mut vw = VaultWorld::new();
    let owner = vw.owner(DEPOSIT);
    let actor = vw.key().pubkey();
    let now = vw.h().now();
    let base = GrantArgs { grant_id: 1, kind: SESSION, actor, caps: caps(1, 1, 1, 0), expires_at_sec: now + 1, budget: 0 };
    for (g, code) in [
        (GrantArgs { expires_at_sec: now, ..base }, BAD_EXPIRY),
        (GrantArgs { actor: Pubkey::default(), ..base }, ZERO_ACTOR),
        (GrantArgs { kind: 3, ..base }, BAD_GRANT_KIND),
        (GrantArgs { budget: DEPOSIT + 1, ..base }, INSUFFICIENT),
    ] {
        let ix = vw.h().vault_grant_ix(&owner.pubkey(), g, None);
        assert_eq!(send(&mut vw, &owner, ix).unwrap_err(), code);
    }
    let ok = vw.h().vault_grant_ix(&owner.pubkey(), base, None);
    send(&mut vw, &owner, ok).expect("a zero-budget grant expiring next second is valid");
}

#[test]
fn revoke_returns_the_budget_only_for_the_owner_and_works_on_expired_grants() {
    let mut vw = VaultWorld::new();
    let owner = vw.owner(DEPOSIT);
    let stranger = vw.owner(0);
    let actor = vw.key().pubkey();
    let id = vw.grant_strategy(&owner, &actor, 200 * ONE, caps(10 * ONE, 100 * ONE, 5, 0));
    let theirs = vw.h().vault_revoke_ix(&stranger.pubkey(), id);
    assert_eq!(send(&mut vw, &stranger, theirs).unwrap_err(), NOT_GRANT_OWNER);

    // Expired grants still revoke: the only way their budget comes back.
    let later = vw.h().now() + 2 * 86_400;
    vw.h().warp_to(later);
    let revoke = vw.h().vault_revoke_ix(&owner.pubkey(), id);
    let events = send(&mut vw, &owner, revoke.clone()).expect("revoke");
    assert_eq!(event::<GrantRevoked>(&events).map(|e| e.returned), Some(200 * ONE));
    assert_eq!((available(&vw, &owner), vw.grant(id).revoked), (DEPOSIT, 1));
    assert_eq!(vw.account(&owner.pubkey()).active_grants[usize::from(STRATEGY)], 0);
    let again = send(&mut vw, &owner, revoke).expect("a second revoke succeeds");
    assert!(event::<GrantRevoked>(&again).is_none(), "and changes nothing");
    assert_eq!(available(&vw, &owner), DEPOSIT);
}

#[test]
fn fund_grant_tops_up_a_live_grant_only() {
    let mut vw = VaultWorld::new();
    let owner = vw.owner(DEPOSIT);
    let actor = vw.key().pubkey();
    let id = vw.grant_strategy(&owner, &actor, 100 * ONE, caps(10 * ONE, 100 * ONE, 5, 0));
    let fund = vw.h().vault_fund_grant_ix(&owner.pubkey(), id, 50 * ONE);
    send(&mut vw, &owner, fund).expect("fund");
    assert_eq!((vw.grant(id).budget, available(&vw, &owner)), (150 * ONE, 850 * ONE));
    let zero = vw.h().vault_fund_grant_ix(&owner.pubkey(), id, 0);
    assert_eq!(send(&mut vw, &owner, zero).unwrap_err(), ZERO_AMOUNT);
    let over = vw.h().vault_fund_grant_ix(&owner.pubkey(), id, 850 * ONE + 1);
    assert_eq!(send(&mut vw, &owner, over).unwrap_err(), INSUFFICIENT);
    check_invariants(&vw, &vw.win.clone(), &[&owner]);

    let now = vw.h().now();
    vw.h().warp_to(now + 2 * 86_400);
    let expired = vw.h().vault_fund_grant_ix(&owner.pubkey(), id, 1);
    assert_eq!(send(&mut vw, &owner, expired).unwrap_err(), GRANT_EXPIRED);
    vw.h().warp_to(now);
    let revoke = vw.h().vault_revoke_ix(&owner.pubkey(), id);
    send(&mut vw, &owner, revoke).expect("revoke");
    let revoked = vw.h().vault_fund_grant_ix(&owner.pubkey(), id, 1);
    assert_eq!(send(&mut vw, &owner, revoked).unwrap_err(), GRANT_IS_REVOKED);
}

#[test]
fn deposit_and_grant_is_one_instruction_and_the_enable_is_one_signature() {
    let mut vw = VaultWorld::new();
    // A wallet with no Trading Balance yet: open, key top-up and deposit-and-grant in one transaction it alone signs.
    let wallet = vw.wallet();
    let key = vw.h().fresh_key().pubkey();
    let now = vw.h().now();
    let g = GrantArgs { grant_id: 1, kind: SESSION, actor: key, caps: caps(5 * ONE, 50 * ONE, 3, 950), expires_at_sec: now + 3_600, budget: 200 * ONE };
    let ixs = [
        compute_limit_ix(200_000),
        system_instruction::transfer(&wallet.pubkey(), &key, 10_000_000),
        vw.w.h.vault_open_ix(&wallet.pubkey()),
        vw.w.h.vault_deposit_and_grant_ix(&wallet.pubkey(), &wallet.ata, 500 * ONE, g, None),
    ];
    let (enable, _) = vw.h().vault_send(&ixs, &[&wallet.key]).expect("enable");
    assert_eq!(available(&vw, &wallet), 300 * ONE);
    let grant = vw.grant(1);
    assert_eq!((grant.budget, grant.kind, grant.actor, grant.owner), (200 * ONE, SESSION, key, wallet.pubkey()));
    assert_eq!(vw.account(&wallet.pubkey()).active_grants[usize::from(SESSION)], 1);
    assert_eq!(vw.w.h.account_data(&grant_address(1)).len(), 176);
    assert_eq!(vw.w.h.account_data(&account_address(&wallet.pubkey())).len(), 1_160);
    check_invariants(&vw, &vw.win.clone(), &[&wallet]);

    // Withdraw with the idempotent ATA create the adapter prepends.
    let ixs = [
        create_associated_token_account_idempotent(&wallet.pubkey(), &wallet.pubkey(), &vw.w.h.mint, &spl_token::ID),
        vw.w.h.vault_withdraw_ix(&wallet.pubkey(), &wallet.ata, 100 * ONE, false),
    ];
    let (withdraw, _) = vw.h().vault_send(&ixs, &[&wallet.key]).expect("withdraw");
    report("enable: CU limit + top-up + open + deposit_and_grant", enable);
    report("owner_withdraw + idempotent ATA", withdraw);
}

fn report(label: &str, sent: Sent) {
    println!("{label}: {} CU / {} B (v0)", sent.compute_units, sent.tx_bytes);
}
