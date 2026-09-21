//! The registry's records, and its two rules as pure functions: what an envelope admits, and what may be sealed.
//!
//! Fixed-width fields come first and the metadata last, so a reader can filter accounts by creator, runner or
//! strategy id with a `memcmp` at a known offset without decoding the text.

use agari_vault::state::Grant;
use anchor_lang::prelude::*;

use crate::constants::{GRANT_KIND_STRATEGY, MAX_METADATA_LEN};
use crate::errors::StrategyError;

/// The ceilings a creator publishes and never changes: subscribers agreed to them. Mirrors `agari-vault`'s caps.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace, Debug, Default, PartialEq, Eq)]
pub struct Envelope {
    pub max_stake_per_trade: u64,
    pub max_daily_spend: u64,
    pub max_open_positions: u32,
    /// Dearest own-side price in ticks; 0 = the strategy sets no price ceiling.
    pub max_price_ticks: u16,
}

impl Envelope {
    pub fn validate(&self) -> std::result::Result<(), StrategyError> {
        if self.max_stake_per_trade == 0 || self.max_daily_spend == 0 || self.max_open_positions == 0 {
            return Err(StrategyError::BadEnvelope);
        }
        Ok(())
    }

    /// A grant sits inside the envelope when every ceiling it carries is at or under the envelope's. The vault's
    /// "no cap" is `u64::MAX`, which no finite envelope admits. A price ceiling works the other way about: 0 means
    /// none, so an envelope that sets one refuses a grant that sets none.
    pub fn admits(&self, grant: &Envelope) -> bool {
        grant.max_stake_per_trade <= self.max_stake_per_trade
            && grant.max_daily_spend <= self.max_daily_spend
            && grant.max_open_positions <= self.max_open_positions
            && (self.max_price_ticks == 0 || (grant.max_price_ticks != 0 && grant.max_price_ticks <= self.max_price_ticks))
    }
}

/// PDA `["registry"]`.
#[account]
#[derive(InitSpace)]
pub struct Registry {
    pub admin: Pubkey,
    pub collateral_mint: Pubkey,
    /// 1-based, as the reference counts them: 0 means "none".
    pub next_strategy_id: u64,
    pub bump: u8,
}

/// PDA `["strategy", strategy_id u64 LE]`.
#[account]
#[derive(InitSpace)]
pub struct Strategy {
    pub creator: Pubkey,
    pub runner: Pubkey,
    pub strategy_id: u64,
    pub spec_hash: [u8; 32],
    /// sha256 of the whole metadata string, declared before a byte of it is written.
    pub metadata_hash: [u8; 32],
    pub envelope: Envelope,
    pub subscription_fee_base: u64,
    pub created_at_sec: i64,
    pub subscribers: u32,
    pub revision: u32,
    pub active: bool,
    /// The metadata written so far hashes to `metadata_hash`. Nobody may subscribe to text the creator has not
    /// finished committing to.
    pub sealed: bool,
    pub bump: u8,
    #[max_len(MAX_METADATA_LEN)]
    pub metadata: Vec<u8>,
}

impl Strategy {
    /// Starts a revision's text over at `len` zero bytes, unsealed.
    pub fn begin_metadata(&mut self, metadata_hash: [u8; 32], len: usize) -> std::result::Result<(), StrategyError> {
        if len == 0 || len > MAX_METADATA_LEN {
            return Err(StrategyError::MetadataTooLong);
        }
        self.metadata_hash = metadata_hash;
        self.metadata = vec![0u8; len];
        self.sealed = false;
        Ok(())
    }

    pub fn write_metadata(&mut self, offset: usize, chunk: &[u8]) -> std::result::Result<(), StrategyError> {
        if self.sealed {
            return Err(StrategyError::AlreadySealed);
        }
        let end = offset.checked_add(chunk.len()).ok_or(StrategyError::WriteOutOfBounds)?;
        let target = self.metadata.get_mut(offset..end).ok_or(StrategyError::WriteOutOfBounds)?;
        target.copy_from_slice(chunk);
        Ok(())
    }

    /// Seals against a digest the caller computed over `self.metadata`; the instruction computes it with the sha256
    /// syscall, the tests with the same crate off chain.
    pub fn seal(&mut self, digest: [u8; 32]) -> std::result::Result<(), StrategyError> {
        if digest != self.metadata_hash {
            return Err(StrategyError::MetadataMismatch);
        }
        self.sealed = true;
        Ok(())
    }

    pub fn takes_subscribers(&self) -> std::result::Result<(), StrategyError> {
        if !self.active {
            return Err(StrategyError::StrategyInactive);
        }
        if !self.sealed {
            return Err(StrategyError::NotSealed);
        }
        Ok(())
    }
}

/// PDA `["subscription", strategy_id u64 LE, subscriber]`. Kept after an unsubscribe, so a wallet's history with a
/// strategy survives and re-subscribing reuses it.
#[account]
#[derive(InitSpace)]
pub struct Subscription {
    pub strategy_id: u64,
    pub subscriber: Pubkey,
    /// The vault Grant account this consent rests on.
    pub grant: Pubkey,
    pub grant_id: u64,
    pub subscribed_at_sec: i64,
    pub active: bool,
    pub bump: u8,
}

/// PDA `["fade", strategy_id u64 LE, subscriber]` — the same consent as a `Subscription`, in the other direction:
/// the runner places the opposite of what the strategy decided, for this subscriber only.
///
/// Its own account type rather than a flag on `Subscription`, for two reasons. The live accounts on chain were
/// sized without it and would stop deserializing the day the field appeared; and a wallet that signed "follow this
/// strategy" has not consented to the opposite of it, so the two are different records, not one record with a
/// setting. A wallet may hold at most one of them active per strategy, which both instructions enforce.
#[account]
#[derive(InitSpace)]
pub struct FadeSubscription {
    pub strategy_id: u64,
    pub subscriber: Pubkey,
    /// The vault Grant account this consent rests on.
    pub grant: Pubkey,
    pub grant_id: u64,
    pub subscribed_at_sec: i64,
    pub active: bool,
    pub bump: u8,
}

/// One wallet's consent to be traded for, in either direction. Both records answer it the same way, so the guard
/// that refuses a wallet holding both can read either one without knowing which it has.
pub trait Consent {
    fn is_active(&self) -> bool;
}

impl Consent for Subscription {
    fn is_active(&self) -> bool {
        self.active
    }
}

impl Consent for FadeSubscription {
    fn is_active(&self) -> bool {
        self.active
    }
}

/// What a vault Grant has to be for `subscriber` to follow `strategy` with it: theirs, a strategy grant, naming this
/// runner, live by the vault's own rule (`caps::require_live`), and inside the envelope.
pub fn eligible_grant(grant: &Grant, strategy: &Strategy, subscriber: &Pubkey, now: i64) -> std::result::Result<(), StrategyError> {
    if grant.owner != *subscriber {
        return Err(StrategyError::NotGrantOwner);
    }
    if grant.kind != GRANT_KIND_STRATEGY {
        return Err(StrategyError::WrongGrantKind);
    }
    if grant.actor != strategy.runner {
        return Err(StrategyError::WrongActor);
    }
    if grant.is_revoked() || now > grant.expires_at_sec {
        return Err(StrategyError::GrantNotLive);
    }
    let caps = Envelope {
        max_stake_per_trade: grant.max_stake_per_trade,
        max_daily_spend: grant.max_daily_spend,
        max_open_positions: grant.max_open_positions,
        max_price_ticks: grant.max_price_ticks,
    };
    if !strategy.envelope.admits(&caps) {
        return Err(StrategyError::CapsOutsideEnvelope);
    }
    Ok(())
}

#[cfg(test)]
mod tests;
