use anchor_lang::prelude::*;

#[error_code]
pub enum MakerError {
    #[msg("the vault is paused")]
    Paused,
    #[msg("only the vault's maker may quote or pull")]
    NotMaker,
    #[msg("that Market, Book or Ledger is not the Window it claims to be")]
    UnknownMarket,
    #[msg("that Window uses a different collateral")]
    WrongCollateral,
    #[msg("the price is not on the engine's grid")]
    BadPrice,
    #[msg("the vault is not registered as a program authority on the venue")]
    VaultNotRegistered,
    #[msg("that Window was opened before the vault had a seat")]
    WindowPredatesVault,
    #[msg("the engine returned no result")]
    EngineResultMissing,
    #[msg("that Window is not open for quoting")]
    WindowNotTrading,
    #[msg("that Window has not settled")]
    WindowNotSettled,
    #[msg("the spread is tighter than the vault will quote")]
    SpreadTooTight,
    #[msg("the quote is outside the price band the vault will make")]
    PriceOutOfBand,
    #[msg("the quote is larger than the vault's per-quote ceiling")]
    QuantityTooLarge,
    #[msg("that would put more of the vault into one Window than its ceiling")]
    WindowCapExceeded,
    #[msg("the vault already has as many Windows open as it will carry")]
    TooManyOpenWindows,
    #[msg("too little time is left in that Window to quote into it")]
    TooLate,
    #[msg("that would take the vault past its exposure limit")]
    OverExposure,
    #[msg("the vault has not got that much idle collateral")]
    InsufficientLiquidity,
    #[msg("that wallet does not hold that many shares")]
    InsufficientShares,
    #[msg("the vault has no value to price shares against")]
    NoValue,
    #[msg("the amount is zero")]
    ZeroAmount,
    #[msg("this Window's book has already been settled")]
    AlreadySettled,
    #[msg("arithmetic overflowed")]
    MathOverflow,
}
