//! The desk's open: three transactions, never fewer. `desk_charge_to_pool` names the owner and an opaque key.
//! `desk_fund_slot` names the slot. `desk_mint_in_slot` names the slot and the market. The pool between the first
//! and the second is what keeps an owner and a slot out of the same transaction, the same account and the same log.

use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use agari_common::stake_walk::{walk_budget, walk_quantity};

use crate::constants::{BUDGET_SEED, CHARGE_SEED, CUSTODY_SEED, DESK_SEED, EVENTS_CONFIG, EVENTS_EVENT_AUTHORITY, IOC_LIFE_SEC, SEAT_SEED, SLOT_SEED};
use crate::engine::{ioc_buy_args, place, read_entry_levels, resolve, yes_ticks, Engine};
use crate::errors::PrivateError;
use crate::events::{Charged, SlotFunded, SlotMinted};
use crate::state::{Budget, Desk, KeyMark, Slot};

#[derive(Accounts)]
#[instruction(amount_base: u64, charge_key: [u8; 32])]
pub struct DeskChargeToPool<'info> {
    #[account(mut)]
    pub desk: Signer<'info>,
    #[account(mut, seeds = [DESK_SEED], bump = desk_account.bump, has_one = desk @ PrivateError::NotDesk)]
    pub desk_account: Box<Account<'info, Desk>>,
    /// CHECK: the bettor. Named here and on the credit, and nowhere a slot is.
    pub owner: UncheckedAccount<'info>,
    #[account(mut, seeds = [BUDGET_SEED, owner.key().as_ref()], bump = budget.bump)]
    pub budget: Box<Account<'info, Budget>>,
    /// One per key. `init_if_needed` so a used key is refused as `KeyUsed` and not as a system error.
    #[account(init_if_needed, payer = desk, space = 8 + KeyMark::INIT_SPACE, seeds = [CHARGE_SEED, owner.key().as_ref(), charge_key.as_ref()], bump)]
    pub mark: Box<Account<'info, KeyMark>>,
    pub system_program: Program<'info, System>,
}

/// OWNER SIDE. Debits the bettor into the pool's float. Names them, and nothing else.
///
/// `charge_key` is opaque to the chain and single-use: the desk derives it from a secret it shares with the owner, so
/// a resumed open can tell a landed charge from a lost one without keeping a record.
pub fn desk_charge_to_pool(ctx: Context<DeskChargeToPool>, amount_base: u64, charge_key: [u8; 32]) -> Result<()> {
    let a = &mut *ctx.accounts;
    a.mark.bump = ctx.bumps.mark;
    a.desk_account.book_charge(&mut a.budget, &mut a.mark, amount_base)?;
    emit!(Charged { owner: a.owner.key(), charge_key, amount_base });
    Ok(())
}

#[derive(Accounts)]
#[instruction(slot_id: [u8; 32])]
pub struct DeskFundSlot<'info> {
    #[account(mut)]
    pub desk: Signer<'info>,
    #[account(mut, seeds = [DESK_SEED], bump = desk_account.bump, has_one = desk @ PrivateError::NotDesk)]
    pub desk_account: Box<Account<'info, Desk>>,
    #[account(init_if_needed, payer = desk, space = 8 + Slot::INIT_SPACE, seeds = [SLOT_SEED, slot_id.as_ref()], bump)]
    pub slot: Box<Account<'info, Slot>>,
    pub system_program: Program<'info, System>,
}

/// SLOT SIDE. Float into this bet's slot. Carries no owner.
pub fn desk_fund_slot(ctx: Context<DeskFundSlot>, slot_id: [u8; 32], amount_base: u64) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let a = &mut *ctx.accounts;
    a.slot.slot_id = slot_id;
    a.slot.bump = ctx.bumps.slot;
    a.desk_account.book_fund(&mut a.slot, amount_base, now)?;
    emit!(SlotFunded { slot_id, amount_base });
    Ok(())
}

#[derive(Accounts)]
#[instruction(slot_id: [u8; 32])]
pub struct DeskMintInSlot<'info> {
    pub desk: Signer<'info>,
    #[account(mut, seeds = [DESK_SEED], bump = desk_account.bump, has_one = desk @ PrivateError::NotDesk)]
    pub desk_account: Box<Account<'info, Desk>>,
    #[account(mut, seeds = [SLOT_SEED, slot_id.as_ref()], bump = slot.bump)]
    pub slot: Box<Account<'info, Slot>>,
    #[account(mut, seeds = [CUSTODY_SEED], bump = desk_account.custody_bump)]
    pub custody: Box<InterfaceAccount<'info, TokenAccount>>,
    /// CHECK: the desk's engine seat.
    #[account(seeds = [SEAT_SEED], bump = desk_account.seat_bump)]
    pub seat: UncheckedAccount<'info>,
    /// CHECK: agari-events itself.
    #[account(address = agari_events::ID @ PrivateError::UnknownMarket)]
    pub events_program: UncheckedAccount<'info>,
    /// CHECK: the venue's config, at its own address.
    #[account(address = EVENTS_CONFIG @ PrivateError::UnknownMarket)]
    pub events_config: UncheckedAccount<'info>,
    /// CHECK: bound to the market by `resolve`.
    pub series: UncheckedAccount<'info>,
    /// CHECK: bound both ways to its Book and Ledger by `resolve`.
    #[account(mut)]
    pub market: UncheckedAccount<'info>,
    /// CHECK: bound to the market both ways.
    #[account(mut)]
    pub book: UncheckedAccount<'info>,
    /// CHECK: bound to the market both ways.
    #[account(mut)]
    pub ledger: UncheckedAccount<'info>,
    /// CHECK: must be `market.mvault`.
    #[account(mut)]
    pub mvault: UncheckedAccount<'info>,
    #[account(address = desk_account.collateral_mint @ PrivateError::WrongCollateral)]
    pub collateral_mint: Box<InterfaceAccount<'info, Mint>>,
    pub token_program: Interface<'info, TokenInterface>,
    /// CHECK: agari-events' event authority.
    #[account(address = EVENTS_EVENT_AUTHORITY @ PrivateError::UnknownMarket)]
    pub events_event_authority: UncheckedAccount<'info>,
}

/// SLOT SIDE. Buys the side off the live book with what the slot holds: sized at execution to the stake, never
/// charged more than it, the dust left in the slot. `min_lots` is the owner's guard against a book that moved since
/// the quote. No owner account exists on this instruction.
pub fn desk_mint_in_slot(ctx: Context<DeskMintInSlot>, slot_id: [u8; 32], outcome: u8, min_lots: u64) -> Result<()> {
    let clock = Clock::get()?;
    let (now, chain_slot) = (clock.unix_timestamp, clock.slot);
    require!(outcome <= 1, PrivateError::BadOutcome);
    let stake_base = ctx.accounts.desk_account.mintable_stake(&ctx.accounts.slot)?;
    let params = ctx.accounts.desk_account.params;
    require!(stake_base >= params.min_stake_base && stake_base <= params.max_stake_base, PrivateError::StakeOutsideBand);

    let e = engine_of(ctx.accounts);
    let w = resolve(&e, &ctx.accounts.desk_account.collateral_mint)?;
    require!(w.is_trading(now), PrivateError::WindowNotTrading);
    require!(w.expiry.saturating_sub(now) >= i64::from(params.min_time_left_sec), PrivateError::TooLate);

    let (one, invert, lot_base) = (w.one(), outcome == 1, u128::from(w.lot_base));
    let entry = read_entry_levels(&e, &w, outcome, now, chain_slot)?;
    let quantity_raw = walk_budget(&entry, invert, one, u128::from(stake_base), lot_base);
    let least_lots = w.min_lots.max(min_lots).max(1);
    require!(quantity_raw >= u128::from(least_lots) * lot_base, PrivateError::BelowMinQuantity);
    let walk = walk_quantity(&entry, invert, one, quantity_raw);

    let seat_bump = ctx.accounts.desk_account.seat_bump;
    let lots = u64::try_from(quantity_raw / lot_base).map_err(|_| PrivateError::MathOverflow)?;
    let expire_ts = w.lock_at.min(now.saturating_add(IOC_LIFE_SEC));
    let custody_before = ctx.accounts.custody.amount;
    // The slot id's first eight bytes ride along as the order's client id: a label for the desk's own logs, and no owner.
    let client_id = u64::from_le_bytes(slot_id[..8].try_into().map_err(|_| PrivateError::MathOverflow)?);
    let filled = place(&e, seat_bump, ioc_buy_args(&w, outcome, yes_ticks(walk.limit_yes_raw, &w)?, lots, expire_ts, client_id))?;
    let got = filled.filled_lots;
    require!(got > 0, PrivateError::NothingFilled);
    require!(got >= least_lots, PrivateError::BelowMinQuantity);

    // The engine's report is checked against the money: a buy pulls exactly its cost out of custody and pays nothing in.
    let cost_base = filled.cash_spent;
    ctx.accounts.custody.reload()?;
    require!(
        filled.transferred_in == cost_base && filled.withdrawn == 0 && custody_before.checked_sub(ctx.accounts.custody.amount) == Some(cost_base),
        PrivateError::EngineAccountingMismatch
    );

    let market = ctx.accounts.market.key();
    let a = &mut *ctx.accounts;
    // A fill can only cost the walk's price or less; anything on top would land here and is refused.
    a.desk_account.book_mint(&mut a.slot, market, outcome, got, w.lot_base, cost_base, w.expiry, now)?;
    emit!(SlotMinted { slot_id, market, outcome, lots: got, cost_base });
    Ok(())
}

fn engine_of<'info>(a: &DeskMintInSlot<'info>) -> Engine<'info> {
    Engine {
        program: a.events_program.to_account_info(),
        config: a.events_config.to_account_info(),
        series: a.series.to_account_info(),
        market: a.market.to_account_info(),
        book: Some(a.book.to_account_info()),
        ledger: a.ledger.to_account_info(),
        mvault: a.mvault.to_account_info(),
        mint: a.collateral_mint.to_account_info(),
        token_program: a.token_program.to_account_info(),
        event_authority: a.events_event_authority.to_account_info(),
        seat: a.seat.to_account_info(),
        custody: a.custody.to_account_info(),
    }
}
