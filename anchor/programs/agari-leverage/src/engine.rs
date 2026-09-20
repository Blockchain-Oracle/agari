//! The reserve's one seam to agari-events: the shared resolve, the book read, the IOC it buys and sells with, and
//! the partial redeem, all signed by the reserve's own seat PDA.
//!
//! Engine state is read with `load_checked` and copied out before any CPI, so no borrow is alive across one. Only
//! this file names engine types, which is what lets the CPI client be swapped in a single place. It is the same
//! seam `agari-vault` and `agari-maker` use: the engine reports what an order actually did in its `PlaceResult`,
//! so nothing here measures a balance before and after to find out.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::get_return_data;
use anchor_lang::Discriminator;

use agari_common::book_walk::{levels, NodeFilter, Side};
use agari_common::grid::{is_valid_price, PAIR_TICKS};
use agari_common::place_result::PlaceResult;
use agari_common::view::{bound_both_ways, load_checked, load_slice_checked};
use agari_events::book::walk::{walk_asks, walk_bids};
use agari_events::constants::{BOOK_FIXED_LEN, LEDGER_HEADER_LEN, SEAT_LEN};
use agari_events::instructions::PlaceOrderArgs;
use agari_events::state::{Book, GlobalConfig, Ledger, Market, MarketState, OrderNode, Seat, Series};

use crate::constants::{LEVELS, MAX_EVICTIONS, MAX_FILLS, ORDER_TYPE_IOC, SEAT_SEED, SELF_MATCH_CANCEL_TAKER};
use crate::errors::LeverageError;
use crate::math::YesLevel;

/// The engine accounts an instruction passes, plus the reserve's seat and custody.
pub struct Engine<'info> {
    pub program: AccountInfo<'info>,
    pub config: AccountInfo<'info>,
    pub series: AccountInfo<'info>,
    pub market: AccountInfo<'info>,
    /// Absent for settlement, which takes no Book.
    pub book: Option<AccountInfo<'info>>,
    pub ledger: AccountInfo<'info>,
    pub mvault: AccountInfo<'info>,
    pub mint: AccountInfo<'info>,
    pub token_program: AccountInfo<'info>,
    pub event_authority: AccountInfo<'info>,
    pub seat: AccountInfo<'info>,
    pub custody: AccountInfo<'info>,
}

/// What the reserve needs from a resolved Window, copied out of engine state.
#[derive(Clone, Copy, Debug)]
pub struct Window {
    pub seat_index: u16,
    pub tick_base: u64,
    pub lot_base: u64,
    pub min_lots: u64,
    pub min_rest_slots: u32,
    pub fills_cap: u8,
    pub evictions_cap: u8,
    pub state: u8,
    pub trading_start: i64,
    pub lock_at: i64,
    pub expiry: i64,
}

impl Window {
    pub fn is_trading(&self, now: i64) -> bool {
        self.state == u8::from(MarketState::Open) && self.trading_start <= now && now < self.lock_at
    }

    pub fn is_settled(&self) -> bool {
        self.state == u8::from(MarketState::Resolved) || self.state == u8::from(MarketState::Voided)
    }

    /// One whole unit of collateral: the scale of every price here. `tick_base × 1000` by the grid's own rule.
    pub fn one(&self) -> u128 {
        u128::from(self.tick_base) * u128::from(PAIR_TICKS)
    }
}

fn unknown<E>(_: E) -> Error {
    error!(LeverageError::UnknownMarket)
}

/// The bound Window, the engine's collateral, and the reserve's own PROGRAM seat.
///
/// The seat lookup is the security of the whole reserve: the engine only lets a registered `program_authorities`
/// entry hold a PROGRAM seat, so a look-alike account cannot stand in for the reserve and spend its custody.
pub fn resolve(e: &Engine, collateral_mint: &Pubkey) -> Result<Window> {
    let engine = &agari_events::ID;
    let market_key = e.market.key();
    let market = load_checked::<Market>(&e.market, engine).map_err(unknown)?;
    let series = load_checked::<Series>(&e.series, engine).map_err(unknown)?;
    require_keys_eq!(market.series, e.series.key(), LeverageError::UnknownMarket);
    let ledger = load_checked::<Ledger>(&e.ledger, engine).map_err(unknown)?;
    require!(bound_both_ways(&market_key, &market.ledger, &e.ledger.key(), &ledger.market), LeverageError::UnknownMarket);
    if let Some(book_info) = &e.book {
        let book = load_checked::<Book>(book_info, engine).map_err(unknown)?;
        require!(bound_both_ways(&market_key, &market.book, &book_info.key(), &book.market), LeverageError::UnknownMarket);
    }
    require_keys_eq!(market.mvault, e.mvault.key(), LeverageError::UnknownMarket);

    let config = load_checked::<GlobalConfig>(&e.config, engine).map_err(unknown)?;
    require_keys_eq!(config.collateral_mint, *collateral_mint, LeverageError::WrongCollateral);

    let seat_key = e.seat.key();
    let index = config.program_authorities.iter().position(|k| *k == seat_key).ok_or(LeverageError::ReserveNotRegistered)?;
    require!(index < usize::from(ledger.capacity), LeverageError::WindowPredatesReserve);
    let offset = SEAT_LEN.checked_mul(index).and_then(|o| o.checked_add(8 + LEDGER_HEADER_LEN)).ok_or(LeverageError::MathOverflow)?;
    let seat = load_slice_checked::<Seat>(&e.ledger, offset, 1).map_err(|_| error!(LeverageError::WindowPredatesReserve))?;
    require!(seat[0].owner == seat_key && seat[0].is_program(), LeverageError::WindowPredatesReserve);

    Ok(Window {
        seat_index: u16::try_from(index).map_err(|_| LeverageError::MathOverflow)?,
        tick_base: series.tick_base,
        lot_base: series.lot_base,
        min_lots: series.min_lots,
        min_rest_slots: series.min_rest_slots,
        fills_cap: series.fills_cap,
        evictions_cap: series.evictions_cap,
        state: market.state,
        trading_start: market.trading_start,
        lock_at: market.lock_at,
        expiry: market.expiry,
    })
}

/// Which orders a walk counts. Sizing an entry and an owner's own cash-out meet whatever rests. A knock-out, and the
/// health check at entry, count only what has rested `min_rest_slots` (PD-2), so an order placed a moment ago
/// cannot move the mark a position is judged on.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Depth {
    Resting,
    Rested,
}

/// The side of the book a taker meets, in the venue's YES terms and the arithmetic's raw units: buying YES takes the
/// asks, buying NO the bids; selling is the other side. `(ticks × tick_base, lots × lot_base)`, best first.
pub fn read_levels(e: &Engine, w: &Window, outcome: u8, is_exit: bool, depth: Depth, now: i64, slot: u64) -> Result<Vec<YesLevel>> {
    let book_info = e.book.as_ref().ok_or(LeverageError::UnknownMarket)?;
    let book = load_checked::<Book>(book_info, &agari_events::ID).map_err(unknown)?;
    let capacity = usize::try_from(book.capacity).map_err(|_| LeverageError::MathOverflow)?;
    let nodes = load_slice_checked::<OrderNode>(book_info, Book::DISCRIMINATOR.len() + BOOK_FIXED_LEN, capacity).map_err(unknown)?;
    let filter = NodeFilter { now, slot, rested_only: depth == Depth::Rested, min_rest_slots: u64::from(w.min_rest_slots) };
    let is_bid = (outcome == 0) == is_exit;
    let found = if is_bid { levels(&walk_bids(&book, &nodes), Side::Bid, LEVELS, &filter) } else { levels(&walk_asks(&book, &nodes), Side::Ask, LEVELS, &filter) };
    Ok(found.into_iter().map(|(ticks, lots)| (u128::from(ticks) * u128::from(w.tick_base), u128::from(lots) * u128::from(w.lot_base))).collect())
}

/// A YES price in raw units as the ticks the engine takes. Every engine price is YES ticks, a NO order's included.
pub fn yes_ticks(limit_yes_raw: u128, w: &Window) -> Result<u16> {
    let ticks = u16::try_from(limit_yes_raw / u128::from(w.tick_base.max(1))).map_err(|_| LeverageError::MathOverflow)?;
    require!(is_valid_price(ticks), LeverageError::NothingFilled);
    Ok(ticks)
}

/// The IOC the reserve buys and sells with. Proceeds and unspent escrow go straight back to custody.
pub fn ioc_args(w: &Window, outcome: u8, is_buy: bool, price_ticks: u16, lots: u64, expire_ts: i64, client_id: u64) -> PlaceOrderArgs {
    PlaceOrderArgs {
        kind: outcome * 2 + u8::from(!is_buy),
        price_ticks,
        lots,
        expire_ts,
        order_type: ORDER_TYPE_IOC,
        self_match: SELF_MATCH_CANCEL_TAKER,
        max_fills: MAX_FILLS.min(w.fills_cap),
        max_evictions: MAX_EVICTIONS.min(w.evictions_cap),
        seat_hint: w.seat_index,
        use_credit: false,
        withdraw_proceeds: true,
        client_id,
    }
}

/// `user_place_order` as the seat, then the `PlaceResult` the engine returned (program id checked).
pub fn place(e: &Engine, seat_bump: u8, args: PlaceOrderArgs) -> Result<PlaceResult> {
    let accounts = agari_events::cpi::accounts::UserPlaceOrder {
        authority: e.seat.clone(),
        config: e.config.clone(),
        series: e.series.clone(),
        market: e.market.clone(),
        book: e.book.clone().ok_or(LeverageError::UnknownMarket)?,
        ledger: e.ledger.clone(),
        mvault: e.mvault.clone(),
        authority_token: e.custody.clone(),
        collateral_mint: e.mint.clone(),
        token_program: e.token_program.clone(),
        event_authority: e.event_authority.clone(),
        program: e.program.clone(),
    };
    let bump = [seat_bump];
    let seeds: &[&[u8]] = &[SEAT_SEED, &bump];
    agari_events::cpi::user_place_order(CpiContext::new(agari_events::ID, accounts).with_signer(&[seeds]), args)?;
    PlaceResult::from_return_data(&agari_events::ID, get_return_data()).ok_or_else(|| error!(LeverageError::EngineResultMissing))
}

/// `user_redeem(seat, Some(outcome), Some(lots))`: a PROGRAM partial redeem paid into custody. The seat holds every
/// position's contracts pooled, so a settlement redeems exactly one position's lots and leaves the rest.
pub fn redeem(e: &Engine, seat_bump: u8, seat_index: u16, outcome: u8, lots: u64) -> Result<()> {
    let accounts = agari_events::cpi::accounts::UserRedeem {
        authority: e.seat.clone(),
        config: e.config.clone(),
        series: e.series.clone(),
        market: e.market.clone(),
        ledger: e.ledger.clone(),
        mvault: e.mvault.clone(),
        authority_token: e.custody.clone(),
        collateral_mint: e.mint.clone(),
        token_program: e.token_program.clone(),
        event_authority: e.event_authority.clone(),
        program: e.program.clone(),
    };
    let bump = [seat_bump];
    let seeds: &[&[u8]] = &[SEAT_SEED, &bump];
    agari_events::cpi::user_redeem(CpiContext::new(agari_events::ID, accounts).with_signer(&[seeds]), seat_index, Some(outcome), Some(lots))
}
