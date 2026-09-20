//! The ways a pot goes home, the lock that decides who forfeited, and the claim. Every one of them books money as
//! credit to the player it belongs to; none of them pays its caller.

use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::constants::{ARENA_SEED, CREDIT_SEED, CUSTODY_SEED, MATCH_SEED, SEAT_SEED};
use crate::errors::ArenaError;
use crate::events::{CreditClaimed, MatchRefunded, PicksLocked};
use crate::instructions::payout::Payer;
use crate::state::{Arena, Credit, GameMatch, Locked, MatchStatus, RefundReason};

/// A match with both players' credit accounts, created on first use by whoever cranks.
#[derive(Accounts)]
#[instruction(match_id: [u8; 32])]
pub struct MatchAndCredits<'info> {
    #[account(mut)]
    pub caller: Signer<'info>,
    #[account(mut, seeds = [ARENA_SEED], bump = arena.bump)]
    pub arena: Box<Account<'info, Arena>>,
    #[account(mut, seeds = [MATCH_SEED, match_id.as_ref()], bump = game.bump)]
    pub game: Box<Account<'info, GameMatch>>,
    #[account(init_if_needed, payer = caller, space = 8 + Credit::INIT_SPACE, seeds = [CREDIT_SEED, game.creator.as_ref()], bump)]
    pub creator_credit: Box<Account<'info, Credit>>,
    #[account(init_if_needed, payer = caller, space = 8 + Credit::INIT_SPACE, seeds = [CREDIT_SEED, game.challenger.as_ref()], bump)]
    pub challenger_credit: Box<Account<'info, Credit>>,
    pub system_program: Program<'info, System>,
}

impl MatchAndCredits<'_> {
    pub fn claim_credits(&mut self, bumps: &MatchAndCreditsBumps) {
        self.creator_credit.player = self.game.creator;
        self.creator_credit.bump = bumps.creator_credit;
        self.challenger_credit.player = self.game.challenger;
        self.challenger_credit.bump = bumps.challenger_credit;
    }
}

/// Closes the pick window. Permissionless once the deadline has passed.
pub fn public_lock_picks(ctx: Context<MatchAndCredits>, match_id: [u8; 32]) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    ctx.accounts.claim_credits(&ctx.bumps);
    let a = &mut *ctx.accounts;
    match a.arena.book_lock(&mut a.game, &mut a.creator_credit, &mut a.challenger_credit, now)? {
        Locked::Settling => emit!(PicksLocked { match_id, status: MatchStatus::Settling, forfeited_by: Pubkey::default() }),
        Locked::Forfeited(by) => emit!(PicksLocked { match_id, status: MatchStatus::Forfeited, forfeited_by: by }),
        Locked::Refunded => emit!(MatchRefunded { match_id, reason: RefundReason::BothIncomplete, per_player_base: a.game.pot_base }),
    }
    Ok(())
}

/// The creator withdraws a match nobody has joined.
pub fn player_cancel_match(ctx: Context<MatchAndCredits>, match_id: [u8; 32]) -> Result<()> {
    refund_unjoined(ctx, match_id, true)
}

/// Anyone may return an unjoined pot once the join window has closed.
pub fn public_refund_unjoined(ctx: Context<MatchAndCredits>, match_id: [u8; 32]) -> Result<()> {
    refund_unjoined(ctx, match_id, false)
}

fn refund_unjoined(ctx: Context<MatchAndCredits>, match_id: [u8; 32], by_creator: bool) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    ctx.accounts.claim_credits(&ctx.bumps);
    let a = &mut *ctx.accounts;
    let caller = a.caller.key();
    let reason = a.arena.book_refund_unjoined(&mut a.game, &mut a.creator_credit, by_creator.then_some(&caller), now)?;
    emit!(MatchRefunded { match_id, reason, per_player_base: a.game.pot_base });
    Ok(())
}

/// Anyone may return both pots when the deck was never opened.
pub fn public_refund_unrevealed(ctx: Context<MatchAndCredits>, match_id: [u8; 32]) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    ctx.accounts.claim_credits(&ctx.bumps);
    let a = &mut *ctx.accounts;
    a.arena.book_refund_unrevealed(&mut a.game, &mut a.creator_credit, &mut a.challenger_credit, now)?;
    emit!(MatchRefunded { match_id, reason: RefundReason::RevealUnavailable, per_player_base: a.game.pot_base });
    Ok(())
}

#[derive(Accounts)]
pub struct PublicClaimCredit<'info> {
    /// Permissionless: a relayer or a friend can crank it without becoming the beneficiary.
    pub caller: Signer<'info>,
    #[account(mut, seeds = [ARENA_SEED], bump = arena.bump)]
    pub arena: Box<Account<'info, Arena>>,
    /// CHECK: the player being paid.
    pub player: UncheckedAccount<'info>,
    #[account(mut, seeds = [CREDIT_SEED, player.key().as_ref()], bump = credit.bump)]
    pub credit: Box<Account<'info, Credit>>,
    #[account(mut, seeds = [CUSTODY_SEED], bump = arena.custody_bump)]
    pub custody: Box<InterfaceAccount<'info, TokenAccount>>,
    /// CHECK: the arena's seat, which is custody's authority.
    #[account(seeds = [SEAT_SEED], bump = arena.seat_bump)]
    pub seat: UncheckedAccount<'info>,
    /// The player's own token account, and nobody else's (AD-5).
    #[account(mut, token::mint = collateral_mint, token::authority = player)]
    pub player_token: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(address = arena.collateral_mint @ ArenaError::WrongCollateral)]
    pub collateral_mint: Box<InterfaceAccount<'info, Mint>>,
    pub token_program: Interface<'info, TokenInterface>,
}

/// Takes a player's credits, pot and payouts alike. Pays the player, never the caller.
pub fn public_claim_credit(ctx: Context<PublicClaimCredit>) -> Result<()> {
    let a = &mut *ctx.accounts;
    // The books are closed before the money moves.
    let amount_base = a.arena.book_claim(&mut a.credit)?;
    let payer = Payer { custody: &a.custody, seat: &a.seat.to_account_info(), mint: &a.collateral_mint, token_program: &a.token_program.to_account_info(), seat_bump: a.arena.seat_bump };
    payer.pay(&a.player_token.to_account_info(), amount_base)?;
    emit!(CreditClaimed { player: a.player.key(), amount_base, by: a.caller.key() });
    Ok(())
}
