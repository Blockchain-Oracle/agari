//! One error enum (events-accounts.md §4). Discriminants are explicit, so codes stay in fixed ranges as the
//! enum grows: Anchor adds 6000, giving 6000 admin/roller · 6100 orders · 6200 prints/settle · 6300 sets/cash.
//! `MissingPrint` and `CrossCheckDivergence` are `VoidReason` values, not errors.

use anchor_lang::prelude::*;

#[error_code]
pub enum EventsError {
    // 6000 admin / roller
    #[msg("operation not allowed in the current mode")]
    InvalidMode = 0,
    #[msg("signer is not the admin")]
    NotAdmin = 1,
    #[msg("signer is not a configured roller")]
    NotRoller = 2,
    #[msg("grid is not exact for the collateral decimals")]
    BadGrid = 3,
    #[msg("window index is not the series' next index")]
    BadWindowIndex = 4,
    #[msg("window overlaps the previous window")]
    WindowOverlap = 5,
    #[msg("window is not aligned to the series cadence")]
    BadAlignment = 6,
    #[msg("window times or listing horizon are out of range")]
    BadHorizon = 7,
    #[msg("book is not free for this series")]
    NoFreeBook = 8,
    #[msg("book and market are not bound to each other")]
    BookMarketMismatch = 9,
    #[msg("ledger and market are not bound to each other")]
    LedgerMarketMismatch = 10,
    #[msg("policy version does not exist")]
    UnknownPolicyVersion = 11,
    #[msg("policy versions are immutable once written")]
    PolicyVersionImmutable = 12,
    #[msg("no policy version covers both boundaries, or a higher one does")]
    SourceNotCovered = 13,
    #[msg("policy version fails validation")]
    BadPolicy = 14,
    #[msg("series parameters are out of range")]
    BadSeriesParams = 15,
    #[msg("book account size does not match its capacity")]
    BadBookSize = 16,
    #[msg("series already has the maximum number of books")]
    TooManyBooks = 17,
    #[msg("authority arrays are malformed")]
    BadAuthorities = 18,
    #[msg("market does not belong to this series")]
    SeriesMarketMismatch = 19,
    #[msg("mvault does not belong to this market")]
    MvaultMarketMismatch = 20,
    #[msg("signer is not a configured program authority")]
    NotProgramAuthority = 21,

    // 6100 orders
    #[msg("market is not trading")]
    MarketNotTrading = 100,
    #[msg("market is not locked")]
    MarketNotLocked = 101,
    #[msg("market is not resolved or voided")]
    MarketNotTerminal = 102,
    #[msg("market is already resolved or voided")]
    MarketAlreadyTerminal = 103,
    #[msg("price must be 1..=999 ticks")]
    InvalidPrice = 104,
    #[msg("quantity must be positive")]
    InvalidQuantity = 105,
    #[msg("quantity is below the series minimum")]
    BelowMinLots = 106,
    #[msg("order expiry is not in the future")]
    OrderAlreadyExpired = 107,
    #[msg("order expiry is after lock_at")]
    ExpiryAfterLock = 108,
    #[msg("post-only order would cross")]
    PostOnlyWouldCross = 109,
    #[msg("immediate-or-cancel order filled nothing")]
    ImmediateOrCancelNoFill = 110,
    #[msg("fill-or-kill order could not fill completely")]
    FillOrKillNotFillable = 111,
    #[msg("book has no free order node")]
    BookFull = 112,
    #[msg("ledger has no free seat")]
    LedgerFull = 113,
    #[msg("seat has too many open orders")]
    TooManyOpenOrders = 114,
    #[msg("seat does not belong to this authority")]
    SeatMismatch = 115,
    #[msg("order handle is stale")]
    UnknownOrder = 116,
    #[msg("order belongs to another seat")]
    NotOrderOwner = 117,
    #[msg("reduced size must be smaller and at least the minimum")]
    ReduceNotSmaller = 118,
    #[msg("order would trade against the taker's own resting order")]
    SelfMatchCancelTaker = 119,
    #[msg("order arguments are out of range")]
    InvalidOrderArgs = 120,
    #[msg("market is listed: only post-only orders may rest before the open")]
    PreOpenTakerRefused = 121,

    // 6200 prints / settle
    #[msg("print source does not match the window's policy")]
    WrongPrintSource = 200,
    #[msg("print slot already recorded")]
    PrintAlreadyRecorded = 201,
    #[msg("feed id does not match the policy")]
    FeedIdMismatch = 202,
    #[msg("price update is not fully verified")]
    InsufficientVerification = 203,
    #[msg("print is too early for its boundary")]
    PrintTooEarly = 204,
    #[msg("price update is not the unique update at the boundary")]
    PrintNotUnique = 205,
    #[msg("print admission deadline has passed")]
    PrintTooLate = 206,
    #[msg("price confidence is too wide")]
    ConfidenceTooWide = 207,
    #[msg("attestation or signed quote is malformed")]
    BadAttestation = 208,
    #[msg("attestor is not configured")]
    UnknownAttestor = 209,
    #[msg("RedStone payload is malformed")]
    BadRedStonePackage = 210,
    #[msg("RedStone package timestamp is not the boundary")]
    RedStoneTimestampMismatch = 211,
    #[msg("RedStone signer is not configured")]
    UnknownRedStoneSigner = 212,
    #[msg("not enough distinct RedStone signers")]
    InsufficientRedStoneSigners = 213,
    #[msg("Switchboard feed does not match the policy")]
    SwitchboardFeedMismatch = 214,
    #[msg("Switchboard queue does not match the config")]
    SwitchboardQueueMismatch = 215,
    #[msg("oracle index repeated in the quote")]
    DuplicateOracle = 216,
    #[msg("too few distinct oracles in the quote")]
    TooFewOracles = 217,
    #[msg("quote slot is too old")]
    QuoteSlotStale = 218,
    #[msg("cross-check prints are still admissible")]
    CrossCheckPending = 219,
    #[msg("result retention period has not elapsed")]
    RetentionNotElapsed = 220,
    #[msg("instruction cannot be called by CPI")]
    CpiNotAllowed = 221,
    #[msg("required prints are missing")]
    PrintsMissing = 222,
    #[msg("print admission is still open or nothing is missing")]
    SettlementWindowOpen = 223,
    #[msg("seat still has open orders")]
    OpenOrdersRemain = 224,
    #[msg("program seats cannot be redeemed by a crank")]
    ProgramSeatNotPublic = 225,
    #[msg("ledger still holds balances")]
    LedgerNotEmpty = 226,
    #[msg("print value is out of range")]
    InvalidPrintValue = 227,
    #[msg("previous window is not adjacent or uses another policy")]
    PrintNotAdjacent = 228,
    #[msg("products still depend on this market")]
    DependentsRemain = 229,
    #[msg("book has not been released")]
    BookNotReleased = 230,
    #[msg("ledger has not been closed")]
    LedgerNotClosed = 231,
    #[msg("partial redeem is for program seats only")]
    PartialRedeemNotAllowed = 232,
    #[msg("print slot is out of range")]
    BadPrintSlot = 233,

    // 6300 sets / cash
    #[msg("seat credit is insufficient")]
    InsufficientCredit = 300,
    #[msg("seat outcome balance is insufficient")]
    InsufficientOutcome = 301,
    #[msg("token mint is not the collateral mint")]
    WrongMint = 302,
    #[msg("token program is not SPL Token")]
    WrongTokenProgram = 303,
    #[msg("arithmetic overflow")]
    MathOverflow = 304,
    #[msg("token account is not owned by the authority")]
    WrongTokenOwner = 305,
    #[msg("seat still holds balances or orders")]
    SeatNotEmpty = 306,
    #[msg("ledger growth amount is out of range")]
    BadGrowAmount = 307,
}
