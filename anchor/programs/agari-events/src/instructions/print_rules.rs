//! The shared print rules (prints.md §4.0): every `public_record_print_*` admits a slot with `admit`, runs its
//! source's pure verifier from `agari_common::print`, then stores the normalized print with `record`.

use anchor_lang::prelude::*;

use agari_common::print::{normalize::normalize, PrintError, RawPrint};

use crate::constants::PRINT_EXPO;
use crate::errors::EventsError;
use crate::events::PrintRecorded;
use crate::state::{Market, PolicyVersion, Print, PrintPolicy, Series, Source, Which};

/// `PrintError` names are the engine's error names, so the conversion is a plain 1:1 map.
pub fn print_error(e: PrintError) -> Error {
    match e {
        PrintError::InsufficientVerification => EventsError::InsufficientVerification,
        PrintError::FeedIdMismatch => EventsError::FeedIdMismatch,
        PrintError::PrintNotUnique => EventsError::PrintNotUnique,
        PrintError::ConfidenceTooWide => EventsError::ConfidenceTooWide,
        PrintError::InvalidPrintValue => EventsError::InvalidPrintValue,
        PrintError::BadAttestation => EventsError::BadAttestation,
        PrintError::UnknownAttestor => EventsError::UnknownAttestor,
        PrintError::BadRedStonePackage => EventsError::BadRedStonePackage,
        PrintError::RedStoneTimestampMismatch => EventsError::RedStoneTimestampMismatch,
        PrintError::InsufficientRedStoneSigners => EventsError::InsufficientRedStoneSigners,
        PrintError::SwitchboardFeedMismatch => EventsError::SwitchboardFeedMismatch,
        PrintError::SwitchboardQueueMismatch => EventsError::SwitchboardQueueMismatch,
        PrintError::DuplicateOracle => EventsError::DuplicateOracle,
        PrintError::TooFewOracles => EventsError::TooFewOracles,
        PrintError::QuoteSlotStale => EventsError::QuoteSlotStale,
    }
    .into()
}

/// A slot that passed §4.0 steps 1–7: which slot, its boundary `T` and the policy the source must satisfy.
#[derive(Clone, Copy)]
pub struct Admitted {
    pub which: Which,
    pub t: i64,
    pub policy: PrintPolicy,
    pub version: PolicyVersion,
}

/// The policy version a Window was listed on (immutable, so reading it later is exact).
pub fn window_version(series: &Series, market: &Market) -> Result<PolicyVersion> {
    series.versions().get(usize::from(market.policy_version)).copied().ok_or(error!(EventsError::UnknownPolicyVersion))
}

/// The last admissible second for a slot (prints.md §3): the frozen primary deadlines, `T + check_admission_sec`
/// for check slots.
pub fn deadline(market: &Market, version: &PolicyVersion, which: Which) -> Result<i64> {
    Ok(match which {
        Which::Open => market.open_deadline,
        Which::Close => market.close_deadline,
        Which::CheckOpen | Which::CheckClose => market
            .boundary(which)
            .checked_add(i64::from(version.check_admission_sec))
            .ok_or(error!(EventsError::MathOverflow))?,
    })
}

/// prints.md §4.0 steps 1–7, in order.
pub fn admit(series: &Series, series_key: &Pubkey, market: &Market, which: u8, source: Source, now: i64) -> Result<Admitted> {
    require_keys_eq!(market.series, *series_key, EventsError::SeriesMarketMismatch);
    let which = Which::try_from(which).map_err(|_| error!(EventsError::BadPrintSlot))?;
    require!(!market.is_terminal(), EventsError::MarketAlreadyTerminal);
    let version = window_version(series, market)?;
    let policy = *version.policy_for(which);
    require!(policy.source == u8::from(source), EventsError::WrongPrintSource);
    require!(market.print(which).is_empty(), EventsError::PrintAlreadyRecorded);
    let t = market.boundary(which);
    let earliest = t.checked_add(i64::from(policy.min_delay_sec)).ok_or(error!(EventsError::MathOverflow))?;
    require!(now >= earliest, EventsError::PrintTooEarly);
    require!(now <= deadline(market, &version, which)?, EventsError::PrintTooLate);
    Ok(Admitted { which, t, policy, version })
}

/// §4.0 steps 9–10: normalize to expo −8, store the print, take the next `seq` and build the event.
pub fn record(market: &mut Market, market_key: Pubkey, which: Which, source: Source, raw: RawPrint, now: i64) -> Result<PrintRecorded> {
    let price = normalize(i128::from(raw.price), raw.expo).map_err(print_error)?;
    *market.print_mut(which) = Print { price, source_ts: raw.source_ts, expo: PRINT_EXPO, source: u8::from(source), signers: raw.signers, flags: 0, _pad0: 0 };
    let seq = market.next_seq().ok_or(error!(EventsError::MathOverflow))?;
    Ok(PrintRecorded {
        market: market_key,
        seq,
        which: u8::from(which),
        source: u8::from(source),
        price,
        expo: PRINT_EXPO,
        source_ts: raw.source_ts,
        signers: raw.signers,
        copied: false,
        recorded_ts: now,
    })
}
