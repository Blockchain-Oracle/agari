use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::constants::{CUSTODY_SEED, SEAT_SEED, VAULT_SEED, WINDOW_SEED};
use crate::engine::{merge_complete_set, redeem, resolve, Engine};
use crate::errors::MakerError;
use crate::events::{Merged, WindowSettled};
use crate::state::{MakerVault, WindowBook};

/// Both cranks touch the same accounts; neither pays its caller, so neither needs to know who called it.
#[derive(Accounts)]
pub struct Crank<'info> {
    pub cranker: Signer<'info>,
    #[account(mut, seeds = [VAULT_SEED], bump = vault.bump)]
    pub vault: Account<'info, MakerVault>,
    #[account(mut, seeds = [WINDOW_SEED, market.key().as_ref()], bump = book_record.bump)]
    pub book_record: Account<'info, WindowBook>,
    #[account(mut, seeds = [CUSTODY_SEED], bump = vault.custody_bump)]
    pub custody: InterfaceAccount<'info, TokenAccount>,
    /// CHECK: the vault's engine seat; it signs the CPI.
    #[account(seeds = [SEAT_SEED], bump = vault.seat_bump)]
    pub seat: UncheckedAccount<'info>,
    /// CHECK: checked against the vault's recorded program.
    #[account(address = vault.events_program @ MakerError::UnknownMarket)]
    pub events_program: UncheckedAccount<'info>,
    /// CHECK: checked against the vault's recorded venue.
    #[account(address = vault.venue_config @ MakerError::UnknownMarket)]
    pub events_config: UncheckedAccount<'info>,
    /// CHECK: bound to the market by `resolve`.
    pub series: UncheckedAccount<'info>,
    /// CHECK: an agari-events Market.
    #[account(mut)]
    pub market: UncheckedAccount<'info>,
    /// CHECK: bound to the market both ways.
    #[account(mut)]
    pub ledger: UncheckedAccount<'info>,
    /// CHECK: must be `market.mvault`.
    #[account(mut)]
    pub mvault: UncheckedAccount<'info>,
    #[account(address = vault.collateral_mint @ MakerError::WrongCollateral)]
    pub collateral_mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
    /// CHECK: agari-events' event authority.
    pub events_event_authority: UncheckedAccount<'info>,
}

fn engine_of<'info>(a: &Crank<'info>) -> Engine<'info> {
    Engine {
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
    }
}

/// Turn the vault's matched YES and NO back into collateral.
///
/// Quoting both sides of a Window produces both halves of a complete set, and a complete set is worth exactly its
/// cash unit whatever the print says. Merging is therefore free money back into custody rather than a bet carried
/// to settlement, and anyone may crank it because it can only ever reduce the vault's exposure.
pub fn public_merge(ctx: Context<Crank>, lots: u64) -> Result<()> {
    require!(lots > 0, MakerError::ZeroAmount);
    require!(!ctx.accounts.book_record.settled, MakerError::AlreadySettled);
    let window = resolve(&engine_of(&ctx.accounts), &ctx.accounts.vault.collateral_mint, None)?;

    let before = ctx.accounts.custody.amount;
    merge_complete_set(&engine_of(&ctx.accounts), ctx.accounts.vault.seat_bump, window.seat_index, lots)?;
    ctx.accounts.custody.reload()?;
    let returned = ctx.accounts.custody.amount.saturating_sub(before);

    let record = &mut ctx.accounts.book_record;
    record.merged_base = record.merged_base.checked_add(returned).ok_or(MakerError::MathOverflow)?;
    let vault = &mut ctx.accounts.vault;
    vault.deployed_base = vault.deployed_base.saturating_sub(returned);

    emit!(Merged { vault: vault.key(), market: record.market, lots, merged_base: returned });
    Ok(())
}

/// Redeem the vault's seat on a Window the venue has resolved or voided, and close the book on it.
///
/// `realized_base` is the signed result: what came back against what went out. It is recorded once, when the
/// Window is settled, so a provider reading the vault's history sees a per-Window profit and loss rather than one
/// running number they have to take on trust.
pub fn public_settle(ctx: Context<Crank>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    require!(!ctx.accounts.book_record.settled, MakerError::AlreadySettled);
    let window = resolve(&engine_of(&ctx.accounts), &ctx.accounts.vault.collateral_mint, None)?;
    require!(window.is_settled(), MakerError::WindowNotSettled);

    let before = ctx.accounts.custody.amount;
    redeem(&engine_of(&ctx.accounts), ctx.accounts.vault.seat_bump, window.seat_index)?;
    ctx.accounts.custody.reload()?;
    let returned = ctx.accounts.custody.amount.saturating_sub(before);

    let record = &mut ctx.accounts.book_record;
    record.payout_base = record.payout_base.checked_add(returned).ok_or(MakerError::MathOverflow)?;
    record.settled_at_sec = now;
    record.settled = true;
    // Whatever the venue still shows against this Window is gone with it: the seat has been emptied.
    let stranded = record.deployed_base();
    let realized = i64::try_from(record.escrow_back_base.saturating_add(record.merged_base).saturating_add(record.payout_base))
        .unwrap_or(i64::MAX)
        .saturating_sub(i64::try_from(record.escrow_out_base).unwrap_or(i64::MAX));

    let vault = &mut ctx.accounts.vault;
    vault.deployed_base = vault.deployed_base.saturating_sub(returned).saturating_sub(stranded);
    vault.open_windows = vault.open_windows.saturating_sub(1);

    emit!(WindowSettled { vault: vault.key(), market: record.market, payout_base: returned, realized_base: realized });
    Ok(())
}
