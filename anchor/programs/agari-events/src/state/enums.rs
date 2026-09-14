//! Enums stored as `u8` (events-accounts.md §2). Accounts hold the raw byte; code converts with `TryFrom<u8>`
//! and maps a bad byte to the caller's own error (`InvalidOrderArgs`, `BadPrintSlot`, …).

macro_rules! u8_enum {
    ($(#[$meta:meta])* $name:ident { $($variant:ident = $value:literal),+ $(,)? }) => {
        $(#[$meta])*
        #[derive(Clone, Copy, Debug, PartialEq, Eq)]
        #[repr(u8)]
        pub enum $name { $($variant = $value),+ }

        impl TryFrom<u8> for $name {
            type Error = ();
            fn try_from(value: u8) -> core::result::Result<Self, ()> {
                match value { $($value => Ok(Self::$variant),)+ _ => Err(()) }
            }
        }

        impl From<$name> for u8 {
            fn from(value: $name) -> u8 { value as u8 }
        }
    };
}

u8_enum!(Kind { BuyYes = 0, SellYes = 1, BuyNo = 2, SellNo = 3 });
u8_enum!(OrderType { Normal = 0, Fok = 1, Ioc = 2, PostOnly = 3 });
u8_enum!(SelfMatch { CancelTaker = 0, CancelMaker = 1 });
u8_enum!(Path { DirectYes = 0, DirectNo = 1, MintPair = 2, BurnPair = 3 });
u8_enum!(Mode { Normal = 0, ReduceOnly = 1, Halted = 2 });
u8_enum!(Basis { Regular = 0, Gap = 1, Token24x7 = 2 });
u8_enum!(BoundaryKind { Intraday = 0, SessionOpen = 1, SessionClose = 2 });
u8_enum!(Source { None = 0, Pyth = 1, RedStone = 2, Switchboard = 3, Attested = 4 });
u8_enum!(Which { Open = 0, Close = 1, CheckOpen = 2, CheckClose = 3 });
u8_enum!(
    /// Stored settlement state; Listed/Trading/Locked are derived from the clock (`Market::status`).
    MarketState { Open = 0, Resolved = 1, Voided = 2 }
);
u8_enum!(VoidReason { None = 0, MissingPrint = 1, CrossCheckDivergence = 2 });
u8_enum!(Winner { Yes = 0, No = 1, Void = 2 });
u8_enum!(StopReason { Filled = 0, NoCross = 1, FillCap = 2, SkipCap = 3, PostOnlyRested = 4 });
u8_enum!(RemoveReason { Expired = 0, SelfMatch = 1, UserCancel = 2, CancelAll = 3, Sweep = 4 });

/// The lifecycle a Window shows (events-engine.md §7), derived from `state` and the clock; never stored.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum MarketStatus {
    Listed,
    Trading,
    Locked,
    Resolved,
    Voided,
}

impl Kind {
    /// Bid side: BUY_YES and SELL_NO. Ask side: SELL_YES and BUY_NO.
    pub const fn is_bid(self) -> bool {
        matches!(self, Kind::BuyYes | Kind::SellNo)
    }

    pub const fn is_buy(self) -> bool {
        matches!(self, Kind::BuyYes | Kind::BuyNo)
    }
}

impl Which {
    pub const fn is_check(self) -> bool {
        matches!(self, Which::CheckOpen | Which::CheckClose)
    }

    pub const fn is_open(self) -> bool {
        matches!(self, Which::Open | Which::CheckOpen)
    }
}

pub const SEAT_FLAG_PROGRAM: u8 = 1 << 0;
pub const SEAT_FLAG_BONDED: u8 = 1 << 1;
pub const NODE_FLAG_LIVE: u8 = 1 << 0;
pub const PRINT_FLAG_COPIED_FROM_PREV: u8 = 1 << 0;
pub const MARKET_FLAG_BOOK_RELEASED: u8 = 1 << 0;
pub const MARKET_FLAG_LEDGER_CLOSED: u8 = 1 << 1;
pub const MARKET_FLAG_SINGLE_SOURCE: u8 = 1 << 2;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trips_and_rejects_out_of_range() {
        for v in 0..=3u8 {
            assert_eq!(u8::from(Kind::try_from(v).unwrap()), v);
        }
        assert!(Kind::try_from(4).is_err() && Which::try_from(4).is_err() && Source::try_from(5).is_err());
        assert!(Kind::BuyYes.is_bid() && Kind::SellNo.is_bid() && !Kind::BuyNo.is_bid());
        assert_eq!(u8::from(Basis::Gap), 1);
    }
}
