//! The reserve's arithmetic, in integers only (plan §6 "no floats"; spec mirrored by
//! `packages/core/src/range/pricing.ts`, which carries the same twelve golden vectors).
//!
//! Every function here has a TypeScript twin that says "Mirrors `RangeMath.<fn>`". They must agree to the last
//! unit, because the client shows a stake and the chain charges one: a one-unit disagreement is a refused open
//! at best and a mispriced round at worst. `tests::golden` reads the same
//! `packages/core/src/range/pricing.vectors.json` the TypeScript suite does, so the two cannot drift silently.
//!
//! Division truncates toward zero in both languages (`-7 / 2 == -3`), which `z_of` depends on for prints below
//! the open. Signed intermediates are `i128`; the table and probabilities are unsigned.

/// Φ(z) × 1e6 for z = 0.00, 0.05 … 4.00 — 81 entries, generated offline from erf.
pub const CDF_TABLE_E6: [u32; 81] = [
    500_000, 519_939, 539_828, 559_618, 579_260, 598_706, 617_911, 636_831, 655_422,
    673_645, 691_462, 708_840, 725_747, 742_154, 758_036, 773_373, 788_145, 802_337,
    815_940, 828_944, 841_345, 853_141, 864_334, 874_928, 884_930, 894_350, 903_200,
    911_492, 919_243, 926_471, 933_193, 939_429, 945_201, 950_529, 955_435, 959_941,
    964_070, 967_843, 971_283, 974_412, 977_250, 979_818, 982_136, 984_222, 986_097,
    987_776, 989_276, 990_613, 991_802, 992_857, 993_790, 994_614, 995_339, 995_975,
    996_533, 997_020, 997_445, 997_814, 998_134, 998_411, 998_650, 998_856, 999_032,
    999_184, 999_313, 999_423, 999_517, 999_596, 999_663, 999_720, 999_767, 999_807,
    999_841, 999_869, 999_892, 999_912, 999_928, 999_941, 999_952, 999_961, 999_968,
];

/// The probability scale of the table and of every figure inside the maths.
pub const P_ONE: i128 = 1_000_000;
pub const BPS: i128 = 10_000;
const E8: i128 = 100_000_000;
const Z_STEP_E4: i128 = 500;
const Z_MAX_E4: i128 = 40_000;
const TABLE_LAST: usize = 80;

#[inline]
fn table_at(i: usize) -> i128 {
    CDF_TABLE_E6[i] as i128
}

/// Φ(z) × 1e6, linear between table points, saturating past |z| = 4.
pub fn cdf_e6(z_e4: i128) -> i128 {
    if z_e4 < 0 {
        return P_ONE - cdf_e6(-z_e4);
    }
    if z_e4 >= Z_MAX_E4 {
        return P_ONE;
    }
    let i = (z_e4 / Z_STEP_E4) as usize;
    let frac = z_e4 % Z_STEP_E4;
    let lo = table_at(i);
    let hi = table_at(i + 1);
    lo + ((hi - lo) * frac) / Z_STEP_E4
}

/// Φ⁻¹(p) × 1e4 for p × 1e6, clamped to ±4.
pub fn probit_e4(p_e6: i128) -> i128 {
    if p_e6 < P_ONE / 2 {
        return -probit_e4(P_ONE - p_e6);
    }
    if p_e6 >= table_at(TABLE_LAST) {
        return Z_MAX_E4;
    }
    let mut i = 0usize;
    while table_at(i + 1) <= p_e6 {
        i += 1;
    }
    let lo = table_at(i);
    let hi = table_at(i + 1);
    (i as i128) * Z_STEP_E4 + ((p_e6 - lo) * Z_STEP_E4) / (hi - lo)
}

/// ⌊√x⌋ by Newton's method, as the reference's `isqrt`.
pub fn isqrt(x: u128) -> u128 {
    if x == 0 {
        return 0;
    }
    let mut z = x / 2 + 1;
    let mut y = x;
    while z < y {
        y = z;
        z = (x / z + z) / 2;
    }
    y
}

/// σ√τ × 1e8, with two extra digits carried under the root.
pub fn std_e8(sigma_e8: i128, tau_sec: i64) -> i128 {
    let tau = (tau_sec.max(0) as u128) * 10_000;
    (sigma_e8 * isqrt(tau) as i128) / 100
}

/// A print's distance from the opening print in standard deviations, × 1e4. Truncates toward zero.
pub fn z_of(print: i128, opening_print: i128, std: i128) -> i128 {
    if opening_print == 0 || std == 0 {
        return 0;
    }
    let rel_e8 = ((print - opening_print) * E8) / opening_print;
    (rel_e8 * 10_000) / std
}

/// P(low ≤ close ≤ high) × 1e6, with the market sitting at `center_q_e6`.
pub fn band_prob_e6(opening_print: i128, low_print: i128, high_print: i128, center_q_e6: i128, sigma_e8: i128, tau_sec: i64) -> i128 {
    let std = std_e8(sigma_e8, tau_sec);
    let mu = probit_e4(center_q_e6);
    let upper = cdf_e6(z_of(high_print, opening_print, std) - mu);
    let lower = cdf_e6(z_of(low_print, opening_print, std) - mu);
    if upper > lower {
        upper - lower
    } else {
        0
    }
}

/// The chosen side's fair probability per whole unit of collateral. `inside` wins in the band.
pub fn side_prob_raw(inside_prob_e6: i128, is_inside: bool, one: i128) -> i128 {
    let p_e6 = if is_inside { inside_prob_e6 } else { P_ONE - inside_prob_e6 };
    (p_e6 * one) / P_ONE
}

#[inline]
fn ceil_div(a: i128, b: i128) -> i128 {
    if b == 0 {
        return 0;
    }
    (a + b - 1) / b
}

/// Fair value plus the margin, both rounded up in the reserve's favour.
pub fn floor_stake(max_payout_base: i128, prob_raw: i128, one: i128, margin_bps: i128) -> i128 {
    let fair = ceil_div(max_payout_base * prob_raw, one);
    ceil_div(fair * (BPS + margin_bps), BPS)
}

#[cfg(test)]
mod tests;
