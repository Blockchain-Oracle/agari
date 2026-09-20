use anchor_lang::prelude::*;

use crate::constants::MAX_DECK;
use crate::errors::ArenaError;
use crate::state::arena::{add, Booked};
use crate::state::{Arena, ArenaParams, Credit};

/// WAITING until the challenger joins; ACTIVE_UNREVEALED until the deck is opened; PICKING while both players still
/// owe cards; then SETTLING (both complete), FORFEITED (one absent) or REFUNDED (nobody's fault). FINALIZED is the
/// pot's terminal state. Cards may settle in any of the last four, because a match that lost its pot still owns real
/// positions on the book. The order is `packages/core/src/games/types.ts`'s `ARENA_STATUSES`.
#[derive(AnchorSerialize, AnchorDeserialize, InitSpace, Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum MatchStatus {
    #[default]
    Waiting,
    ActiveUnrevealed,
    Picking,
    Settling,
    Finalized,
    Refunded,
    Forfeited,
}

/// Why a pot went home instead of being won. The order is core's `ARENA_REFUND_REASONS`.
#[derive(AnchorSerialize, AnchorDeserialize, InitSpace, Clone, Copy, Debug, PartialEq, Eq)]
pub enum RefundReason {
    CreatorCancelled,
    JoinTimeout,
    RevealUnavailable,
    BothIncomplete,
}

/// What the engine reported around one IOC, and what the redemption later paid for it. Never the quote a player was shown.
#[derive(AnchorSerialize, AnchorDeserialize, InitSpace, Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct PickRecord {
    pub placed: bool,
    pub settled: bool,
    pub outcome: u8,
    pub lots: u64,
    pub lot_base: u64,
    pub cost_base: u64,
    pub payout_base: u64,
}

/// `creator` and `challenger` are the payout addresses too. They are never rewritten, so a compromised key cannot
/// redirect a pot (AD-5).
#[account]
#[derive(InitSpace)]
pub struct GameMatch {
    pub match_id: [u8; 32],
    pub creator: Pubkey,
    pub challenger: Pubkey,
    pub tier: u8,
    pub status: MatchStatus,
    pub deck_size: u8,
    /// One bit per card, per seat: set when that seat's pick is on the book.
    pub picked_mask0: u8,
    pub picked_mask1: u8,
    /// One bit per card: set when both seats' picks on it have been redeemed.
    pub settled_mask: u8,
    /// Bumped whenever the deck-selection rules change; part of the commitment preimage.
    pub policy_version: u32,
    pub deck_hash: [u8; 32],
    pub created_at_sec: i64,
    pub joined_at_sec: i64,
    pub revealed_at_sec: i64,
    pub pick_deadline_sec: i64,
    pub pot_base: u64,
    pub per_card_cap_base: u64,
    pub cards: [Pubkey; MAX_DECK],
    /// Keyed `card_index × 2 + seat`, so one card's two picks sit beside each other.
    pub picks: [PickRecord; MAX_DECK * 2],
    /// `payout − cost` summed over settled cards, per seat.
    pub pnl_base: [i64; 2],
    pub bump: u8,
}

impl Default for GameMatch {
    fn default() -> Self {
        Self {
            match_id: [0; 32], creator: Pubkey::default(), challenger: Pubkey::default(), tier: 0, status: MatchStatus::Waiting, deck_size: 0,
            picked_mask0: 0, picked_mask1: 0, settled_mask: 0, policy_version: 0, deck_hash: [0; 32], created_at_sec: 0, joined_at_sec: 0,
            revealed_at_sec: 0, pick_deadline_sec: 0, pot_base: 0, per_card_cap_base: 0, cards: [Pubkey::default(); MAX_DECK],
            picks: [PickRecord::default(); MAX_DECK * 2], pnl_base: [0; 2], bump: 0,
        }
    }
}

/// How a pick window closed.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Locked {
    Settling,
    /// The key of the seat that never finished.
    Forfeited(Pubkey),
    /// Both absent is nobody's win, so both pots went home.
    Refunded,
}

/// Who takes the pot. `None` is a tie, which splits.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Finalized {
    pub winner: Option<Pubkey>,
    pub creator_base: u64,
    pub challenger_base: u64,
    pub pot_base: u64,
}

pub fn full_mask(deck_size: u8) -> u8 {
    ((1u16 << deck_size) - 1) as u8
}

impl GameMatch {
    pub fn exists(&self) -> bool {
        self.creator != Pubkey::default()
    }

    pub fn seat_of(&self, who: &Pubkey) -> Booked<usize> {
        if *who == self.creator {
            Ok(0)
        } else if *who == self.challenger {
            Ok(1)
        } else {
            Err(ArenaError::NotAPlayer)
        }
    }

    pub fn player(&self, seat: usize) -> Pubkey {
        if seat == 0 {
            self.creator
        } else {
            self.challenger
        }
    }

    fn mask(&self, seat: usize) -> u8 {
        if seat == 0 {
            self.picked_mask0
        } else {
            self.picked_mask1
        }
    }

    /// The deck's own ceiling for one seat's key: every card at the tier's cap.
    pub fn agent_budget_base(&self) -> Booked<u64> {
        self.per_card_cap_base.checked_mul(u64::from(self.deck_size)).ok_or(ArenaError::MathOverflow)
    }

    pub fn pick(&self, card_index: u8, seat: usize) -> &PickRecord {
        &self.picks[usize::from(card_index) * 2 + seat]
    }
}

impl Arena {
    // ------------------------------------------------------------------ entry

    /// Opens a match against one named opponent. The challenger is named at creation: the deck commitment is taken
    /// over both players' client seeds, which only exist once they are paired, so an open match a stranger could join
    /// would publish a commitment binding a seed that stranger never chose.
    #[allow(clippy::too_many_arguments)]
    pub fn book_create(&mut self, m: &mut GameMatch, match_id: [u8; 32], creator: Pubkey, challenger: Pubkey, tier: u8, deck_hash: [u8; 32], deck_size: u8, policy_version: u32, now: i64) -> Booked<u64> {
        if self.paused {
            return Err(ArenaError::Paused);
        }
        if challenger == Pubkey::default() || challenger == creator {
            return Err(ArenaError::SelfJoin);
        }
        if deck_hash == [0; 32] {
            return Err(ArenaError::DeckMismatch);
        }
        if m.exists() {
            return Err(ArenaError::MatchExists);
        }
        if deck_size < self.params.min_deck_size || deck_size > self.params.max_deck_size {
            return Err(ArenaError::BadDeckSize);
        }
        let t = self.tier(tier)?;
        *m = GameMatch { match_id, creator, challenger, tier, status: MatchStatus::Waiting, deck_size, policy_version, deck_hash, created_at_sec: now, pot_base: t.pot_base, per_card_cap_base: t.per_card_cap_base, bump: m.bump, ..GameMatch::default() };
        self.escrowed_base = add(self.escrowed_base, t.pot_base)?;
        Ok(t.pot_base)
    }

    /// The named challenger matches the pot. Nothing else can be joined.
    pub fn book_join(&mut self, m: &mut GameMatch, challenger: &Pubkey, now: i64) -> Booked<u64> {
        if self.paused {
            return Err(ArenaError::Paused);
        }
        if m.status != MatchStatus::Waiting {
            return Err(ArenaError::WrongStatus);
        }
        if *challenger != m.challenger {
            return Err(ArenaError::NotAPlayer);
        }
        if now > m.created_at_sec.saturating_add(i64::from(self.params.join_window_sec)) {
            return Err(ArenaError::DeadlinePassed);
        }
        m.status = MatchStatus::ActiveUnrevealed;
        m.joined_at_sec = now;
        self.escrowed_base = add(self.escrowed_base, m.pot_base)?;
        Ok(m.pot_base)
    }

    /// Opens the deck. The caller has already checked the commitment and that every card is a live Window with room
    /// left to play; this records them and starts the pick clock.
    pub fn book_reveal(&self, m: &mut GameMatch, cards: &[Pubkey], now: i64) -> Booked {
        if m.status != MatchStatus::ActiveUnrevealed {
            return Err(ArenaError::WrongStatus);
        }
        if now > m.joined_at_sec.saturating_add(i64::from(self.params.reveal_window_sec)) {
            return Err(ArenaError::DeadlinePassed);
        }
        if cards.len() != usize::from(m.deck_size) {
            return Err(ArenaError::BadDeckSize);
        }
        for (i, card) in cards.iter().enumerate() {
            // The same Window twice is not a deck: both cards would settle on one print, so a player who read it
            // right once is paid twice for one call and the match stops measuring skill.
            if cards[..i].contains(card) {
                return Err(ArenaError::DuplicateCard);
            }
            m.cards[i] = *card;
        }
        m.status = MatchStatus::Picking;
        m.revealed_at_sec = now;
        m.pick_deadline_sec = now.saturating_add(i64::from(self.params.pick_window_sec));
        Ok(())
    }

    // ------------------------------------------------------------------ the picks

    /// Everything about a pick that can be refused before money moves. Returns the seat.
    pub fn pick_guard(&self, m: &GameMatch, player: &Pubkey, card_index: u8, stake_base: u64, now: i64) -> Booked<usize> {
        if self.paused {
            return Err(ArenaError::Paused);
        }
        if m.status != MatchStatus::Picking {
            return Err(ArenaError::WrongStatus);
        }
        if now > m.pick_deadline_sec {
            return Err(ArenaError::DeadlinePassed);
        }
        let seat = m.seat_of(player)?;
        if card_index >= m.deck_size {
            return Err(ArenaError::BadCard);
        }
        if stake_base == 0 {
            return Err(ArenaError::ZeroAmount);
        }
        if stake_base > m.per_card_cap_base {
            return Err(ArenaError::StakeAboveCap);
        }
        if m.pick(card_index, seat).placed {
            return Err(ArenaError::AlreadyPicked);
        }
        Ok(seat)
    }

    /// Records a confirmed fill. Returns true when this was the last pick, which locks the match by itself so a
    /// complete deck never waits on a crank.
    #[allow(clippy::too_many_arguments)]
    pub fn book_pick(&self, m: &mut GameMatch, seat: usize, card_index: u8, outcome: u8, lots: u64, lot_base: u64, cost_base: u64, stake_base: u64) -> Booked<bool> {
        // A fill can only cost the walk's limit or less; anything on top would spend another match's pot.
        if cost_base > stake_base {
            return Err(ArenaError::CostAboveStake);
        }
        m.picks[usize::from(card_index) * 2 + seat] = PickRecord { placed: true, settled: false, outcome, lots, lot_base, cost_base, payout_base: 0 };
        let bit = 1u8 << card_index;
        if seat == 0 {
            m.picked_mask0 |= bit;
        } else {
            m.picked_mask1 |= bit;
        }
        let full = full_mask(m.deck_size);
        let complete = m.picked_mask0 == full && m.picked_mask1 == full;
        if complete {
            m.status = MatchStatus::Settling;
        }
        Ok(complete)
    }

    /// Closes the pick window once its deadline has passed. One absent player forfeits the pot alone; both absent is
    /// nobody's win, so both pots go home. Neither branch touches the cards already on the book.
    pub fn book_lock(&mut self, m: &mut GameMatch, creator_credit: &mut Credit, challenger_credit: &mut Credit, now: i64) -> Booked<Locked> {
        if m.status != MatchStatus::Picking {
            return Err(ArenaError::WrongStatus);
        }
        if now <= m.pick_deadline_sec {
            return Err(ArenaError::DeadlineNotPassed);
        }
        let full = full_mask(m.deck_size);
        match (m.picked_mask0 == full, m.picked_mask1 == full) {
            (true, true) => {
                m.status = MatchStatus::Settling;
                Ok(Locked::Settling)
            }
            (false, false) => {
                self.refund_both(m, creator_credit, challenger_credit)?;
                Ok(Locked::Refunded)
            }
            (creator_done, _) => {
                m.status = MatchStatus::Forfeited;
                Ok(Locked::Forfeited(if creator_done { m.challenger } else { m.creator }))
            }
        }
    }

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

    fn refund_both(&mut self, m: &mut GameMatch, creator_credit: &mut Credit, challenger_credit: &mut Credit) -> Booked {
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

/// `ArenaParams` is re-exported beside the match because the reveal reads both.
pub fn card_life_ok(params: &ArenaParams, expiry_sec: i64, now: i64) -> bool {
    expiry_sec >= now.saturating_add(i64::from(params.min_card_life_sec))
}
