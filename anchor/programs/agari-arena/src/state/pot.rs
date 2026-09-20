use anchor_lang::prelude::*;

use crate::errors::ArenaError;
use crate::state::arena::Booked;
use crate::state::{full_mask, Arena, Credit, Finalized, GameMatch, MatchStatus, RefundReason};

/// Settlement, the pot, and the ways a pot goes home. Kept apart from the entry and the picks because nothing here
/// depends on a clock running against a player: every one of these can be cranked by anyone, at any time after its
/// condition holds, and pays only the players the match already names.
impl Arena {
    // ------------------------------------------------------------------ settlement

    pub fn settle_guard(&self, m: &GameMatch, card_index: u8) -> Booked {
        if m.status == MatchStatus::Waiting || m.status == MatchStatus::ActiveUnrevealed {
            return Err(ArenaError::WrongStatus);
        }
        if card_index >= m.deck_size {
            return Err(ArenaError::BadCard);
        }
        if m.settled_mask & (1u8 << card_index) != 0 {
            return Err(ArenaError::AlreadySettled);
        }
        Ok(())
    }

    /// One seat's pick on a settled card: the venue paid `payout_base` into custody, and it is the player's.
    pub fn book_settle_pick(&mut self, m: &mut GameMatch, card_index: u8, seat: usize, payout_base: u64, credit: &mut Credit) -> Booked<i64> {
        let rec = &mut m.picks[usize::from(card_index) * 2 + seat];
        rec.settled = true;
        rec.payout_base = payout_base;
        let pnl = i64::try_from(payout_base).map_err(|_| ArenaError::MathOverflow)?.checked_sub(i64::try_from(rec.cost_base).map_err(|_| ArenaError::MathOverflow)?).ok_or(ArenaError::MathOverflow)?;
        m.pnl_base[seat] = m.pnl_base[seat].checked_add(pnl).ok_or(ArenaError::MathOverflow)?;
        self.book_credit(credit, payout_base)?;
        Ok(pnl)
    }

    /// Awards the pot once every played card is settled. Only the side-pot is allocated here; the market payouts
    /// were credited card by card. A tie splits, and an odd unit goes to the creator so the split is deterministic.
    pub fn book_finalize(&mut self, m: &mut GameMatch, creator_credit: &mut Credit, challenger_credit: &mut Credit) -> Booked<Finalized> {
        if m.status != MatchStatus::Settling && m.status != MatchStatus::Forfeited {
            return Err(ArenaError::WrongStatus);
        }
        if (m.picked_mask0 | m.picked_mask1) & !m.settled_mask != 0 {
            return Err(ArenaError::CardsOutstanding);
        }
        let winner = if m.status == MatchStatus::Forfeited {
            Some(if m.mask(0) == full_mask(m.deck_size) { m.creator } else { m.challenger })
        } else if m.pnl_base[0] != m.pnl_base[1] {
            Some(if m.pnl_base[0] > m.pnl_base[1] { m.creator } else { m.challenger })
        } else {
            None
        };
        m.status = MatchStatus::Finalized;
        let pot_base = m.pot_base.checked_mul(2).ok_or(ArenaError::MathOverflow)?;
        let (creator_base, challenger_base) = match winner {
            Some(w) if w == m.creator => (pot_base, 0),
            Some(_) => (0, pot_base),
            None => (pot_base - pot_base / 2, pot_base / 2),
        };
        self.escrowed_base = self.escrowed_base.saturating_sub(pot_base);
        self.book_credit(creator_credit, creator_base)?;
        self.book_credit(challenger_credit, challenger_base)?;
        Ok(Finalized { winner, creator_base, challenger_base, pot_base })
    }

    // ------------------------------------------------------------------ the ways out

    /// The creator withdraws a match nobody has joined, or anyone returns it once the join window has closed.
    pub fn book_refund_unjoined(&mut self, m: &mut GameMatch, creator_credit: &mut Credit, by: Option<&Pubkey>, now: i64) -> Booked<RefundReason> {
        if m.status != MatchStatus::Waiting {
            return Err(ArenaError::WrongStatus);
        }
        let reason = match by {
            Some(who) if *who == m.creator => RefundReason::CreatorCancelled,
            Some(_) => return Err(ArenaError::NotAPlayer),
            None if now <= m.created_at_sec.saturating_add(i64::from(self.params.join_window_sec)) => return Err(ArenaError::DeadlineNotPassed),
            None => RefundReason::JoinTimeout,
        };
        m.status = MatchStatus::Refunded;
        self.escrowed_base = self.escrowed_base.saturating_sub(m.pot_base);
        self.book_credit(creator_credit, m.pot_base)?;
        Ok(reason)
    }

    /// Anyone may return both pots when the deck was never opened. Losing the reveal material is an operator failure,
    /// so it refunds and punishes no player.
    pub fn book_refund_unrevealed(&mut self, m: &mut GameMatch, creator_credit: &mut Credit, challenger_credit: &mut Credit, now: i64) -> Booked {
        if m.status != MatchStatus::ActiveUnrevealed {
            return Err(ArenaError::WrongStatus);
        }
        if now <= m.joined_at_sec.saturating_add(i64::from(self.params.reveal_window_sec)) {
            return Err(ArenaError::DeadlineNotPassed);
        }
        self.refund_both(m, creator_credit, challenger_credit)
    }

    pub(crate) fn refund_both(&mut self, m: &mut GameMatch, creator_credit: &mut Credit, challenger_credit: &mut Credit) -> Booked {
        m.status = MatchStatus::Refunded;
        self.escrowed_base = self.escrowed_base.saturating_sub(m.pot_base.saturating_mul(2));
        self.book_credit(creator_credit, m.pot_base)?;
        self.book_credit(challenger_credit, m.pot_base)
    }

    /// When a seat's key may be emptied by anyone: once the pick phase is over, or the key has expired.
    pub fn agent_releasable(m: &GameMatch, expires_at_sec: i64, now: i64) -> bool {
        !matches!(m.status, MatchStatus::Waiting | MatchStatus::ActiveUnrevealed | MatchStatus::Picking) || now > expires_at_sec
    }
}
