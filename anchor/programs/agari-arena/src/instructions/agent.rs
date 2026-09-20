//! A seat's key: a browser key the player names so every pick after the entry is signed by the key and paid for by
//! the player. It can place picks for one seat of one match, within the deck's own ceiling, until a deadline, and
//! nothing else. It cannot withdraw and cannot redirect a pot: `creator` and `challenger` are never rewritten.

use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::constants::{AGENT_SEED, ARENA_SEED, CREDIT_SEED, CUSTODY_SEED, MATCH_SEED};
use crate::errors::ArenaError;
use crate::events::{AgentAuthorized, AgentReleased};
use crate::instructions::entry::collect;
use crate::state::{Agent, Arena, Credit, GameMatch};

#[derive(Accounts)]
#[instruction(match_id: [u8; 32])]
pub struct PlayerAuthorizeAgent<'info> {
    #[account(mut)]
    pub player: Signer<'info>,
    #[account(mut, seeds = [ARENA_SEED], bump = arena.bump)]
    pub arena: Box<Account<'info, Arena>>,
    #[account(seeds = [MATCH_SEED, match_id.as_ref()], bump = game.bump)]
    pub game: Box<Account<'info, GameMatch>>,
    #[account(init_if_needed, payer = player, space = 8 + Agent::INIT_SPACE, seeds = [AGENT_SEED, match_id.as_ref(), player.key().as_ref()], bump)]
    pub agent_account: Box<Account<'info, Agent>>,
    #[account(mut, seeds = [CUSTODY_SEED], bump = arena.custody_bump)]
    pub custody: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, token::mint = collateral_mint, token::authority = player)]
    pub player_token: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(address = arena.collateral_mint @ ArenaError::WrongCollateral)]
    pub collateral_mint: Box<InterfaceAccount<'info, Mint>>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

/// Names the key that may place this seat's picks and sets the deck's ceiling aside for it. The budget is not a
/// parameter: it is every card at the tier's cap.
pub fn player_authorize_agent(ctx: Context<PlayerAuthorizeAgent>, match_id: [u8; 32], agent: Pubkey, ttl_sec: u32) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    require!(agent != Pubkey::default(), ArenaError::NotAgent);
    let a = &mut *ctx.accounts;
    let player = a.player.key();
    a.game.seat_of(&player)?;
    a.agent_account.bump = ctx.bumps.agent_account;
    let budget_base = a.game.agent_budget_base()?;
    let brought = a.arena.book_agent(&mut a.agent_account, agent, ttl_sec, budget_base, now)?;
    collect(&a.player_token, &a.custody, &a.collateral_mint, &a.player, &a.token_program, brought)?;
    emit!(AgentAuthorized { match_id, player, agent, expires_at_sec: a.agent_account.expires_at_sec, budget_base });
    Ok(())
}

#[derive(Accounts)]
#[instruction(match_id: [u8; 32])]
pub struct ReleaseAgent<'info> {
    /// The player to revoke their own key at any time; anyone once the pick phase is over or the key has expired.
    #[account(mut)]
    pub caller: Signer<'info>,
    #[account(mut, seeds = [ARENA_SEED], bump = arena.bump)]
    pub arena: Box<Account<'info, Arena>>,
    #[account(seeds = [MATCH_SEED, match_id.as_ref()], bump = game.bump)]
    pub game: Box<Account<'info, GameMatch>>,
    /// CHECK: the seat's player. What the key never spent is theirs, whoever sends this.
    pub player: UncheckedAccount<'info>,
    #[account(mut, seeds = [AGENT_SEED, match_id.as_ref(), player.key().as_ref()], bump = agent_account.bump)]
    pub agent_account: Box<Account<'info, Agent>>,
    #[account(init_if_needed, payer = caller, space = 8 + Credit::INIT_SPACE, seeds = [CREDIT_SEED, player.key().as_ref()], bump)]
    pub credit: Box<Account<'info, Credit>>,
    pub system_program: Program<'info, System>,
}

/// Ends a key and turns what it never spent into its player's credit. The player may do it whenever they like, which
/// is how a key is revoked; anybody may once the match has left its pick phase or the key has expired, so an escrow
/// never waits on a player who has walked away.
pub fn public_release_agent(ctx: Context<ReleaseAgent>, match_id: [u8; 32]) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let a = &mut *ctx.accounts;
    let player = a.player.key();
    a.game.seat_of(&player)?;
    let own = a.caller.key() == player;
    require!(own || Arena::agent_releasable(&a.game, a.agent_account.expires_at_sec, now), ArenaError::AgentStillLive);
    a.credit.player = player;
    a.credit.bump = ctx.bumps.credit;
    let amount_base = a.arena.book_agent_release(&mut a.agent_account, &mut a.credit)?;
    emit!(AgentReleased { match_id, player, amount_base });
    emit!(AgentAuthorized { match_id, player, agent: Pubkey::default(), expires_at_sec: 0, budget_base: 0 });
    Ok(())
}
