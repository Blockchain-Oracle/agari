use anchor_lang::prelude::*;

use agari_common::view::load_checked;
use agari_events::state::{Market, MarketState};

use crate::commitment::deck_hash;
use crate::constants::{ARENA_SEED, MATCH_SEED, MAX_DECK};
use crate::errors::ArenaError;
use crate::events::DeckRevealed;
use crate::state::{card_life_ok, Arena, GameMatch, MatchStatus};

#[derive(Accounts)]
#[instruction(match_id: [u8; 32])]
pub struct PublicRevealDeck<'info> {
    /// Permissionless: whoever holds the preimage may publish it, because the commitment, not a key, is what proves
    /// the deck was fixed before either player saw it.
    pub caller: Signer<'info>,
    #[account(seeds = [ARENA_SEED], bump = arena.bump)]
    pub arena: Box<Account<'info, Arena>>,
    #[account(mut, seeds = [MATCH_SEED, match_id.as_ref()], bump = game.bump)]
    pub game: Box<Account<'info, GameMatch>>,
}

/// Opens the deck. The cards are the Market accounts handed in after the named ones: their addresses ARE the cards,
/// so a card that is not a Window of the venue cannot even be named. Each must still be open with `min_card_life`
/// left to run, checked before a deadline starts running against players who could not pick.
pub fn public_reveal_deck<'info>(ctx: Context<'info, PublicRevealDeck<'info>>, match_id: [u8; 32], server_seed: [u8; 32], client_seeds: Vec<[u8; 32]>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let markets = ctx.remaining_accounts;
    require!(markets.len() <= MAX_DECK && client_seeds.len() <= MAX_DECK, ArenaError::BadDeckSize);
    let cards: Vec<Pubkey> = markets.iter().map(|info| info.key()).collect();

    let a = &mut *ctx.accounts;
    // The status is checked before the hash, so a second reveal is told the match has moved on, not that its deck is wrong.
    require!(a.game.status == MatchStatus::ActiveUnrevealed, ArenaError::WrongStatus);
    let got = deck_hash(a.arena.chain_id, &a.arena.key(), &match_id, a.game.policy_version, &server_seed, &client_seeds, &cards);
    require!(got == a.game.deck_hash, ArenaError::DeckMismatch);
    for info in markets {
        let market = load_checked::<Market>(info, &agari_events::ID).map_err(|_| error!(ArenaError::UnknownMarket))?;
        require!(market.state == u8::from(MarketState::Open), ArenaError::WindowNotTrading);
        require!(card_life_ok(&a.arena.params, market.expiry, now), ArenaError::TooLate);
    }
    a.arena.book_reveal(&mut a.game, &cards, now)?;
    emit!(DeckRevealed { match_id, policy_version: a.game.policy_version, cards, pick_deadline_sec: a.game.pick_deadline_sec });
    Ok(())
}
