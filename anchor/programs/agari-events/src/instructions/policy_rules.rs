//! `admin_add_policy_version` validation (prints.md §2.2, amended by D-013). Pure: every refusal is `BadPolicy`.

use anchor_lang::prelude::*;

use crate::constants::ADMIT_UNTIL_LOCK;
use crate::errors::EventsError;
use crate::state::{Basis, PolicyVersion, PrintPolicy, Source};

/// What validation needs from the Series and GlobalConfig.
#[derive(Clone, Copy, Debug)]
pub struct PolicyContext {
    pub basis: u8,
    pub redstone_signer_count: u8,
    pub redstone_threshold: u8,
}

fn ok_if(cond: bool) -> Result<()> {
    if cond {
        Ok(())
    } else {
        err!(EventsError::BadPolicy)
    }
}

/// Per-source rules shared by the primary and the check policy (prints.md §2.2 item 3).
fn check_source_rules(p: &PrintPolicy, ctx: &PolicyContext) -> Result<()> {
    let source = Source::try_from(p.source).map_err(|_| error!(EventsError::BadPolicy))?;
    ok_if(p.feed_id != [0u8; 32])?;
    match source {
        Source::None => err!(EventsError::BadPolicy),
        Source::Pyth => ok_if((1..=60).contains(&p.grace_sec) && (1..=10_000).contains(&p.max_conf_bps) && p.min_delay_sec == 0),
        Source::RedStone => ok_if(
            p.strict_sec >= 1
                && p.min_delay_sec == 0
                && p.feed_id[0] != 0
                && ctx.redstone_threshold >= 1
                && ctx.redstone_signer_count >= ctx.redstone_threshold,
        ),
        Source::Switchboard => ok_if(
            p.min_delay_sec >= 1
                && p.max_slot_age >= 1
                && p.open_admission_sec > u32::from(p.min_delay_sec)
                && p.close_admission_sec > u32::from(p.min_delay_sec),
        ),
        Source::Attested => ok_if(
            p.bar_len_sec >= 1
                && p.min_delay_sec >= 1
                && p.open_admission_sec > u32::from(p.min_delay_sec)
                && p.close_admission_sec > u32::from(p.min_delay_sec),
        ),
    }
}

pub fn validate_policy_version(v: &PolicyVersion, ctx: &PolicyContext) -> Result<()> {
    // 1. Validity range.
    ok_if(v.valid_from_ts < v.valid_until_ts)?;

    // 2. Primary admissions; ADMIT_UNTIL_LOCK only for the Gap open.
    let p = &v.primary;
    ok_if(p.close_admission_sec >= 1 && p.close_admission_sec != ADMIT_UNTIL_LOCK && p.open_admission_sec >= 1)?;
    if p.open_admission_sec == ADMIT_UNTIL_LOCK {
        ok_if(ctx.basis == u8::from(Basis::Gap))?;
    }
    // 3. Primary per-source rules (also rejects source None and a zero feed id).
    check_source_rules(p, ctx)?;

    // 4. Check policy.
    let c = &v.check;
    if c.source == u8::from(Source::None) {
        return ok_if(*c == PrintPolicy::default() && v.max_divergence_bps == 0 && v.check_admission_sec == 0);
    }
    ok_if(c.source != p.source)?;
    check_source_rules(c, ctx)?;
    // A check's deadlines are `T + check_admission_sec`, never "until lock" (D-019).
    ok_if(
        v.check_admission_sec >= 1
            && v.check_admission_sec != ADMIT_UNTIL_LOCK
            && c.open_admission_sec == v.check_admission_sec
            && c.close_admission_sec == v.check_admission_sec
            && (1..=10_000).contains(&v.max_divergence_bps),
    )?;
    // D-013: the RedStone liveness threshold must be reachable inside the check window.
    if c.source == u8::from(Source::RedStone) {
        ok_if(c.strict_sec < v.check_admission_sec)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    const REGULAR: PolicyContext = PolicyContext { basis: 0, redstone_signer_count: 5, redstone_threshold: 3 };

    fn feed(tag: &[u8]) -> [u8; 32] {
        let mut f = [0u8; 32];
        f[..tag.len()].copy_from_slice(tag);
        f
    }

    fn pyth() -> PrintPolicy {
        PrintPolicy { source: 1, grace_sec: 5, feed_id: [0x16; 32], max_conf_bps: 50, open_admission_sec: 900, close_admission_sec: 900, ..Default::default() }
    }

    fn redstone(admission: u32, strict: u32) -> PrintPolicy {
        PrintPolicy { source: 2, feed_id: feed(b"TSLA"), strict_sec: strict, open_admission_sec: admission, close_admission_sec: admission, ..Default::default() }
    }

    fn tsla_v1() -> PolicyVersion {
        PolicyVersion {
            valid_from_ts: 1_789_084_800,
            valid_until_ts: 1_790_366_400,
            primary: pyth(),
            check: redstone(120, 60),
            max_divergence_bps: 25,
            check_admission_sec: 120,
            ..Default::default()
        }
    }

    fn refused(v: &PolicyVersion, ctx: &PolicyContext) -> bool {
        matches!(validate_policy_version(v, ctx), Err(Error::AnchorError(e)) if e.error_code_number == 6014)
    }

    #[test]
    fn accepts_the_launch_versions() {
        validate_policy_version(&tsla_v1(), &REGULAR).unwrap();
        let v2 = PolicyVersion { valid_from_ts: 1_790_366_400, valid_until_ts: i64::MAX, primary: redstone(900, 300), ..Default::default() };
        validate_policy_version(&v2, &REGULAR).unwrap();
        let gap = PolicyContext { basis: 1, ..REGULAR };
        let mut gap_v2 = v2;
        gap_v2.primary.open_admission_sec = ADMIT_UNTIL_LOCK;
        validate_policy_version(&gap_v2, &gap).unwrap();
    }

    #[test]
    fn refuses_what_would_weaken_a_print() {
        let mut v = tsla_v1();
        v.check.strict_sec = 120;
        assert!(refused(&v, &REGULAR), "RedStone check strict_sec must be below check_admission_sec (D-013)");
        let mut v = tsla_v1();
        v.check = pyth();
        v.check.open_admission_sec = 120;
        v.check.close_admission_sec = 120;
        assert!(refused(&v, &REGULAR), "check source must differ from the primary");
        let mut v = tsla_v1();
        v.primary.open_admission_sec = ADMIT_UNTIL_LOCK;
        assert!(refused(&v, &REGULAR), "ADMIT_UNTIL_LOCK is Gap-only");
        let mut v = tsla_v1();
        v.valid_until_ts = v.valid_from_ts;
        assert!(refused(&v, &REGULAR));
        let mut v = tsla_v1();
        v.check.open_admission_sec = 121;
        assert!(refused(&v, &REGULAR), "check admissions must equal check_admission_sec");
        let mut v = tsla_v1();
        v.primary.grace_sec = 61;
        assert!(refused(&v, &REGULAR));
        let mut v = tsla_v1();
        v.check = PrintPolicy::default();
        assert!(refused(&v, &REGULAR), "no check means divergence and check admission are zero too");
        let few_signers = PolicyContext { redstone_signer_count: 2, ..REGULAR };
        assert!(refused(&tsla_v1(), &few_signers));
        let mut v = tsla_v1();
        v.primary.feed_id = [0; 32];
        assert!(refused(&v, &REGULAR));
    }
}
