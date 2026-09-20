//! Entry. A match is opened against one named opponent and the named challenger matches the pot. An entry that also
//! names the seat's key is this instruction, `player_authorize_agent` and a plain System transfer of fee money to the
//! key, in one transaction: the only signature a duel then asks of the wallet.

use anchor_lang::prelude::*;
use anchor_spl::token::{transfer_checked, TransferChecked};
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::constants::{ARENA_SEED, CUSTODY_SEED, MATCH_SEED};
use crate::errors::ArenaError;
use crate::events::{MatchCreated, MatchJoined};
use crate::state::{Arena, GameMatch};

/// Moves `amount_base` from a player's own token account into custody, signed by the player.
pub fn collect<'info>(from: &InterfaceAccount<'info, TokenAccount>, custody: &InterfaceAccount<'info, TokenAccount>, mint: &InterfaceAccount<'info, Mint>, authority: &Signer<'info>, token_program: &Interface<'info, TokenInterface>, amount_base: u64) -> Result<()> {
    if amount_base == 0 {
        return Ok(());
    }
    transfer_checked(
        CpiContext::new(token_program.key(), TransferChecked { from: from.to_account_info(), mint: mint.to_account_info(), to: custody.to_account_info(), authority: authority.to_account_info() }),
        amount_base,
        mint.decimals,
    )
}

#[derive(Accounts)]
#[instruction(match_id: [u8; 32])]
pub struct PlayerCreateMatch<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    #[account(mut, seeds = [ARENA_SEED], bump = arena.bump)]
    pub arena: Box<Account<'info, Arena>>,
    /// `init_if_needed` so a used id is refused as `MatchExists` and not as a system error.
    #[account(init_if_needed, payer = creator, space = 8 + GameMatch::INIT_SPACE, seeds = [MATCH_SEED, match_id.as_ref()], bump)]
    pub game: Box<Account<'info, GameMatch>>,
    #[account(mut, seeds = [CUSTODY_SEED], bump = arena.custody_bump)]
    pub custody: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, token::mint = collateral_mint, token::authority = creator)]
    pub creator_token: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(address = arena.collateral_mint @ ArenaError::WrongCollateral)]
    pub collateral_mint: Box<InterfaceAccount<'info, Mint>>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

/// Opens a match against one named opponent and escrows the creator's side-pot.
pub fn player_create_match(ctx: Context<PlayerCreateMatch>, match_id: [u8; 32], challenger: Pubkey, tier: u8, deck_hash: [u8; 32], deck_size: u8, policy_version: u32) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let a = &mut *ctx.accounts;
    a.game.bump = ctx.bumps.game;
    let creator = a.creator.key();
    let pot_base = a.arena.book_create(&mut a.game, match_id, creator, challenger, tier, deck_hash, deck_size, policy_version, now)?;
    collect(&a.creator_token, &a.custody, &a.collateral_mint, &a.creator, &a.token_program, pot_base)?;
    emit!(MatchCreated { match_id, creator, challenger, tier, pot_base, deck_hash, deck_size, join_deadline_sec: now.saturating_add(i64::from(a.arena.params.join_window_sec)) });
    Ok(())
}

#[derive(Accounts)]
#[instruction(match_id: [u8; 32])]
pub struct PlayerJoinMatch<'info> {
    pub challenger: Signer<'info>,
    #[account(mut, seeds = [ARENA_SEED], bump = arena.bump)]
    pub arena: Box<Account<'info, Arena>>,
    #[account(mut, seeds = [MATCH_SEED, match_id.as_ref()], bump = game.bump)]
    pub game: Box<Account<'info, GameMatch>>,
    #[account(mut, seeds = [CUSTODY_SEED], bump = arena.custody_bump)]
    pub custody: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, token::mint = collateral_mint, token::authority = challenger)]
    pub challenger_token: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(address = arena.collateral_mint @ ArenaError::WrongCollateral)]
    pub collateral_mint: Box<InterfaceAccount<'info, Mint>>,
    pub token_program: Interface<'info, TokenInterface>,
}

/// The named challenger matches the pot. Nothing else can be joined.
pub fn player_join_match(ctx: Context<PlayerJoinMatch>, match_id: [u8; 32]) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let a = &mut *ctx.accounts;
    let challenger = a.challenger.key();
    let pot_base = a.arena.book_join(&mut a.game, &challenger, now)?;
    collect(&a.challenger_token, &a.custody, &a.collateral_mint, &a.challenger, &a.token_program, pot_base)?;
    emit!(MatchJoined { match_id, challenger, pot_base, reveal_deadline_sec: now.saturating_add(i64::from(a.arena.params.reveal_window_sec)) });
    Ok(())
}
