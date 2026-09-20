use anchor_lang::prelude::*;

use crate::constants::{MAX_DECK, TIERS};
use crate::errors::ArenaError;

pub(crate) type Booked<T = ()> = std::result::Result<T, ArenaError>;

/// One entry price. `pot_base` is what each player escrows; `per_card_cap_base` is the most one card's order may
/// spend. Free is a tier with a zero pot: its picks are still real orders.
#[derive(AnchorSerialize, AnchorDeserialize, InitSpace, Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Tier {
    pub pot_base: u64,
    pub per_card_cap_base: u64,
    pub enabled: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, InitSpace, Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct ArenaParams {
    /// How long a created match waits for its challenger, a joined one for its deck, a revealed one for both players' picks.
    pub join_window_sec: u32,
    pub reveal_window_sec: u32,
    pub pick_window_sec: u32,
    pub min_deck_size: u8,
    pub max_deck_size: u8,
    /// At reveal every card's Window must still have this long to run: a deck of Windows about to lock is a deck nobody can play.
    pub min_card_life_sec: u32,
}

impl ArenaParams {
    pub fn validate(&self) -> Booked {
        let ok = self.join_window_sec > 0
            && self.reveal_window_sec > 0
            && self.pick_window_sec > 0
            && self.min_deck_size >= 1
            && self.min_deck_size <= self.max_deck_size
            && usize::from(self.max_deck_size) <= MAX_DECK;
        if ok {
            Ok(())
        } else {
            Err(ArenaError::BadParams)
        }
    }
}

#[account]
#[derive(InitSpace, Default)]
pub struct Arena {
    pub admin: Pubkey,
    pub collateral_mint: Pubkey,
    /// The cluster id the deck commitment carries, fixed at init, so a deck committed for one cluster opens nothing on another.
    pub chain_id: u64,
    pub params: ArenaParams,
    pub tiers: [Tier; TIERS],
    /// Pots held for undecided matches.
    pub escrowed_base: u64,
    /// Credits owed and unclaimed: payouts, pots won, pots refunded, a key's unspent escrow.
    pub credited_base: u64,
    /// Stakes players have set aside for their seats' keys.
    pub agent_escrow_base: u64,
    pub paused: bool,
    pub bump: u8,
    pub seat_bump: u8,
    pub custody_bump: u8,
}

/// A player's claimable money. It pays the player, never whoever cranks the claim (AD-5).
#[account]
#[derive(InitSpace, Default)]
pub struct Credit {
    pub player: Pubkey,
    pub amount_base: u64,
    pub bump: u8,
}

/// A match-scoped delegate for one seat: the key the player named, until when, and the deck's own ceiling on the
/// stakes it may hand the arena (`per_card_cap × deck_size`, booked gross).
///
/// On the EVM the key's picks pull each stake from the player's wallet under a token allowance. An SPL token
/// account has one delegate, so a player in two matches would overwrite their own approval. Here the entry that
/// names a key escrows the ceiling beside the pot, the key's picks draw on it, and whatever is unspent becomes the
/// player's credit once the pick phase is over or the key is replaced.
#[account]
#[derive(InitSpace, Default)]
pub struct Agent {
    pub agent: Pubkey,
    pub expires_at_sec: i64,
    pub budget_base: u64,
    /// Gross: the stakes handed over, not the costs after refund, so the ceiling is the deck's and never a guess about fills.
    pub spent_base: u64,
    /// What is still set aside for this key's picks.
    pub escrow_base: u64,
    pub bump: u8,
}

pub(crate) fn add(a: u64, b: u64) -> Booked<u64> {
    a.checked_add(b).ok_or(ArenaError::MathOverflow)
}

impl Arena {
    /// What the arena owes. Custody holds exactly this after every instruction.
    pub fn total_owed_base(&self) -> u128 {
        u128::from(self.escrowed_base) + u128::from(self.credited_base) + u128::from(self.agent_escrow_base)
    }

    pub fn tier(&self, tier: u8) -> Booked<Tier> {
        self.tiers.get(usize::from(tier)).copied().filter(|t| t.enabled).ok_or(ArenaError::UnknownTier)
    }

    pub fn book_credit(&mut self, credit: &mut Credit, amount_base: u64) -> Booked {
        credit.amount_base = add(credit.amount_base, amount_base)?;
        self.credited_base = add(self.credited_base, amount_base)?;
        Ok(())
    }

    /// Empties a player's credit. The caller pays it to the player's own token account and nowhere else.
    pub fn book_claim(&mut self, credit: &mut Credit) -> Booked<u64> {
        let amount_base = credit.amount_base;
        if amount_base == 0 {
            return Err(ArenaError::NoCredit);
        }
        credit.amount_base = 0;
        self.credited_base = self.credited_base.saturating_sub(amount_base);
        Ok(amount_base)
    }

    /// Names a seat's key and sets aside the deck's ceiling for it. Returns what the player has to bring.
    pub fn book_agent(&mut self, agent: &mut Agent, key: Pubkey, ttl_sec: u32, budget_base: u64, now: i64) -> Booked<u64> {
        if ttl_sec == 0 || ttl_sec > crate::constants::MAX_AGENT_TTL_SEC {
            return Err(ArenaError::BadTtl);
        }
        if agent.escrow_base != 0 {
            return Err(ArenaError::AgentStillLive);
        }
        agent.agent = key;
        agent.expires_at_sec = now.saturating_add(i64::from(ttl_sec));
        agent.budget_base = budget_base;
        agent.spent_base = 0;
        agent.escrow_base = budget_base;
        self.agent_escrow_base = add(self.agent_escrow_base, budget_base)?;
        Ok(budget_base)
    }

    /// The key's pick draws its stake from the seat's escrow. Booked gross against the deck's ceiling.
    pub fn book_agent_stake(&mut self, agent: &mut Agent, signer: &Pubkey, stake_base: u64, now: i64) -> Booked {
        if agent.agent == Pubkey::default() || agent.agent != *signer {
            return Err(ArenaError::NotAgent);
        }
        if now > agent.expires_at_sec {
            return Err(ArenaError::AgentExpired);
        }
        let spent = add(agent.spent_base, stake_base)?;
        if spent > agent.budget_base || stake_base > agent.escrow_base {
            return Err(ArenaError::AgentOverBudget);
        }
        agent.spent_base = spent;
        agent.escrow_base -= stake_base;
        self.agent_escrow_base = self.agent_escrow_base.saturating_sub(stake_base);
        Ok(())
    }

    /// The unspent part of a key's stake goes back beside the rest of what is set aside for it.
    pub fn book_agent_refund(&mut self, agent: &mut Agent, refund_base: u64) -> Booked {
        agent.escrow_base = add(agent.escrow_base, refund_base)?;
        self.agent_escrow_base = add(self.agent_escrow_base, refund_base)?;
        Ok(())
    }

    /// Whatever a key never spent becomes its player's credit, and the key is spent.
    pub fn book_agent_release(&mut self, agent: &mut Agent, credit: &mut Credit) -> Booked<u64> {
        let amount_base = agent.escrow_base;
        agent.escrow_base = 0;
        agent.agent = Pubkey::default();
        self.agent_escrow_base = self.agent_escrow_base.saturating_sub(amount_base);
        self.book_credit(credit, amount_base)?;
        Ok(amount_base)
    }
}
