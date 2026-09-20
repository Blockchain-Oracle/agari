use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::constants::{CUSTODY_SEED, EVENTS_CONFIG, EVENTS_EVENT_AUTHORITY, POSITION_SEED, RESERVE_SEED, SEAT_SEED, WINDOW_SEED};
use crate::engine::{redeem, resolve, Engine};
use crate::errors::LeverageError;
use crate::events::{Claimed, Exited};
use crate::instructions::payout::{pay_or_owe, Payer};
use crate::state::{LeverageReserve, Position, PositionStatus, WindowBook};

#[derive(Accounts)]
pub struct PublicSettle<'info> {
    /// Permissionless: a settlement never pays its caller.
    pub caller: Signer<'info>,
    #[account(mut, seeds = [RESERVE_SEED], bump = reserve.bump)]
    pub reserve: Box<Account<'info, LeverageReserve>>,
    #[account(mut, seeds = [POSITION_SEED, &position.position_id.to_le_bytes()], bump = position.bump)]
    pub position: Box<Account<'info, Position>>,
    #[account(mut, seeds = [WINDOW_SEED, market.key().as_ref()], bump = window.bump)]
    pub window: Box<Account<'info, WindowBook>>,
    #[account(mut, seeds = [CUSTODY_SEED], bump = reserve.custody_bump)]
    pub custody: Box<InterfaceAccount<'info, TokenAccount>>,
    /// CHECK: the reserve's engine seat.
    #[account(seeds = [SEAT_SEED], bump = reserve.seat_bump)]
    pub seat: UncheckedAccount<'info>,
    /// Where the owner's part goes. Optional: without it the money waits for `public_claim`.
    #[account(mut, token::mint = collateral_mint, token::authority = position.owner)]
    pub owner_token: Option<Box<InterfaceAccount<'info, TokenAccount>>>,
    /// CHECK: agari-events itself.
    #[account(address = agari_events::ID @ LeverageError::UnknownMarket)]
    pub events_program: UncheckedAccount<'info>,
    /// CHECK: the venue's config, at its own address.
    #[account(address = EVENTS_CONFIG @ LeverageError::UnknownMarket)]
    pub events_config: UncheckedAccount<'info>,
    /// CHECK: bound to the market by `resolve`.
    pub series: UncheckedAccount<'info>,
    /// CHECK: the position's own Window.
    #[account(mut, address = position.market @ LeverageError::UnknownMarket)]
    pub market: UncheckedAccount<'info>,
    /// CHECK: bound to the market both ways.
    #[account(mut)]
    pub ledger: UncheckedAccount<'info>,
    /// CHECK: must be `market.mvault`.
    #[account(mut)]
    pub mvault: UncheckedAccount<'info>,
    #[account(address = reserve.collateral_mint @ LeverageError::WrongCollateral)]
    pub collateral_mint: Box<InterfaceAccount<'info, Mint>>,
    pub token_program: Interface<'info, TokenInterface>,
    /// CHECK: agari-events' event authority.
    #[account(address = EVENTS_EVENT_AUTHORITY @ LeverageError::UnknownMarket)]
    pub events_event_authority: UncheckedAccount<'info>,
}

/// Settles a position whose Window the venue has resolved or voided: redeems exactly this position's contracts out
/// of the seat's pooled holdings, repays the reserve first and sends the rest to the owner.
pub fn public_settle(ctx: Context<PublicSettle>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    require!(ctx.accounts.position.status == PositionStatus::Live, LeverageError::NotLive);

    let a = &ctx.accounts;
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
    let w = resolve(&e, &a.reserve.collateral_mint)?;
    require!(w.is_settled(), LeverageError::MarketNotSettled);

    let (seat_bump, lots, position_id) = (a.reserve.seat_bump, a.position.lots, a.position.position_id);
    let before = a.custody.amount;
    redeem(&e, seat_bump, w.seat_index, a.position.outcome, lots)?;
    // The engine pays the redemption into custody; what arrived is the payout, whatever the print or a void made it.
    ctx.accounts.custody.reload()?;
    let payout_base = ctx.accounts.custody.amount.saturating_sub(before);

    let a = ctx.accounts;
    let split = a.reserve.book_exit(&mut a.position, &mut a.window, PositionStatus::Settled, lots, payout_base, now);
    let payer = Payer { custody: &a.custody, seat: &a.seat.to_account_info(), mint: &a.collateral_mint, token_program: &a.token_program.to_account_info(), seat_bump };
    let owed_base = pay_or_owe(&payer, &mut a.reserve, &mut a.position, a.owner_token.as_deref(), split.returned_base)?;

    emit!(Exited {
        position: a.position.key(),
        position_id,
        owner: a.position.owner,
        status: a.position.status,
        lots_sold: lots,
        proceeds_base: payout_base,
        reclaimed_base: split.reclaimed_base,
        returned_base: split.returned_base,
        owed_base,
        by: a.caller.key(),
    });
    Ok(())
}

#[derive(Accounts)]
pub struct PublicClaim<'info> {
    /// Permissionless to call; the money only ever goes to `position.owner` (AD-5).
    pub caller: Signer<'info>,
    #[account(mut, seeds = [RESERVE_SEED], bump = reserve.bump)]
    pub reserve: Box<Account<'info, LeverageReserve>>,
    #[account(mut, seeds = [POSITION_SEED, &position.position_id.to_le_bytes()], bump = position.bump)]
    pub position: Box<Account<'info, Position>>,
    #[account(mut, seeds = [CUSTODY_SEED], bump = reserve.custody_bump)]
    pub custody: Box<InterfaceAccount<'info, TokenAccount>>,
    /// CHECK: the reserve's seat, which is custody's authority.
    #[account(seeds = [SEAT_SEED], bump = reserve.seat_bump)]
    pub seat: UncheckedAccount<'info>,
    #[account(mut, token::mint = collateral_mint, token::authority = position.owner)]
    pub owner_token: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(address = reserve.collateral_mint @ LeverageError::WrongCollateral)]
    pub collateral_mint: Box<InterfaceAccount<'info, Mint>>,
    pub token_program: Interface<'info, TokenInterface>,
}

/// Pays what an exit left owed because it was not handed the owner's token account.
pub fn public_claim(ctx: Context<PublicClaim>) -> Result<()> {
    let a = ctx.accounts;
    require!(a.position.owed_base > 0, LeverageError::NothingOwed);
    // The books are closed before the money moves, so there is no moment at which it could be paid twice.
    let paid_base = a.reserve.book_claim(&mut a.position);
    let payer = Payer { custody: &a.custody, seat: &a.seat.to_account_info(), mint: &a.collateral_mint, token_program: &a.token_program.to_account_info(), seat_bump: a.reserve.seat_bump };
    payer.pay(&a.owner_token.to_account_info(), paid_base)?;
    emit!(Claimed { position: a.position.key(), position_id: a.position.position_id, owner: a.position.owner, paid_base });
    Ok(())
}
