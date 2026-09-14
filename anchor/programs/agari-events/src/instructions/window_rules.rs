//! `roller_open_window` steps 4–10 (events-instructions.md §1.7, amended by D-013), pure over the Series,
//! the arguments and `now`, so every refusal order is unit-tested without a VM.

use anchor_lang::prelude::*;

use super::args::OpenWindowArgs;
use crate::constants::{ADMIT_UNTIL_LOCK, MAX_GAP_DURATION_SEC};
use crate::errors::EventsError;
use crate::state::{Basis, Series};

/// The frozen PD-6 deadlines (prints.md §3).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Deadlines {
    pub open_deadline: i64,
    pub close_deadline: i64,
}

pub fn check_window(series: &Series, args: &OpenWindowArgs, now: i64) -> Result<()> {
    // 4. Index.
    require!(args.index == series.next_index, EventsError::BadWindowIndex);
    // 5. Ordering and a lock still ahead.
    require!(args.trading_start < args.lock_at && args.lock_at <= args.expiry && args.lock_at > now, EventsError::BadHorizon);
    // 6. Back-to-back at most.
    require!(args.trading_start >= series.last_expiry, EventsError::WindowOverlap);
    // 7. Alignment: full clock-aligned Windows only; the Gap span is bounded.
    let basis = Basis::try_from(series.basis).map_err(|_| error!(EventsError::BadAlignment))?;
    match basis {
        Basis::Regular | Basis::Token24x7 => {
            let cadence = i64::from(series.cadence_sec);
            require!(cadence > 0, EventsError::BadAlignment);
            let span = args.expiry.checked_sub(args.trading_start).ok_or(error!(EventsError::MathOverflow))?;
            require!(
                args.trading_start.rem_euclid(cadence) == 0 && span == cadence && args.lock_at == args.expiry,
                EventsError::BadAlignment
            );
        }
        Basis::Gap => {
            let span = args.expiry.checked_sub(args.trading_start).ok_or(error!(EventsError::MathOverflow))?;
            require!(span <= MAX_GAP_DURATION_SEC, EventsError::BadHorizon);
        }
    }
    // 8. Listing horizon.
    let horizon = now.checked_add(i64::from(series.max_lead_sec)).ok_or(error!(EventsError::MathOverflow))?;
    require!(args.trading_start <= horizon, EventsError::BadHorizon);
    // 9. Boundary kinds.
    require!(args.open_kind <= 2 && args.close_kind <= 2, EventsError::BadAlignment);
    // 10. The chosen version is the highest one covering both boundaries.
    require!(args.policy_version < series.version_count, EventsError::UnknownPolicyVersion);
    require!(
        series.highest_covering_version(args.trading_start, args.expiry) == Some(args.policy_version),
        EventsError::SourceNotCovered
    );
    Ok(())
}

/// `open_deadline = lock_at` for `ADMIT_UNTIL_LOCK`, else `trading_start + open_admission_sec`;
/// `close_deadline = expiry + close_admission_sec`.
pub fn deadlines(series: &Series, args: &OpenWindowArgs) -> Result<Deadlines> {
    let primary = &series.policy_versions[usize::from(args.policy_version)].primary;
    let open_deadline = if primary.open_admission_sec == ADMIT_UNTIL_LOCK {
        args.lock_at
    } else {
        args.trading_start.checked_add(i64::from(primary.open_admission_sec)).ok_or(error!(EventsError::MathOverflow))?
    };
    let close_deadline = args.expiry.checked_add(i64::from(primary.close_admission_sec)).ok_or(error!(EventsError::MathOverflow))?;
    Ok(Deadlines { open_deadline, close_deadline })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::constants::GAP_CADENCE_SEC;
    use crate::state::PolicyVersion;
    use bytemuck::Zeroable;

    /// Fri 2026-09-25 19:50:00Z.
    const NOW: i64 = 1_790_365_800;
    const CLOSE_0925: i64 = 1_790_366_400;

    fn code(r: Result<()>) -> u32 {
        match r {
            Ok(()) => 0,
            Err(Error::AnchorError(e)) => e.error_code_number,
            Err(other) => panic!("unexpected {other:?}"),
        }
    }

    fn series(basis: u8, cadence: u32, versions: &[(i64, i64)]) -> Series {
        let mut s = Series::zeroed();
        s.basis = basis;
        s.cadence_sec = cadence;
        s.max_lead_sec = 86_400;
        for (i, (from, until)) in versions.iter().enumerate() {
            s.policy_versions[i] = PolicyVersion { valid_from_ts: *from, valid_until_ts: *until, ..Default::default() };
        }
        s.version_count = versions.len() as u8;
        s
    }

    fn window(start: i64, lock: i64, expiry: i64, version: u8) -> OpenWindowArgs {
        OpenWindowArgs { index: 0, trading_start: start, lock_at: lock, expiry, policy_version: version, open_kind: 0, close_kind: 2 }
    }

    #[test]
    fn highest_covering_version_splits_on_the_trial_close() {
        let tsla = series(0, 300, &[(1_789_084_800, CLOSE_0925), (CLOSE_0925, i64::MAX)]);
        let last = window(CLOSE_0925 - 300, CLOSE_0925, CLOSE_0925, 0);
        assert_eq!(code(check_window(&tsla, &last, NOW)), 0, "Friday's last 5m Window stays on v1");
        assert_eq!(code(check_window(&tsla, &OpenWindowArgs { policy_version: 1, ..last }, NOW)), 6013);
        let gap = series(1, GAP_CADENCE_SEC, &[(1_789_084_800, CLOSE_0925), (CLOSE_0925, i64::MAX)]);
        let (lock, monday_open) = (CLOSE_0925 + 187_200, CLOSE_0925 + 235_800);
        assert_eq!(code(check_window(&gap, &window(CLOSE_0925, lock, monday_open, 1), NOW)), 0, "the 09-25 Gap is v2 only");
        assert_eq!(code(check_window(&gap, &window(CLOSE_0925, lock, monday_open, 0), NOW)), 6013);
        let qqq = series(0, 300, &[(1_789_084_800, CLOSE_0925)]);
        assert_eq!(code(check_window(&qqq, &window(CLOSE_0925, CLOSE_0925 + 300, CLOSE_0925 + 300, 0), NOW)), 6013);
    }

    #[test]
    fn refuses_partial_misaligned_and_overlong_windows() {
        let hourly = series(0, 3_600, &[(0, i64::MAX)]);
        let open_1330 = 1_790_602_200; // Mon 2026-09-28 13:30Z
        assert_eq!(code(check_window(&hourly, &window(open_1330, open_1330 + 1_800, open_1330 + 1_800, 0), open_1330 - 60)), 6006);
        let five = series(0, 300, &[(0, i64::MAX)]);
        assert_eq!(code(check_window(&five, &window(open_1330 + 60, open_1330 + 360, open_1330 + 360, 0), open_1330)), 6006);
        assert_eq!(code(check_window(&five, &window(open_1330, open_1330 + 300, open_1330 + 600, 0), open_1330 - 60)), 6006);
        let gap = series(1, GAP_CADENCE_SEC, &[(0, i64::MAX)]);
        let too_long = window(CLOSE_0925, CLOSE_0925 + 3_600, CLOSE_0925 + MAX_GAP_DURATION_SEC + 1, 0);
        assert_eq!(code(check_window(&gap, &too_long, NOW)), 6007);
    }

    #[test]
    fn refuses_index_horizon_overlap_and_kinds_in_order() {
        let mut five = series(0, 300, &[(0, i64::MAX)]);
        let ok = window(CLOSE_0925 - 300, CLOSE_0925, CLOSE_0925, 0);
        assert_eq!(code(check_window(&five, &OpenWindowArgs { index: 1, ..ok }, NOW)), 6004);
        assert_eq!(code(check_window(&five, &ok, CLOSE_0925)), 6007, "lock_at must be ahead of now");
        five.last_expiry = CLOSE_0925;
        assert_eq!(code(check_window(&five, &ok, NOW)), 6005);
        five.last_expiry = 0;
        assert_eq!(code(check_window(&five, &ok, NOW - 90_000)), 6007, "beyond the listing horizon");
        assert_eq!(code(check_window(&five, &OpenWindowArgs { close_kind: 3, ..ok }, NOW)), 6006);
        assert_eq!(code(check_window(&five, &OpenWindowArgs { policy_version: 1, ..ok }, NOW)), 6011);
    }
}
