//! The vault's one seam to agari-events (vault.md §5, D-064): the shared resolve `R`, the IOC placement and the
//! PROGRAM partial redeem, both signed by the seat PDA. Engine state is read with `load_checked` and copied out, so
//! no borrow is alive at a CPI. Only this file names engine types, so the CPI client can be swapped in one place.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::get_return_data;

use agari_common::grid::is_valid_price;
use agari_common::place_result::PlaceResult;
use agari_common::view::{bound_both_ways, load_checked, load_slice_checked};
use agari_events::constants::{LEDGER_HEADER_LEN, SEAT_LEN};
use agari_events::instructions::PlaceOrderArgs;
use agari_events::state::{Book, GlobalConfig, Ledger, Market, MarketState, Seat, Series};

use crate::constants::{MAX_EVICTIONS, MAX_FILLS, ORDER_TYPE_IOC, SEAT_SEED, SELF_MATCH_CANCEL_TAKER};
use crate::errors::VaultError;

/// The engine accounts an instruction passes (`ENG` in vault.md §3), plus the seat and the owner's custody.
pub struct Engine<'info> {
    pub program: AccountInfo<'info>,
    pub config: AccountInfo<'info>,
    pub series: AccountInfo<'info>,
    pub market: AccountInfo<'info>,
    /// Absent for the crank (redeem takes no Book).
    pub book: Option<AccountInfo<'info>>,
    pub ledger: AccountInfo<'info>,
    pub mvault: AccountInfo<'info>,
    pub mint: AccountInfo<'info>,
    pub token_program: AccountInfo<'info>,
    pub event_authority: AccountInfo<'info>,
    pub seat: AccountInfo<'info>,
    pub custody: AccountInfo<'info>,
}

/// What the vault needs from a resolved Window, copied out of engine state.
#[derive(Clone, Copy, Debug)]
pub struct Window {
    /// The vault's PROGRAM seat index in this Ledger.
    pub seat_index: u16,
    pub cash_unit: u64,
    pub fills_cap: u8,
    pub evictions_cap: u8,
    pub state: u8,
    pub trading_start: i64,
    pub lock_at: i64,
    pub payout_yes: u32,
    pub payout_no: u32,
}

impl Window {
    /// `_placeIoc`'s status gate (`VenueGateway.sol:89-90`): open and `trading_start ≤ now < lock_at`.
    pub fn is_trading(&self, now: i64) -> bool {
        self.state == u8::from(MarketState::Open) && self.trading_start <= now && now < self.lock_at
    }

    pub fn is_settled(&self) -> bool {
        self.state == u8::from(MarketState::Resolved) || self.state == u8::from(MarketState::Voided)
    }

    /// The payout numerator of one outcome (`/ 10⁷`).
    pub fn payout(&self, outcome: u8) -> u32 {
        if outcome == 0 {
            self.payout_yes
        } else {
            self.payout_no
        }
    }
}

fn unknown<E>(_: E) -> Error {
    error!(VaultError::UnknownMarket)
}

/// `R` (vault.md §3.4 step 2): the bound Window, the engine's collateral, the order's outcome and price when given,
/// then the vault's registration and PROGRAM seat. The seat check keeps the engine from ever bond-claiming a seat.
pub fn resolve(e: &Engine, collateral_mint: &Pubkey, order: Option<(u8, u16)>) -> Result<Window> {
    let engine = &agari_events::ID;
    let market_key = e.market.key();
    let market = load_checked::<Market>(&e.market, engine).map_err(unknown)?;
    let series = load_checked::<Series>(&e.series, engine).map_err(unknown)?;
    require_keys_eq!(market.series, e.series.key(), VaultError::UnknownMarket);
    let ledger = load_checked::<Ledger>(&e.ledger, engine).map_err(unknown)?;
    require!(bound_both_ways(&market_key, &market.ledger, &e.ledger.key(), &ledger.market), VaultError::UnknownMarket);
    if let Some(book_info) = &e.book {
        let book = load_checked::<Book>(book_info, engine).map_err(unknown)?;
        require!(bound_both_ways(&market_key, &market.book, &book_info.key(), &book.market), VaultError::UnknownMarket);
    }
    require_keys_eq!(market.mvault, e.mvault.key(), VaultError::UnknownMarket);

    let config = load_checked::<GlobalConfig>(&e.config, engine).map_err(unknown)?;
    require_keys_eq!(config.collateral_mint, *collateral_mint, VaultError::WrongCollateral);
    if let Some((outcome, price_ticks)) = order {
        require!(outcome <= 1, VaultError::BadOutcome);
        require!(is_valid_price(price_ticks), VaultError::BadPrice);
    }
    let seat_key = e.seat.key();
    let index = config.program_authorities.iter().position(|k| *k == seat_key).ok_or(VaultError::VaultNotRegistered)?;
    require!(index < usize::from(ledger.capacity), VaultError::WindowPredatesVault);
    let offset = SEAT_LEN.checked_mul(index).and_then(|o| o.checked_add(8 + LEDGER_HEADER_LEN)).ok_or(VaultError::MathOverflow)?;
    let seat = load_slice_checked::<Seat>(&e.ledger, offset, 1).map_err(|_| error!(VaultError::WindowPredatesVault))?;
    require!(seat[0].owner == seat_key && seat[0].is_program(), VaultError::WindowPredatesVault);

    Ok(Window {
        seat_index: u16::try_from(index).map_err(|_| VaultError::MathOverflow)?,
        cash_unit: series.cash_unit,
        fills_cap: series.fills_cap,
        evictions_cap: series.evictions_cap,
        state: market.state,
        trading_start: market.trading_start,
        lock_at: market.lock_at,
        payout_yes: market.payout_yes,
        payout_no: market.payout_no,
    })
}

/// The IOC the vault places for an order (vault.md §3.4 CPI).
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
        book: e.book.clone().ok_or(VaultError::UnknownMarket)?,
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
    PlaceResult::from_return_data(&agari_events::ID, get_return_data()).ok_or_else(|| error!(VaultError::EngineResultMissing))
}

/// `user_redeem(seat, Some(outcome), Some(lots))`: a PROGRAM partial redeem paid into custody.
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
