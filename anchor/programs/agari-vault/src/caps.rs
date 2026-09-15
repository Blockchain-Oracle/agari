//! Grant rules (vault.md §4; Masayume `EventVault.sol:258-376`) as pure functions over the zero-copy state, so the
//! place, grant and crank handlers share one copy of the money rules. Every refusal reverts the whole transaction.

use anchor_lang::prelude::*;

use agari_common::grid::PAIR_TICKS;

use crate::constants::SECONDS_PER_DAY;
use crate::errors::VaultError;
use crate::state::{Grant, VaultAccount};

/// §4 rows 1–2: not revoked, then `now ≤ expires_at_sec` (equality is live).
pub fn require_live(grant: &Grant, now: i64) -> Result<()> {
    require!(!grant.is_revoked(), VaultError::GrantIsRevoked);
    require!(now <= grant.expires_at_sec, VaultError::GrantExpired);
    Ok(())
}

/// The order's price in the bought side's own ticks (`VenueGateway.sol:112-114`). `price_ticks` is validated first.
pub fn side_ticks(outcome: u8, price_ticks: u16) -> u16 {
    if outcome == 0 {
        price_ticks
    } else {
        (PAIR_TICKS as u16).saturating_sub(price_ticks)
    }
}

/// §4 row 3: a non-zero price cap refuses a dearer own-side limit.
pub fn require_price_cap(grant: &Grant, side_ticks: u16) -> Result<()> {
    require!(grant.max_price_ticks == 0 || side_ticks <= grant.max_price_ticks, VaultError::OverPriceCap);
    Ok(())
}

/// §3.4 step 4: the worst-case escrow `lots × side_ticks × cu`, non-zero, and covered by `bucket`.
pub fn require_escrow(bucket: u64, lots: u64, side_ticks: u16, cash_unit: u64) -> Result<()> {
    let worst = u128::from(lots)
        .checked_mul(u128::from(side_ticks))
        .and_then(|v| v.checked_mul(u128::from(cash_unit)))
        .and_then(|v| u64::try_from(v).ok())
        .ok_or(VaultError::MathOverflow)?;
    require!(worst != 0, VaultError::ZeroAmount);
    require!(bucket >= worst, VaultError::Insufficient);
    Ok(())
}

/// §4 rows 6–8 on the actual charge: per-trade cap, the UTC-day cap, then the budget debit.
pub fn spend(grant: &mut Grant, spent: u64, now: i64) -> Result<()> {
    require!(spent <= grant.max_stake_per_trade, VaultError::OverStakeCap);
    let day = u64::try_from(now.div_euclid(SECONDS_PER_DAY)).map_err(|_| VaultError::MathOverflow)?;
    let today = if grant.spent_day == day { grant.spent_today } else { 0 };
    let would_be = today.checked_add(spent).ok_or(VaultError::MathOverflow)?;
    require!(would_be <= grant.max_daily_spend, VaultError::OverDailyCap);
    grant.budget = grant.budget.checked_sub(spent).ok_or(VaultError::Insufficient)?;
    grant.spent_day = day;
    grant.spent_today = would_be;
    Ok(())
}

/// §4 row 9: a side this grant opened counts against `max_open_positions`.
pub fn count_opened(grant: &mut Grant) -> Result<()> {
    let open = grant.open_positions.checked_add(1).ok_or(VaultError::MathOverflow)?;
    require!(open <= grant.max_open_positions, VaultError::OverPositionCap);
    grant.open_positions = open;
    Ok(())
}

/// `_revoke` (`EventVault.sol:292-301`): the budget returns to `available` and the kind's active slot clears.
/// Returns the amount returned, or `None` when the grant was already revoked (a no-op).
pub fn revoke(grant: &mut Grant, account: &mut VaultAccount) -> Result<Option<u64>> {
    if grant.is_revoked() {
        return Ok(None);
    }
    let returned = grant.budget;
    grant.revoked = 1;
    grant.budget = 0;
    account.available = account.available.checked_add(returned).ok_or(VaultError::MathOverflow)?;
    if let Some(active) = account.active_grants.get_mut(usize::from(grant.kind)) {
        if *active == grant.grant_id {
            *active = 0;
        }
    }
    Ok(Some(returned))
}
