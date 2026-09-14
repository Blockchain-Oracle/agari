//! `public_settle_window` and `public_void_expired` (prints.md §5–6; events-instructions.md §5.1). Permissionless:
//! the caller pays the `MarketResult` rent and gets it back when the Market closes (PD-7).

use anchor_lang::prelude::*;
use core::mem::size_of;

use agari_common::seeds::RESULT_SEED;

use super::print_rules::window_version;
use super::resolve_rules::{settle_decision, void_decision, Resolution};
use crate::errors::EventsError;
use crate::events::{PrintData, WindowResolved};
use crate::state::{Market, MarketResult, Series, MARKET_FLAG_SINGLE_SOURCE};

#[event_cpi]
#[derive(Accounts)]
pub struct PublicResolveWindow<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub series: AccountLoader<'info, Series>,
    #[account(mut)]
    pub market: AccountLoader<'info, Market>,
    #[account(init, payer = payer, space = 8 + size_of::<MarketResult>(), seeds = [RESULT_SEED, market.key().as_ref()], bump)]
    pub result: AccountLoader<'info, MarketResult>,
    pub system_program: Program<'info, System>,
}

pub fn public_settle_window(ctx: Context<PublicResolveWindow>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let event = resolve(&ctx, now, |market, series| settle_decision(market, &window_version(series, market)?, now))?;
    emit_cpi!(event);
    Ok(())
}

pub fn public_void_expired(ctx: Context<PublicResolveWindow>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let event = resolve(&ctx, now, |market, _| void_decision(market, now))?;
    emit_cpi!(event);
    Ok(())
}

/// Step 1 (binding, not terminal), the decision, then the effects: Market state and payouts, `MarketResult`, `seq`.
fn resolve(ctx: &Context<PublicResolveWindow>, now: i64, decide: impl FnOnce(&Market, &Series) -> Result<Resolution>) -> Result<WindowResolved> {
    let a = &ctx.accounts;
    let series = a.series.load()?;
    let mut market = a.market.load_mut()?;
    require_keys_eq!(market.series, a.series.key(), EventsError::SeriesMarketMismatch);
    require!(!market.is_terminal(), EventsError::MarketAlreadyTerminal);
    let r = decide(&market, &series)?;
    drop(series);

    market.state = u8::from(r.state);
    market.payout_yes = r.payout_yes;
    market.payout_no = r.payout_no;
    market.void_reason = u8::from(r.void_reason);
    market.resolved_ts = now;
    if r.single_source {
        market.flags |= MARKET_FLAG_SINGLE_SOURCE;
    }
    let seq = market.next_seq().ok_or(error!(EventsError::MathOverflow))?;

    let mut result = a.result.load_init()?;
    result.market = a.market.key();
    result.series = market.series;
    result.rent_payer = a.payer.key();
    result.open = market.open;
    result.close = market.close;
    result.check_open = market.check_open;
    result.check_close = market.check_close;
    result.resolved_ts = now;
    result.payout_yes = r.payout_yes;
    result.payout_no = r.payout_no;
    result.policy_version = market.policy_version;
    result.void_reason = u8::from(r.void_reason);
    result.single_source = u8::from(r.single_source);
    result.winner = u8::from(r.winner);
    result.bump = ctx.bumps.result;

    Ok(WindowResolved {
        market: a.market.key(),
        seq,
        state: market.state,
        winner: u8::from(r.winner),
        payout_yes: r.payout_yes,
        payout_no: r.payout_no,
        void_reason: market.void_reason,
        single_source: r.single_source,
        open: PrintData::from(&market.open),
        close: PrintData::from(&market.close),
        check_open: PrintData::from(&market.check_open),
        check_close: PrintData::from(&market.check_close),
        resolved_ts: now,
    })
}
