//! The vault's one seam to agari-events: the shared resolve, the two post-only quotes, the pull, the merge and the
//! redeem, all signed by the vault's own seat PDA.
//!
//! Engine state is read with `load_checked` and copied out before any CPI, so no borrow is alive across one. Only
//! this file names engine types, which is what lets the CPI client be swapped in a single place.
//!
//! The maker quotes **post-only**. A taker order would let the vault cross a book it is itself making and pay the
//! spread to whoever is resting there; post-only means a quote either rests at the price the vault chose or is
//! refused. Providers' capital never takes.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::get_return_data;

use agari_common::grid::is_valid_price;
use agari_common::place_result::PlaceResult;
use agari_common::view::{bound_both_ways, load_checked, load_slice_checked};
use agari_events::constants::{LEDGER_HEADER_LEN, SEAT_LEN};
use agari_events::instructions::PlaceOrderArgs;
use agari_events::state::{Book, GlobalConfig, Ledger, Market, MarketState, Seat, Series};

use crate::constants::SEAT_SEED;
use crate::errors::MakerError;

/// Order types, as the engine numbers them.
pub const ORDER_TYPE_POST_ONLY: u8 = 3;
/// A quote meeting the vault's own other side cancels the incoming order, never the rest.
pub const SELF_MATCH_CANCEL_TAKER: u8 = 0;
pub const MAX_FILLS: u8 = 16;
pub const MAX_EVICTIONS: u8 = 16;
/// How far a pull walks the book looking for the seat's own orders.
pub const MAX_CANCEL_SCAN: u16 = 256;

/// The engine accounts an instruction passes, plus the vault's seat and custody.
pub struct Engine<'info> {
    pub program: AccountInfo<'info>,
    pub config: AccountInfo<'info>,
    pub series: AccountInfo<'info>,
    pub market: AccountInfo<'info>,
    /// Absent for the cranks that take no Book (redeem).
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
    pub seat_index: u16,
    pub cash_unit: u64,
    pub lot_base: u64,
    pub fills_cap: u8,
    pub evictions_cap: u8,
    pub state: u8,
    pub trading_start: i64,
    pub lock_at: i64,
    pub expiry: i64,
    pub payout_yes: u32,
    pub payout_no: u32,
}

impl Window {
    pub fn is_trading(&self, now: i64) -> bool {
        self.state == u8::from(MarketState::Open) && self.trading_start <= now && now < self.lock_at
    }

    pub fn is_settled(&self) -> bool {
        self.state == u8::from(MarketState::Resolved) || self.state == u8::from(MarketState::Voided)
    }

    pub fn payout(&self, outcome: u8) -> u32 {
        if outcome == 0 { self.payout_yes } else { self.payout_no }
    }
}

fn unknown<E>(_: E) -> Error {
    error!(MakerError::UnknownMarket)
}

/// The bound Window, the engine's collateral, and the vault's own PROGRAM seat.
///
/// The seat lookup is the security of the whole vault: the engine only lets a registered `program_authorities`
/// entry hold a PROGRAM seat, so a look-alike account cannot stand in for the vault and spend its custody.
pub fn resolve(e: &Engine, collateral_mint: &Pubkey, price: Option<u16>) -> Result<Window> {
    let engine = &agari_events::ID;
    let market_key = e.market.key();
    let market = load_checked::<Market>(&e.market, engine).map_err(unknown)?;
    let series = load_checked::<Series>(&e.series, engine).map_err(unknown)?;
    require_keys_eq!(market.series, e.series.key(), MakerError::UnknownMarket);
    let ledger = load_checked::<Ledger>(&e.ledger, engine).map_err(unknown)?;
    require!(bound_both_ways(&market_key, &market.ledger, &e.ledger.key(), &ledger.market), MakerError::UnknownMarket);
    if let Some(book_info) = &e.book {
        let book = load_checked::<Book>(book_info, engine).map_err(unknown)?;
        require!(bound_both_ways(&market_key, &market.book, &book_info.key(), &book.market), MakerError::UnknownMarket);
    }
    require_keys_eq!(market.mvault, e.mvault.key(), MakerError::UnknownMarket);

    let config = load_checked::<GlobalConfig>(&e.config, engine).map_err(unknown)?;
    require_keys_eq!(config.collateral_mint, *collateral_mint, MakerError::WrongCollateral);
    if let Some(price_ticks) = price {
        require!(is_valid_price(price_ticks), MakerError::BadPrice);
    }

    let seat_key = e.seat.key();
    let index = config.program_authorities.iter().position(|k| *k == seat_key).ok_or(MakerError::VaultNotRegistered)?;
    require!(index < usize::from(ledger.capacity), MakerError::WindowPredatesVault);
    let offset = SEAT_LEN.checked_mul(index).and_then(|o| o.checked_add(8 + LEDGER_HEADER_LEN)).ok_or(MakerError::MathOverflow)?;
    let seat = load_slice_checked::<Seat>(&e.ledger, offset, 1).map_err(|_| error!(MakerError::WindowPredatesVault))?;
    require!(seat[0].owner == seat_key && seat[0].is_program(), MakerError::WindowPredatesVault);

    Ok(Window {
        seat_index: u16::try_from(index).map_err(|_| MakerError::MathOverflow)?,
        cash_unit: series.cash_unit,
        lot_base: series.lot_base,
        fills_cap: series.fills_cap,
        evictions_cap: series.evictions_cap,
        state: market.state,
        trading_start: market.trading_start,
        lock_at: market.lock_at,
        expiry: market.expiry,
        payout_yes: market.payout_yes,
        payout_no: market.payout_no,
    })
}

/// One resting quote. `withdraw_proceeds` is false: whatever comes back stays as seat credit until the vault
/// sweeps it, so a fill does not dribble tokens into custody on every match.
pub fn quote_args(w: &Window, kind: u8, price_ticks: u16, lots: u64, expire_ts: i64, client_id: u64) -> PlaceOrderArgs {
    PlaceOrderArgs {
        kind,
        price_ticks,
        lots,
        expire_ts,
        order_type: ORDER_TYPE_POST_ONLY,
        self_match: SELF_MATCH_CANCEL_TAKER,
        max_fills: MAX_FILLS.min(w.fills_cap),
        max_evictions: MAX_EVICTIONS.min(w.evictions_cap),
        seat_hint: w.seat_index,
        use_credit: true,
        withdraw_proceeds: false,
        client_id,
    }
}

fn seat_signer(seat_bump: u8) -> [u8; 1] {
    [seat_bump]
}

pub fn place(e: &Engine, seat_bump: u8, args: PlaceOrderArgs) -> Result<PlaceResult> {
    let accounts = agari_events::cpi::accounts::UserPlaceOrder {
        authority: e.seat.clone(),
        config: e.config.clone(),
        series: e.series.clone(),
        market: e.market.clone(),
        book: e.book.clone().ok_or(MakerError::UnknownMarket)?,
        ledger: e.ledger.clone(),
        mvault: e.mvault.clone(),
        authority_token: e.custody.clone(),
        collateral_mint: e.mint.clone(),
        token_program: e.token_program.clone(),
        event_authority: e.event_authority.clone(),
        program: e.program.clone(),
    };
    let bump = seat_signer(seat_bump);
    let seeds: &[&[u8]] = &[SEAT_SEED, &bump];
    agari_events::cpi::user_place_order(CpiContext::new(agari_events::ID, accounts).with_signer(&[seeds]), args)?;
    PlaceResult::from_return_data(&agari_events::ID, get_return_data()).ok_or_else(|| error!(MakerError::EngineResultMissing))
}

/// Pull every resting order the vault has on this Window.
/// `withdraw: true` — the escrow a cancelled order releases comes straight back to custody rather than sitting as
/// seat credit, so a pull actually restores what a provider can withdraw.
pub fn cancel_all(e: &Engine, seat_bump: u8, seat_index: u16) -> Result<()> {
    let accounts = agari_events::cpi::accounts::UserCancelOrders {
        authority: e.seat.clone(),
        config: e.config.clone(),
        series: e.series.clone(),
        market: e.market.clone(),
        book: e.book.clone().ok_or(MakerError::UnknownMarket)?,
        ledger: e.ledger.clone(),
        mvault: Some(e.mvault.clone()),
        authority_token: Some(e.custody.clone()),
        collateral_mint: Some(e.mint.clone()),
        token_program: Some(e.token_program.clone()),
        event_authority: e.event_authority.clone(),
        program: e.program.clone(),
    };
    let bump = seat_signer(seat_bump);
    let seeds: &[&[u8]] = &[SEAT_SEED, &bump];
    agari_events::cpi::user_cancel_all(CpiContext::new(agari_events::ID, accounts).with_signer(&[seeds]), seat_index, MAX_CANCEL_SCAN, true)
}

/// A complete YES+NO set is collateral again. Quoting both sides makes them, so the vault unmakes them rather
/// than carrying two opposite positions to settlement.
pub fn merge_complete_set(e: &Engine, seat_bump: u8, seat_index: u16, lots: u64) -> Result<()> {
    let accounts = agari_events::cpi::accounts::UserCompleteSet {
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
    let bump = seat_signer(seat_bump);
    let seeds: &[&[u8]] = &[SEAT_SEED, &bump];
    agari_events::cpi::user_merge_complete_set(CpiContext::new(agari_events::ID, accounts).with_signer(&[seeds]), lots, seat_index, true)
}

/// The whole seat on a settled Window, paid into custody.
pub fn redeem(e: &Engine, seat_bump: u8, seat_index: u16) -> Result<()> {
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
    let bump = seat_signer(seat_bump);
    let seeds: &[&[u8]] = &[SEAT_SEED, &bump];
    agari_events::cpi::user_redeem(CpiContext::new(agari_events::ID, accounts).with_signer(&[seeds]), seat_index, None, None)
}
