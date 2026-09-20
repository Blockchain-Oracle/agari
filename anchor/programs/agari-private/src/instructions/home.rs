//! The way home is the open's split in reverse: `public_settle_slot` and `desk_sweep_slot_to_pool` name the slot,
//! `desk_credit_from_pool` names the owner and another opaque key. Only the owner's own `owner_withdraw` ever pays
//! out, and only to the signer.

use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::constants::{BUDGET_SEED, CREDIT_SEED, CUSTODY_SEED, DESK_SEED, EVENTS_CONFIG, EVENTS_EVENT_AUTHORITY, SEAT_SEED, SLOT_SEED};
use crate::engine::{redeem, resolve, Engine};
use crate::errors::PrivateError;
use crate::events::{Credited, SlotSettled, SlotSwept};
use crate::state::{Budget, Desk, KeyMark, Slot};

#[derive(Accounts)]
#[instruction(slot_id: [u8; 32])]
pub struct PublicSettleSlot<'info> {
    /// Permissionless: the proceeds stay in the slot whoever cranks it.
    pub caller: Signer<'info>,
    #[account(mut, seeds = [DESK_SEED], bump = desk_account.bump)]
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
    /// CHECK: the slot's own Window.
    #[account(mut, address = slot.market @ PrivateError::UnknownMarket)]
    pub market: UncheckedAccount<'info>,
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

/// Redeems a slot whose Window the venue has resolved or voided, into the slot. Exactly this slot's contracts come
/// out of the seat's pooled holdings, and what arrives in custody is the payout, whatever the print or a void made it.
pub fn public_settle_slot(ctx: Context<PublicSettleSlot>, slot_id: [u8; 32]) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let a = &ctx.accounts;
    require!(a.slot.lots > 0, PrivateError::NothingToSettle);
    let e = Engine {
        program: a.events_program.to_account_info(),
        config: a.events_config.to_account_info(),
        series: a.series.to_account_info(),
        market: a.market.to_account_info(),
        book: None,
        ledger: a.ledger.to_account_info(),
        mvault: a.mvault.to_account_info(),
        mint: a.collateral_mint.to_account_info(),
        token_program: a.token_program.to_account_info(),
        event_authority: a.events_event_authority.to_account_info(),
        seat: a.seat.to_account_info(),
        custody: a.custody.to_account_info(),
    };
    let w = resolve(&e, &a.desk_account.collateral_mint)?;
    require!(w.is_settled(), PrivateError::MarketNotSettled);

    let before = a.custody.amount;
    redeem(&e, a.desk_account.seat_bump, w.seat_index, a.slot.outcome, a.slot.lots)?;
    ctx.accounts.custody.reload()?;
    let payout_base = ctx.accounts.custody.amount.saturating_sub(before);

    let a = &mut *ctx.accounts;
    a.desk_account.book_settle(&mut a.slot, payout_base, now)?;
    emit!(SlotSettled { slot_id, market: a.slot.market, payout_base, by: a.caller.key() });
    Ok(())
}

#[derive(Accounts)]
#[instruction(slot_id: [u8; 32])]
pub struct DeskSweepSlot<'info> {
    pub desk: Signer<'info>,
    #[account(mut, seeds = [DESK_SEED], bump = desk_account.bump, has_one = desk @ PrivateError::NotDesk)]
    pub desk_account: Box<Account<'info, Desk>>,
    #[account(mut, seeds = [SLOT_SEED, slot_id.as_ref()], bump = slot.bump)]
    pub slot: Box<Account<'info, Slot>>,
}

/// SLOT SIDE. Whatever cash a slot holds (an unminted stake, the dust, a payout) back into the pool. Refused while
/// the slot still holds contracts: settle first.
pub fn desk_sweep_slot_to_pool(ctx: Context<DeskSweepSlot>, slot_id: [u8; 32]) -> Result<()> {
    let a = &mut *ctx.accounts;
    let amount_base = a.desk_account.book_sweep(&mut a.slot)?;
    emit!(SlotSwept { slot_id, amount_base });
    Ok(())
}

#[derive(Accounts)]
#[instruction(amount_base: u64, credit_key: [u8; 32])]
pub struct DeskCreditFromPool<'info> {
    #[account(mut)]
    pub desk: Signer<'info>,
    #[account(mut, seeds = [DESK_SEED], bump = desk_account.bump, has_one = desk @ PrivateError::NotDesk)]
    pub desk_account: Box<Account<'info, Desk>>,
    /// CHECK: the owner being credited. Named here and on the charge, and nowhere a slot is.
    pub owner: UncheckedAccount<'info>,
    /// An existing Budget only: a credit follows a charge, so the desk can credit nobody who never deposited.
    #[account(mut, seeds = [BUDGET_SEED, owner.key().as_ref()], bump = budget.bump)]
    pub budget: Box<Account<'info, Budget>>,
    #[account(init_if_needed, payer = desk, space = 8 + KeyMark::INIT_SPACE, seeds = [CREDIT_SEED, owner.key().as_ref(), credit_key.as_ref()], bump)]
    pub mark: Box<Account<'info, KeyMark>>,
    pub system_program: Program<'info, System>,
}

/// OWNER SIDE. Pool float into an owner's balance, ready for the next private bet or a withdrawal. Names the owner
/// and an opaque key, never a slot. Bounded by what the pool actually holds, and one credit per key.
pub fn desk_credit_from_pool(ctx: Context<DeskCreditFromPool>, amount_base: u64, credit_key: [u8; 32]) -> Result<()> {
    let a = &mut *ctx.accounts;
    a.mark.bump = ctx.bumps.mark;
    a.desk_account.book_credit(&mut a.budget, &mut a.mark, amount_base)?;
    emit!(Credited { owner: a.owner.key(), credit_key, amount_base });
    Ok(())
}
