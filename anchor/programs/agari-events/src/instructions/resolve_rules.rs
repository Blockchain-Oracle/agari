//! Settlement and void decisions (prints.md §5–6), pure over a Market and its policy version, so every branch is
//! unit-tested without a VM. The handlers in `resolve_window.rs` apply the result and write `MarketResult`.

use anchor_lang::prelude::*;

use crate::constants::{PAYOUT_DENOMINATOR, PAYOUT_VOID};
use crate::errors::EventsError;
use crate::state::{Market, MarketState, PolicyVersion, Print, VoidReason, Winner};

/// How a Window resolves.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Resolution {
    pub state: MarketState,
    pub winner: Winner,
    pub payout_yes: u32,
    pub payout_no: u32,
    pub void_reason: VoidReason,
    /// Settled on the primary source alone because the check prints missed their window.
    pub single_source: bool,
}

impl Resolution {
    const fn void(reason: VoidReason) -> Self {
        Self { state: MarketState::Voided, winner: Winner::Void, payout_yes: PAYOUT_VOID, payout_no: PAYOUT_VOID, void_reason: reason, single_source: false }
    }
}

/// `|p − c| × 10,000 > max_divergence_bps × p`, in `i128` over the normalized (expo −8, positive) prices.
pub fn diverges(primary: i64, check: i64, max_divergence_bps: u16) -> bool {
    let gap = (i128::from(primary) - i128::from(check)).abs() * 10_000;
    gap > i128::from(max_divergence_bps) * i128::from(primary)
}

/// prints.md §5 steps 2–4 (the caller has checked the Series binding and that the Window isn't terminal).
pub fn settle_decision(market: &Market, version: &PolicyVersion, now: i64) -> Result<Resolution> {
    require!(!market.open.is_empty() && !market.close.is_empty(), EventsError::PrintsMissing);
    let mut single_source = false;
    if version.has_check() {
        let both = !market.check_open.is_empty() && !market.check_close.is_empty();
        let bound = market.expiry.checked_add(i64::from(version.check_admission_sec)).ok_or(error!(EventsError::MathOverflow))?;
        // An early settler can't skip a check that may still land.
        require!(both || now > bound, EventsError::CrossCheckPending);
        let pairs: [(&Print, &Print); 2] = [(&market.open, &market.check_open), (&market.close, &market.check_close)];
        if pairs.iter().any(|(p, c)| !c.is_empty() && diverges(p.price, c.price, version.max_divergence_bps)) {
            return Ok(Resolution::void(VoidReason::CrossCheckDivergence));
        }
        single_source = !both;
    }
    // PD-3: close ≥ open → Up (ties go to Up).
    let up = market.close.price >= market.open.price;
    Ok(Resolution {
        state: MarketState::Resolved,
        winner: if up { Winner::Yes } else { Winner::No },
        payout_yes: if up { PAYOUT_DENOMINATOR } else { 0 },
        payout_no: if up { 0 } else { PAYOUT_DENOMINATOR },
        void_reason: VoidReason::None,
        single_source,
    })
}

/// prints.md §6 step 2: a primary print is missing **and** its admission deadline has passed. At `now == deadline`
/// the print is still admissible, so the void is refused; the clock makes the two mutually exclusive (PD-6).
pub fn void_decision(market: &Market, now: i64) -> Result<Resolution> {
    let open_missed = market.open.is_empty() && now > market.open_deadline;
    let close_missed = market.close.is_empty() && now > market.close_deadline;
    require!(open_missed || close_missed, EventsError::SettlementWindowOpen);
    Ok(Resolution::void(VoidReason::MissingPrint))
}

#[cfg(test)]
mod tests {
    use super::*;
    use bytemuck::Zeroable;

    const T0: i64 = 1_789_156_500;
    const T1: i64 = T0 + 300;

    fn print(price: i64) -> Print {
        Print { price, source_ts: T0, expo: -8, source: 1, signers: 0, flags: 0, _pad0: 0 }
    }

    fn market(open: i64, close: i64) -> Market {
        let mut m = Market::zeroed();
        (m.trading_start, m.lock_at, m.expiry, m.open_deadline, m.close_deadline) = (T0, T1, T1, T0 + 900, T1 + 900);
        (m.open, m.close) = (print(open), print(close));
        m
    }

    fn checked(max_bps: u16) -> PolicyVersion {
        let mut v = PolicyVersion::zeroed();
        v.primary.source = 1;
        v.check.source = 2;
        (v.max_divergence_bps, v.check_admission_sec) = (max_bps, 120);
        v
    }

    #[test]
    fn close_at_or_above_open_pays_up() {
        let plain = PolicyVersion::zeroed();
        let tie = settle_decision(&market(36_500_000_000, 36_500_000_000), &plain, T1).unwrap();
        assert_eq!((tie.winner, tie.payout_yes, tie.payout_no, tie.single_source), (Winner::Yes, 10_000_000, 0, false));
        let down = settle_decision(&market(36_500_000_000, 36_499_999_999), &plain, T1).unwrap();
        assert_eq!((down.winner, down.payout_yes, down.payout_no), (Winner::No, 0, 10_000_000));
        let mut missing = market(1, 1);
        missing.close.source = 0;
        assert_eq!(settle_decision(&missing, &plain, T1).unwrap_err(), EventsError::PrintsMissing.into());
    }

    #[test]
    fn cross_check_waits_then_voids_on_divergence_or_settles_single_source() {
        let v = checked(25);
        let mut m = market(10_000_000_000, 10_100_000_000);
        // No checks yet: pending through the bound, single-source one second after.
        assert_eq!(settle_decision(&m, &v, T1 + 120).unwrap_err(), EventsError::CrossCheckPending.into());
        let late = settle_decision(&m, &v, T1 + 121).unwrap();
        assert_eq!((late.state, late.winner, late.single_source), (MarketState::Resolved, Winner::Yes, true));
        // 25 bps exactly is within tolerance; 25.0001 bps voids, even with the other check missing.
        m.check_open = print(10_025_000_000);
        assert!(settle_decision(&m, &v, T1 + 121).unwrap().single_source);
        m.check_open = print(10_025_000_001);
        let diverged = settle_decision(&m, &v, T1 + 121).unwrap();
        assert_eq!((diverged.state, diverged.void_reason, diverged.payout_yes, diverged.payout_no), (MarketState::Voided, VoidReason::CrossCheckDivergence, 5_000_000, 5_000_000));
        // Both checks present and agreeing: settles at once, before the bound, not single-source.
        m.check_open = print(10_000_000_000);
        m.check_close = print(10_099_000_000);
        let both = settle_decision(&m, &v, T1 + 1).unwrap();
        assert_eq!((both.state, both.single_source), (MarketState::Resolved, false));
    }

    #[test]
    fn void_only_after_a_missing_prints_deadline() {
        let mut m = market(1, 1);
        m.close.source = 0;
        assert_eq!(void_decision(&m, T1 + 900).unwrap_err(), EventsError::SettlementWindowOpen.into());
        assert_eq!(void_decision(&m, T1 + 901).unwrap().void_reason, VoidReason::MissingPrint);
        let complete = market(1, 1);
        assert_eq!(void_decision(&complete, T1 + 10_000).unwrap_err(), EventsError::SettlementWindowOpen.into());
        let mut no_open = market(1, 1);
        no_open.open.source = 0;
        no_open.close.source = 0;
        assert_eq!(void_decision(&no_open, T0 + 900).unwrap_err(), EventsError::SettlementWindowOpen.into());
        assert!(void_decision(&no_open, T0 + 901).is_ok(), "an open print missing past its deadline voids before lock_at");
    }

    #[test]
    fn divergence_is_exact_integer_math() {
        assert!(!diverges(10_000, 10_025, 25));
        assert!(diverges(10_000, 10_026, 25));
        assert!(diverges(10_000, 9_974, 25));
        assert!(!diverges(i64::MAX, i64::MAX, 0));
    }
}
