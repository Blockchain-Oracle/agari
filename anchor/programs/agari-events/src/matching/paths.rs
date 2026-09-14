//! The fill-kind matrix and escrow per kind (events-engine.md §2, §2.1, §5.1).
//!
//! Every row of the eight-row matrix decomposes: the maker's update depends only on the maker's kind, the
//! taker's only on the taker's kind, and `backing_lots` moves +q when both buy (MINT_PAIR), −q when both sell
//! (BURN_PAIR). A YES kind trades at `p` per lot, a NO kind at `1000 − p`, so the two sides of any fill sum to
//! `q × 1000 × cu`, the backing of `q` pairs.

use agari_common::grid::PAIR_TICKS;

use crate::errors::EventsError;
use crate::state::{Kind, Path, Seat};

const fn add(a: u64, b: u64) -> Result<u64, EventsError> {
    match a.checked_add(b) {
        Some(v) => Ok(v),
        None => Err(EventsError::MathOverflow),
    }
}

const fn sub(a: u64, b: u64) -> Result<u64, EventsError> {
    match a.checked_sub(b) {
        Some(v) => Ok(v),
        None => Err(EventsError::MathOverflow),
    }
}

/// Ticks one lot of `kind` trades at, for YES price `p`: `p` for YES kinds, `1000 − p` for NO kinds.
pub fn own_ticks(kind: Kind, price: u16) -> u64 {
    match kind {
        Kind::BuyYes | Kind::SellYes => u64::from(price),
        Kind::BuyNo | Kind::SellNo => PAIR_TICKS - u64::from(price),
    }
}

/// `lots × own_ticks × cu`, checked.
pub fn cash_of(kind: Kind, price: u16, lots: u64, cu: u64) -> Result<u64, EventsError> {
    lots.checked_mul(own_ticks(kind, price)).and_then(|v| v.checked_mul(cu)).ok_or(EventsError::MathOverflow)
}

/// The path a taker × maker cross takes (`store.ts:317-335`); `None` for two orders on the same side.
pub const fn path_of(taker: Kind, maker: Kind) -> Option<Path> {
    match (taker, maker) {
        (Kind::BuyYes, Kind::SellYes) | (Kind::SellYes, Kind::BuyYes) => Some(Path::DirectYes),
        (Kind::BuyNo, Kind::SellNo) | (Kind::SellNo, Kind::BuyNo) => Some(Path::DirectNo),
        (Kind::BuyYes, Kind::BuyNo) | (Kind::BuyNo, Kind::BuyYes) => Some(Path::MintPair),
        (Kind::SellYes, Kind::SellNo) | (Kind::SellNo, Kind::SellYes) => Some(Path::BurnPair),
        _ => None,
    }
}

/// The maker side of a fill of `q` lots at its own price: a resting buy releases escrow and receives outcome; a
/// resting sell releases locked outcome and is credited cash.
pub fn apply_maker(seat: &mut Seat, kind: Kind, price: u16, q: u64, cu: u64) -> Result<u64, EventsError> {
    let cash = cash_of(kind, price, q, cu)?;
    match kind {
        Kind::BuyYes => {
            seat.locked_cash = sub(seat.locked_cash, cash)?;
            seat.yes_free = add(seat.yes_free, q)?;
        }
        Kind::BuyNo => {
            seat.locked_cash = sub(seat.locked_cash, cash)?;
            seat.no_free = add(seat.no_free, q)?;
        }
        Kind::SellYes => {
            seat.yes_locked = sub(seat.yes_locked, q)?;
            seat.credit = add(seat.credit, cash)?;
        }
        Kind::SellNo => {
            seat.no_locked = sub(seat.no_locked, q)?;
            seat.credit = add(seat.credit, cash)?;
        }
    }
    Ok(cash)
}

/// The taker side's outcome movement at the maker's price. Returns `(pays, receives)`; the cash itself is settled
/// once, after matching (§4.1): buys pay through funding, sells are credited.
pub fn apply_taker(seat: &mut Seat, kind: Kind, price: u16, q: u64, cu: u64) -> Result<(u64, u64), EventsError> {
    let cash = cash_of(kind, price, q, cu)?;
    Ok(match kind {
        Kind::BuyYes => {
            seat.yes_free = add(seat.yes_free, q)?;
            (cash, 0)
        }
        Kind::BuyNo => {
            seat.no_free = add(seat.no_free, q)?;
            (cash, 0)
        }
        Kind::SellYes => {
            seat.yes_free = sub(seat.yes_free, q)?;
            (0, cash)
        }
        Kind::SellNo => {
            seat.no_free = sub(seat.no_free, q)?;
            (0, cash)
        }
    })
}

/// Locks what a resting order of `lots` at `price` escrows (§2 table): cash for buys, outcome for sells.
pub fn lock_escrow(seat: &mut Seat, kind: Kind, price: u16, lots: u64, cu: u64) -> Result<(), EventsError> {
    match kind {
        Kind::BuyYes | Kind::BuyNo => seat.locked_cash = add(seat.locked_cash, cash_of(kind, price, lots, cu)?)?,
        Kind::SellYes => {
            seat.yes_free = sub(seat.yes_free, lots)?;
            seat.yes_locked = add(seat.yes_locked, lots)?;
        }
        Kind::SellNo => {
            seat.no_free = sub(seat.no_free, lots)?;
            seat.no_locked = add(seat.no_locked, lots)?;
        }
    }
    Ok(())
}

/// Returns a removed order's escrow to its owner (§5.1): buy escrow to `credit`, sell lots back to `*_free`.
pub fn refund_escrow(seat: &mut Seat, kind: Kind, price: u16, lots: u64, cu: u64) -> Result<(), EventsError> {
    match kind {
        Kind::BuyYes | Kind::BuyNo => {
            let cash = cash_of(kind, price, lots, cu)?;
            seat.locked_cash = sub(seat.locked_cash, cash)?;
            seat.credit = add(seat.credit, cash)?;
        }
        Kind::SellYes => {
            seat.yes_locked = sub(seat.yes_locked, lots)?;
            seat.yes_free = add(seat.yes_free, lots)?;
        }
        Kind::SellNo => {
            seat.no_locked = sub(seat.no_locked, lots)?;
            seat.no_free = add(seat.no_free, lots)?;
        }
    }
    Ok(())
}
