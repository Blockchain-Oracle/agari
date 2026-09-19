//! One multi-leg ticket and the order its legs are decided in.

use anchor_lang::prelude::*;

use crate::constants::MAX_LEGS;
use crate::errors::ParlayError;
use crate::state::Settled;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum LegStatus {
    Pending,
    Won,
    Lost,
    Void,
}

/// One leg, frozen at open: the Window, the side, the price it was bought at, and when it decides.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace, Debug)]
pub struct ParlayLeg {
    pub market: Pubkey,
    /// True for a call that the close is at or above the open.
    pub is_up: bool,
    pub status: LegStatus,
    pub expiry_sec: i64,
    pub resolved_at_sec: i64,
    /// Collateral per whole contract of the chosen side at open: this leg's priced win probability.
    pub price_raw: u64,
}

/// In the client's enum order (`PARLAY_STATUSES`).
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum ParlayStatus {
    Live,
    Won,
    Lost,
    Void,
    Claimed,
}

/// PDA `["ticket", parlay_id u64 LE]`.
#[account]
#[derive(InitSpace)]
pub struct ParlayTicket {
    pub reserve: Pubkey,
    pub owner: Pubkey,
    pub parlay_id: u64,
    pub status: ParlayStatus,
    pub leg_count: u8,
    pub won_count: u8,
    #[max_len(MAX_LEGS)]
    pub legs: Vec<ParlayLeg>,
    pub opened_at_sec: i64,
    pub settled_at_sec: i64,
    /// The latest boundary any leg settles on; the stale sweep counts its grace from here.
    pub last_expiry_sec: i64,
    pub stake_base: u64,
    pub max_payout_base: u64,
    pub house_locked_base: u64,
    pub combined_prob_raw: u64,
    /// What a claim paid: the payout for a win, the stake for a void.
    pub claimed_base: u64,
    pub bump: u8,
}

impl ParlayTicket {
    pub fn expiries(&self) -> Vec<i64> {
        self.legs.iter().map(|leg| leg.expiry_sec).collect()
    }

    /// The one leg that may be decided next: the pending leg with the earliest boundary, lowest index first.
    ///
    /// Legs are decided in the order their Windows close, not the order somebody chooses to crank them in. A
    /// ticket with one lost leg and one voided leg would otherwise end Lost or refunded depending on who got
    /// there first, and its owner would always get there first. Decided in boundary order, a ticket's fate is a
    /// function of what the venue recorded and nothing else.
    pub fn next_leg(&self) -> Option<usize> {
        self.legs
            .iter()
            .enumerate()
            .filter(|(_, leg)| leg.status == LegStatus::Pending)
            .min_by_key(|(idx, leg)| (leg.expiry_sec, *idx))
            .map(|(idx, _)| idx)
    }

    /// Records one leg's outcome and says how the ticket finished, if this leg finished it. A lost leg kills the
    /// ticket, a voided Window voids it, and the last winning leg makes it claimable.
    pub fn apply_leg(&mut self, leg_idx: usize, outcome: LegStatus, now: i64) -> std::result::Result<Option<Settled>, ParlayError> {
        if self.status != ParlayStatus::Live {
            return Err(ParlayError::TicketNotLive);
        }
        if outcome == LegStatus::Pending {
            return Err(ParlayError::LegNotSettled);
        }
        if self.next_leg() != Some(leg_idx) {
            return Err(ParlayError::LegOutOfOrder);
        }
        let leg = self.legs.get_mut(leg_idx).ok_or(ParlayError::WrongLeg)?;
        leg.status = outcome;
        leg.resolved_at_sec = now;

        let settled = match outcome {
            LegStatus::Won => {
                self.won_count = self.won_count.saturating_add(1);
                (self.won_count == self.leg_count).then_some(Settled::Won)
            }
            LegStatus::Lost => Some(Settled::Lost),
            _ => Some(Settled::Void),
        };
        if let Some(how) = settled {
            self.finish(how, now);
        }
        Ok(settled)
    }

    pub fn finish(&mut self, how: Settled, now: i64) {
        self.settled_at_sec = now;
        self.status = match how {
            Settled::Won => ParlayStatus::Won,
            Settled::Lost => ParlayStatus::Lost,
            Settled::Void => ParlayStatus::Void,
        };
    }

    /// What a claim pays: the whole payout for a win, the stake back for a void.
    pub fn claimable_base(&self) -> std::result::Result<u64, ParlayError> {
        match self.status {
            ParlayStatus::Won => Ok(self.max_payout_base),
            ParlayStatus::Void => Ok(self.stake_base),
            ParlayStatus::Live => Err(ParlayError::TicketNotSettled),
            ParlayStatus::Lost | ParlayStatus::Claimed => Err(ParlayError::NothingToClaim),
        }
    }
}
