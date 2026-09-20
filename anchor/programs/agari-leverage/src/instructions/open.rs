use anchor_lang::prelude::*;
use anchor_spl::token::{transfer_checked, TransferChecked};
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::constants::{CUSTODY_SEED, EVENTS_CONFIG, EVENTS_EVENT_AUTHORITY, IOC_LIFE_SEC, LEVERAGE_ONE_BPS, POSITION_SEED, RESERVE_SEED, SEAT_SEED, WINDOW_SEED};
use crate::engine::{ioc_args, place, read_levels, resolve, yes_ticks, Depth, Engine};
use crate::errors::LeverageError;
use crate::events::Opened;
use crate::instructions::payout::Payer;
use crate::math::{budget_for, ceil_div, is_knockable, mark_over, side_price, terms, walk_budget, walk_quantity, win_if_right};
use crate::state::{LeverageReserve, Position, PositionStatus, WindowBook};

#[derive(Accounts)]
pub struct OwnerOpen<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut, seeds = [RESERVE_SEED], bump = reserve.bump)]
    pub reserve: Box<Account<'info, LeverageReserve>>,
    #[account(init, payer = owner, space = 8 + Position::INIT_SPACE, seeds = [POSITION_SEED, &reserve.next_position_id.to_le_bytes()], bump)]
    pub position: Box<Account<'info, Position>>,
    /// What the reserve has out on this Window. Created the first time a boost is opened there.
    #[account(init_if_needed, payer = owner, space = 8 + WindowBook::INIT_SPACE, seeds = [WINDOW_SEED, market.key().as_ref()], bump)]
    pub window: Box<Account<'info, WindowBook>>,
    #[account(mut, seeds = [CUSTODY_SEED], bump = reserve.custody_bump)]
    pub custody: Box<InterfaceAccount<'info, TokenAccount>>,
    /// CHECK: the reserve's engine seat; it signs the CPI and custody's transfers.
    #[account(seeds = [SEAT_SEED], bump = reserve.seat_bump)]
    pub seat: UncheckedAccount<'info>,
    #[account(mut, token::mint = collateral_mint, token::authority = owner)]
    pub owner_token: Box<InterfaceAccount<'info, TokenAccount>>,
    /// CHECK: agari-events itself.
    #[account(address = agari_events::ID @ LeverageError::UnknownMarket)]
    pub events_program: UncheckedAccount<'info>,
    /// CHECK: the venue's config, at its own address.
    #[account(address = EVENTS_CONFIG @ LeverageError::UnknownMarket)]
    pub events_config: UncheckedAccount<'info>,
    /// CHECK: bound to the market by `resolve`.
    pub series: UncheckedAccount<'info>,
    /// CHECK: an agari-events Market.
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
    #[account(address = reserve.collateral_mint @ LeverageError::WrongCollateral)]
    pub collateral_mint: Box<InterfaceAccount<'info, Mint>>,
    pub token_program: Interface<'info, TokenInterface>,
    /// CHECK: agari-events' event authority.
    #[account(address = EVENTS_EVENT_AUTHORITY @ LeverageError::UnknownMarket)]
    pub events_event_authority: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

/// Stakes `stake_base` on a side at `leverage_bps`.
///
/// The reserve sizes the boost off the live book at execution (what `stake + fronted − premium` buys, on the venue's
/// lot), buys it as an IOC taker and charges the stake the fill implies: never more than `stake_base`, and a cheaper
/// fill or the lot's dust comes straight back. `min_lots` is the owner's guard against a book that moved.
///
/// Two things the reference does not check. The position has to be sellable, whole, into orders that have already
/// rested, and at that price it has to stand above its knock-out line. Otherwise someone can sell themselves
/// overpriced contracts through the reserve: the seller side pockets the front, the position is born under water,
/// and a knock-out recovers a fraction of it.
pub fn owner_open(ctx: Context<OwnerOpen>, outcome: u8, stake_base: u64, leverage_bps: u32, min_lots: u64) -> Result<()> {
    let clock = Clock::get()?;
    let (now, slot) = (clock.unix_timestamp, clock.slot);
    let params = ctx.accounts.reserve.params;
    require!(!ctx.accounts.reserve.paused, LeverageError::Paused);
    require!(stake_base > 0, LeverageError::ZeroAmount);
    require!(outcome <= 1, LeverageError::BadOutcome);
    require!(leverage_bps > LEVERAGE_ONE_BPS && leverage_bps <= params.max_leverage_bps, LeverageError::BadLeverage);

    let e = engine_of(ctx.accounts);
    let w = resolve(&e, &ctx.accounts.reserve.collateral_mint)?;
    require!(w.is_trading(now), LeverageError::WindowNotTrading);
    require!(w.expiry.saturating_sub(now) >= i64::from(params.min_time_left_sec), LeverageError::TooLate);

    let (one, invert, lot_base) = (w.one(), outcome == 1, u128::from(w.lot_base));
    let entry = read_levels(&e, &w, outcome, false, Depth::Resting, now, slot)?;
    let exit_rested = read_levels(&e, &w, outcome, true, Depth::Rested, now, slot)?;

    let quantity_raw = walk_budget(&entry, invert, one, budget_for(u128::from(stake_base), leverage_bps, params.premium_bps), lot_base);
    let least_lots = w.min_lots.max(min_lots).max(1);
    require!(quantity_raw >= u128::from(least_lots) * lot_base, LeverageError::BelowMinQuantity);
    let walk = walk_quantity(&entry, invert, one, quantity_raw);
    require!(walk.filled_raw >= quantity_raw, LeverageError::ThinBook);
    let price_raw = ceil_div(walk.cost_base * one, quantity_raw);
    require!(price_raw >= u128::from(params.min_entry_price_raw) && price_raw <= u128::from(params.max_entry_price_raw), LeverageError::OutsideBand);
    let quoted = terms(walk.cost_base, leverage_bps, params.premium_bps);
    // A boost that could not beat the plain bet even when right is a fee, not a product.
    require!(win_if_right(quantity_raw, quoted.fronted_base) > quoted.stake_base, LeverageError::Underpriced);

    // The venue escrows the limit for the whole size up front; custody covers it beyond the stake.
    let escrow = ceil_div(quantity_raw * side_price(walk.limit_yes_raw, invert, one), one);
    let liquid_before = ctx.accounts.reserve.liquid_base(ctx.accounts.custody.amount);
    require!(u128::from(liquid_before) + u128::from(stake_base) >= escrow, LeverageError::InsufficientLiquidity);

    transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.owner_token.to_account_info(),
                mint: ctx.accounts.collateral_mint.to_account_info(),
                to: ctx.accounts.custody.to_account_info(),
                authority: ctx.accounts.owner.to_account_info(),
            },
        ),
        stake_base,
        ctx.accounts.collateral_mint.decimals,
    )?;

    let position_id = ctx.accounts.reserve.next_position_id;
    let seat_bump = ctx.accounts.reserve.seat_bump;
    let lots = u64::try_from(quantity_raw / lot_base).map_err(|_| LeverageError::MathOverflow)?;
    let expire_ts = w.lock_at.min(now.saturating_add(IOC_LIFE_SEC));
    let filled = place(&e, seat_bump, ioc_args(&w, outcome, true, yes_ticks(walk.limit_yes_raw, &w)?, lots, expire_ts, position_id))?;
    let got = filled.filled_lots;
    require!(got >= least_lots, LeverageError::BelowMinQuantity);

    // The engine's report is checked against the money: a buy pulls exactly its cost out of custody and pays nothing
    // in. If those ever disagree the books below would be built on a figure that is not true, so nothing is booked.
    let cost_base = filled.cash_spent;
    let custody_with_stake = ctx.accounts.custody.amount.checked_add(stake_base).ok_or(LeverageError::MathOverflow)?;
    ctx.accounts.custody.reload()?;
    require!(
        filled.transferred_in == cost_base && filled.withdrawn == 0 && custody_with_stake.checked_sub(ctx.accounts.custody.amount) == Some(cost_base),
        LeverageError::EngineAccountingMismatch
    );
    let t = terms(u128::from(cost_base), leverage_bps, params.premium_bps);
    let narrow = |v: u128| u64::try_from(v).map_err(|_| error!(LeverageError::MathOverflow));
    let (charged, fronted, premium) = (narrow(t.stake_base)?, narrow(t.fronted_base)?, narrow(t.premium_base)?);
    // A fill can only cost the walk's price or less; anything on top would land here and is refused.
    require!(charged <= stake_base, LeverageError::StakeAboveMax);

    let got_raw = u128::from(got) * lot_base;
    let (mark, exit_walk) = mark_over(&exit_rested, invert, one, got_raw);
    require!(exit_walk.filled_raw >= got_raw, LeverageError::ThinBook);
    require!(!is_knockable(mark, t.fronted_base, params.maintenance_bps), LeverageError::UnhealthyAtEntry);

    let payer = Payer {
        custody: &ctx.accounts.custody,
        seat: &ctx.accounts.seat.to_account_info(),
        mint: &ctx.accounts.collateral_mint,
        token_program: &ctx.accounts.token_program.to_account_info(),
        seat_bump,
    };
    payer.pay(&ctx.accounts.owner_token.to_account_info(), stake_base - charged)?;

    let market = ctx.accounts.market.key();
    let window = &mut ctx.accounts.window;
    window.market = market;
    window.bump = ctx.bumps.window;
    let reserve = &mut ctx.accounts.reserve;
    reserve.book_front(liquid_before, fronted, premium, window, position_id, w.expiry)?;
    reserve.next_position_id = position_id.checked_add(1).ok_or(LeverageError::MathOverflow)?;

    let owner = ctx.accounts.owner.key();
    let position = &mut ctx.accounts.position;
    position.owner = owner;
    position.market = market;
    position.position_id = position_id;
    position.status = PositionStatus::Live;
    position.outcome = outcome;
    position.leverage_bps = leverage_bps;
    position.opened_at_sec = now;
    position.expiry_sec = w.expiry;
    position.exited_at_sec = 0;
    position.lots = got;
    position.lot_base = w.lot_base;
    position.stake_base = charged;
    position.fronted_base = fronted;
    position.premium_base = premium;
    position.entry_price_raw = narrow(ceil_div(u128::from(cost_base) * one, got_raw))?;
    position.proceeds_base = 0;
    position.reclaimed_base = 0;
    position.returned_base = 0;
    position.owed_base = 0;
    position.bump = ctx.bumps.position;

    emit!(Opened { position: position.key(), position_id, owner, market, outcome, leverage_bps, lots: got, cost_base, stake_base: charged, fronted_base: fronted, premium_base: premium });
    Ok(())
}

fn engine_of<'info>(a: &OwnerOpen<'info>) -> Engine<'info> {
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
