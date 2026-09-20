use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::constants::{CUSTODY_SEED, EVENTS_CONFIG, EVENTS_EVENT_AUTHORITY, IOC_LIFE_SEC, POSITION_SEED, RESERVE_SEED, SEAT_SEED, WINDOW_SEED};
use crate::engine::{ioc_args, place, read_levels, resolve, yes_ticks, Depth, Engine};
use crate::errors::LeverageError;
use crate::events::Exited;
use crate::instructions::payout::{pay_or_owe, Payer};
use crate::math::{is_knockable, mark_over};
use crate::state::{LeverageReserve, Position, PositionStatus, WindowBook};

/// The owner's cash-out and the knock-out are one sale with two different gates, so they share their accounts.
#[derive(Accounts)]
pub struct SellPosition<'info> {
    /// The owner for a close; anyone for a knock-out, which never pays its caller.
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
    pub book: UncheckedAccount<'info>,
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

enum Gate {
    /// The owner sells into whatever rests, with their own floor on what it fetches.
    Close { min_proceeds_base: u64 },
    /// Anyone sells, once the rested book says the position is under its line.
    KnockOut,
}

/// The owner's cash-out: sells what the book will take at its resting bids, repays the reserve first and sends the
/// rest to the owner. A partial sale leaves the position live with fewer contracts and a smaller claim.
pub fn owner_close(ctx: Context<SellPosition>, min_proceeds_base: u64) -> Result<()> {
    require_keys_eq!(ctx.accounts.caller.key(), ctx.accounts.position.owner, LeverageError::NotOwner);
    sell(ctx, Gate::Close { min_proceeds_base })
}

/// The knock-out anyone may trigger once the mark has fallen to the maintenance line.
///
/// The mark is what orders that have already rested would pay for the whole position. An order placed a moment
/// ago cannot move it, and a book too thin to take the whole position cannot justify a knock-out at all: without
/// that, anyone could knock out a healthy position in the seconds after the maker requotes, when little has rested.
/// The sale's limit is the last rested level that walk touched, so a fresh lowball bid is never what it sells into.
pub fn public_knock_out(ctx: Context<SellPosition>) -> Result<()> {
    sell(ctx, Gate::KnockOut)
}

fn sell(ctx: Context<SellPosition>, gate: Gate) -> Result<()> {
    let clock = Clock::get()?;
    let (now, slot) = (clock.unix_timestamp, clock.slot);
    require!(ctx.accounts.position.status == PositionStatus::Live, LeverageError::NotLive);
    let params = ctx.accounts.reserve.params;

    let e = engine_of(ctx.accounts);
    let w = resolve(&e, &ctx.accounts.reserve.collateral_mint)?;
    require!(w.is_trading(now), LeverageError::WindowNotTrading);

    let (outcome, lots, position_id) = (ctx.accounts.position.outcome, ctx.accounts.position.lots, ctx.accounts.position.position_id);
    let quantity_raw = ctx.accounts.position.quantity_raw();
    let depth = if matches!(gate, Gate::KnockOut) { Depth::Rested } else { Depth::Resting };
    let exit = read_levels(&e, &w, outcome, true, depth, now, slot)?;
    let (mark, walk) = mark_over(&exit, outcome == 1, w.one(), quantity_raw);
    if matches!(gate, Gate::KnockOut) {
        require!(walk.filled_raw >= quantity_raw, LeverageError::ThinBook);
        require!(is_knockable(mark, u128::from(ctx.accounts.position.fronted_base), params.maintenance_bps), LeverageError::StillHealthy);
    }
    require!(walk.filled_raw > 0, LeverageError::NothingFilled);

    let seat_bump = ctx.accounts.reserve.seat_bump;
    let expire_ts = w.lock_at.min(now.saturating_add(IOC_LIFE_SEC));
    let custody_before = ctx.accounts.custody.amount;
    let sold = place(&e, seat_bump, ioc_args(&w, outcome, false, yes_ticks(walk.limit_yes_raw, &w)?, lots, expire_ts, position_id))?;
    require!(sold.filled_lots > 0, LeverageError::NothingFilled);
    // The engine's report is checked against the money: a sale pays exactly its proceeds into custody and pulls nothing.
    let proceeds_base = sold.cash_received;
    ctx.accounts.custody.reload()?;
    require!(
        sold.transferred_in == 0 && sold.withdrawn == proceeds_base && ctx.accounts.custody.amount.checked_sub(custody_before) == Some(proceeds_base),
        LeverageError::EngineAccountingMismatch
    );
    let ended_as = match gate {
        Gate::Close { min_proceeds_base } => {
            require!(proceeds_base >= min_proceeds_base, LeverageError::Slippage);
            PositionStatus::Closed
        }
        Gate::KnockOut => PositionStatus::KnockedOut,
    };

    let a = ctx.accounts;
    let split = a.reserve.book_exit(&mut a.position, &mut a.window, ended_as, sold.filled_lots, proceeds_base, now);
    let payer = Payer { custody: &a.custody, seat: &a.seat.to_account_info(), mint: &a.collateral_mint, token_program: &a.token_program.to_account_info(), seat_bump };
    let owed_base = pay_or_owe(&payer, &mut a.reserve, &mut a.position, a.owner_token.as_deref(), split.returned_base)?;

    emit!(Exited {
        position: a.position.key(),
        position_id,
        owner: a.position.owner,
        status: a.position.status,
        lots_sold: sold.filled_lots,
        proceeds_base,
        reclaimed_base: split.reclaimed_base,
        returned_base: split.returned_base,
        owed_base,
        by: a.caller.key(),
    });
    Ok(())
}

fn engine_of<'info>(a: &SellPosition<'info>) -> Engine<'info> {
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
