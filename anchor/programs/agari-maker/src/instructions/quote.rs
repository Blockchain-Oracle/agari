use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::constants::{BPS, CUSTODY_SEED, SEAT_SEED, VAULT_SEED, WINDOW_SEED};
use crate::engine::{cancel_all, place, quote_args, resolve, Engine};
use crate::errors::MakerError;
use crate::events::{Pulled, Quoted};
use crate::state::{MakerVault, WindowBook};

/// The engine's order kinds.
///
/// A two-sided YES market without YES inventory is a BUY_YES at the bid and a BUY_NO at the ask. The book is one
/// YES-denominated ladder — `Kind::is_bid` puts BUY_YES on the bid side and BUY_NO on the ask side — so a BUY_NO
/// carries the *YES* price it is offering at, not its own complement. Sending the complement offers YES at
/// `1000 − ask` instead of `ask`, which is an offer to sell at the wrong end of the book entirely: post-only
/// refuses it as a cross, and a taker would have filled it at a price the vault never meant.
const KIND_BUY_YES: u8 = 0;
const KIND_BUY_NO: u8 = 2;

#[derive(Accounts)]
pub struct MakerQuote<'info> {
    #[account(mut)]
    pub maker: Signer<'info>,
    #[account(mut, seeds = [VAULT_SEED], bump = vault.bump, constraint = vault.maker == maker.key() @ MakerError::NotMaker)]
    pub vault: Account<'info, MakerVault>,
    #[account(
        init_if_needed,
        payer = maker,
        space = 8 + WindowBook::INIT_SPACE,
        seeds = [WINDOW_SEED, market.key().as_ref()],
        bump,
    )]
    pub book_record: Account<'info, WindowBook>,
    #[account(mut, seeds = [CUSTODY_SEED], bump = vault.custody_bump)]
    pub custody: InterfaceAccount<'info, TokenAccount>,
    /// CHECK: the vault's engine seat; it signs the CPI.
    #[account(seeds = [SEAT_SEED], bump = vault.seat_bump)]
    pub seat: UncheckedAccount<'info>,
    /// CHECK: agari-events, checked against the vault's recorded program.
    #[account(address = vault.events_program @ MakerError::UnknownMarket)]
    pub events_program: UncheckedAccount<'info>,
    /// CHECK: the venue's GlobalConfig, checked against the vault's recorded venue.
    #[account(address = vault.venue_config @ MakerError::UnknownMarket)]
    pub events_config: UncheckedAccount<'info>,
    /// CHECK: bound to the market by `resolve`.
    pub series: UncheckedAccount<'info>,
    /// CHECK: an agari-events Market, read with `load_checked`.
    #[account(mut)]
    pub market: UncheckedAccount<'info>,
    /// CHECK: bound to the market both ways.
    #[account(mut)]
    pub venue_book: UncheckedAccount<'info>,
    /// CHECK: bound to the market both ways; the vault's seat is checked in it.
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
    pub system_program: Program<'info, System>,
}

fn engine_of<'info>(a: &MakerQuote<'info>) -> Engine<'info> {
    Engine {
        program: a.events_program.to_account_info(),
        config: a.events_config.to_account_info(),
        series: a.series.to_account_info(),
        market: a.market.to_account_info(),
        book: Some(a.venue_book.to_account_info()),
        ledger: a.ledger.to_account_info(),
        mvault: a.mvault.to_account_info(),
        mint: a.collateral_mint.to_account_info(),
        token_program: a.token_program.to_account_info(),
        event_authority: a.events_event_authority.to_account_info(),
        seat: a.seat.to_account_info(),
        custody: a.custody.to_account_info(),
    }
}

/// Rest one two-sided quote on a Window.
///
/// Every limit is checked before the first order goes out, because the two legs are one quote: a vault that
/// placed the bid and then refused the ask would be one-sided on providers' money until someone noticed.
pub fn maker_quote(ctx: Context<MakerQuote>, bid_ticks: u16, ask_ticks: u16, lots: u64, expire_ts: i64) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    require!(!ctx.accounts.vault.paused, MakerError::Paused);
    require!(lots > 0, MakerError::ZeroAmount);

    let params = ctx.accounts.vault.params;
    require!(lots <= params.max_quantity_lots, MakerError::QuantityTooLarge);
    require!(ask_ticks > bid_ticks, MakerError::SpreadTooTight);
    require!(u32::from(ask_ticks - bid_ticks) >= u32::from(params.min_spread_ticks), MakerError::SpreadTooTight);
    require!(bid_ticks >= params.min_price_ticks && ask_ticks <= params.max_price_ticks, MakerError::PriceOutOfBand);

    let window = resolve(&engine_of(&ctx.accounts), &ctx.accounts.vault.collateral_mint, Some(bid_ticks))?;
    require!(window.is_trading(now), MakerError::WindowNotTrading);
    require!(window.lock_at.saturating_sub(now) >= i64::from(params.min_time_left_sec), MakerError::TooLate);

    let first_quote = ctx.accounts.book_record.opened_at_sec == 0;
    if first_quote {
        require!(ctx.accounts.vault.open_windows < params.max_open_windows, MakerError::TooManyOpenWindows);
    }

    let custody_before = ctx.accounts.custody.amount;
    let total_before = ctx.accounts.vault.total_value_base(custody_before);

    // The bid buys YES at `bid_ticks`; the ask offers YES at `ask_ticks` as a BUY_NO on the ask side.
    let engine = engine_of(&ctx.accounts);
    let seat_bump = ctx.accounts.vault.seat_bump;
    let bid = place(&engine, seat_bump, quote_args(&window, KIND_BUY_YES, bid_ticks, lots, expire_ts, 0))?;
    let ask = place(&engine, seat_bump, quote_args(&window, KIND_BUY_NO, ask_ticks, lots, expire_ts, 1))?;

    let escrow_out = bid.transferred_in.checked_add(ask.transferred_in).ok_or(MakerError::MathOverflow)?;
    let escrow_back = bid.withdrawn.checked_add(ask.withdrawn).ok_or(MakerError::MathOverflow)?;

    let record = &mut ctx.accounts.book_record;
    record.vault = ctx.accounts.vault.key();
    record.market = ctx.accounts.market.key();
    record.bump = ctx.bumps.book_record;
    if first_quote {
        record.opened_at_sec = now;
    }
    record.escrow_out_base = record.escrow_out_base.checked_add(escrow_out).ok_or(MakerError::MathOverflow)?;
    record.escrow_back_base = record.escrow_back_base.checked_add(escrow_back).ok_or(MakerError::MathOverflow)?;
    record.quote_count = record.quote_count.saturating_add(1);
    let window_deployed = record.deployed_base();
    require!(window_deployed <= params.max_window_deployed_base, MakerError::WindowCapExceeded);

    let vault = &mut ctx.accounts.vault;
    if first_quote {
        vault.open_windows = vault.open_windows.saturating_add(1);
    }
    vault.deployed_base = vault
        .deployed_base
        .checked_add(escrow_out)
        .ok_or(MakerError::MathOverflow)?
        .saturating_sub(escrow_back);

    // Exposure is measured against the value the vault had before this quote: the money is the same money.
    let cap = u64::try_from((u128::from(total_before) * u128::from(params.max_exposure_bps)) / u128::from(BPS))
        .map_err(|_| MakerError::MathOverflow)?;
    require!(vault.deployed_base <= cap, MakerError::OverExposure);

    emit!(Quoted {
        vault: vault.key(),
        market: record.market,
        bid_ticks,
        ask_ticks,
        lots,
        escrow_out_base: escrow_out,
        deployed_base: vault.deployed_base,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct MakerPull<'info> {
    pub caller: Signer<'info>,
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
    pub venue_book: UncheckedAccount<'info>,
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

fn engine_of_pull<'info>(a: &MakerPull<'info>) -> Engine<'info> {
    Engine {
        program: a.events_program.to_account_info(),
        config: a.events_config.to_account_info(),
        series: a.series.to_account_info(),
        market: a.market.to_account_info(),
        book: Some(a.venue_book.to_account_info()),
        ledger: a.ledger.to_account_info(),
        mvault: a.mvault.to_account_info(),
        mint: a.collateral_mint.to_account_info(),
        token_program: a.token_program.to_account_info(),
        event_authority: a.events_event_authority.to_account_info(),
        seat: a.seat.to_account_info(),
        custody: a.custody.to_account_info(),
    }
}

/// Pull the vault's resting orders.
///
/// The maker may do this whenever; anyone may once the Window has locked, because after that a resting quote
/// serves nobody and the capital behind it should be back in custody where a provider can withdraw it.
pub fn maker_pull(ctx: Context<MakerPull>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let engine = engine_of_pull(&ctx.accounts);
    let window = resolve(&engine, &ctx.accounts.vault.collateral_mint, None)?;
    let is_maker = ctx.accounts.caller.key() == ctx.accounts.vault.maker;
    require!(is_maker || now >= window.lock_at, MakerError::NotMaker);

    let before = ctx.accounts.custody.amount;
    cancel_all(&engine, ctx.accounts.vault.seat_bump, window.seat_index)?;
    ctx.accounts.custody.reload()?;
    let returned = ctx.accounts.custody.amount.saturating_sub(before);

    let record = &mut ctx.accounts.book_record;
    record.escrow_back_base = record.escrow_back_base.checked_add(returned).ok_or(MakerError::MathOverflow)?;
    let vault = &mut ctx.accounts.vault;
    vault.deployed_base = vault.deployed_base.saturating_sub(returned);

    emit!(Pulled { vault: vault.key(), market: record.market, escrow_back_base: returned });
    Ok(())
}
