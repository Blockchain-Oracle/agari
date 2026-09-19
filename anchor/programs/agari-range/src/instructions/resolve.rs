use anchor_lang::prelude::*;
use anchor_spl::token::{transfer_checked, TransferChecked};
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::basis::read_close_print;
use crate::constants::{EXPIRY_SEED, RESERVE_SEED, ROUND_SEED, VAULT_SEED, VOID_GRACE_SEC};
use crate::errors::RangeError;
use crate::events::{RoundClaimed, RoundSettled, RoundVoided};
use crate::state::{ExpiryBook, Reserve, Round, RoundStatus};

#[derive(Accounts)]
pub struct SettleRound<'info> {
    /// Permissionless: settling decides a round, it never moves money to the caller.
    pub cranker: Signer<'info>,
    #[account(mut, seeds = [RESERVE_SEED], bump = reserve.bump)]
    pub reserve: Account<'info, Reserve>,
    #[account(
        mut,
        seeds = [ROUND_SEED, &round.round_id.to_le_bytes()],
        bump = round.bump,
        constraint = round.reserve == reserve.key() @ RangeError::WrongMarket,
    )]
    pub round: Account<'info, Round>,
    /// The boundary book this round was counted into at open; released here.
    #[account(
        mut,
        seeds = [EXPIRY_SEED, &round.expiry_sec.to_le_bytes()],
        bump = expiry_book.bump,
        constraint = expiry_book.reserve == reserve.key() @ RangeError::WrongExpiry,
    )]
    pub expiry_book: Account<'info, ExpiryBook>,
    /// CHECK: the Window this round was opened against, read by cast with `load_checked`.
    #[account(address = round.market @ RangeError::WrongMarket)]
    pub market: UncheckedAccount<'info>,
}

/// Decide one round against its Window's closing print.
///
/// Anyone may call this and nobody is paid for it, because the outcome is a fact of the chain rather than a
/// judgement: the engine has already recorded the print. A Window the engine voided has no answer, so its
/// rounds are refunded rather than judged — the buyer gets the stake back and the reserve its capital.
pub fn settle_round(ctx: Context<SettleRound>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    require!(ctx.accounts.round.status == RoundStatus::Live, RangeError::RoundNotLive);

    let events_program = ctx.accounts.reserve.events_program;
    let closing = read_close_print(&ctx.accounts.market.to_account_info(), &events_program, now)?;
    let Some(closing_print) = closing else {
        return void_to_owner(&mut ctx.accounts.reserve, &mut ctx.accounts.round, &mut ctx.accounts.expiry_book, now);
    };

    let round = &mut ctx.accounts.round;
    let won = round.inside_won(closing_print) == round.is_inside;
    round.closing_print = closing_print;
    round.settled_at_sec = now;
    round.status = if won { RoundStatus::Won } else { RoundStatus::Lost };

    let book = &mut ctx.accounts.expiry_book;
    book.locked_base = book.locked_base.saturating_sub(round.house_locked_base);
    book.rounds_open = book.rounds_open.saturating_sub(1);

    let reserve = &mut ctx.accounts.reserve;
    // The reserve's capital is no longer promised either way; what changes is who the escrow belongs to.
    reserve.locked_base = reserve.locked_base.saturating_sub(round.house_locked_base);
    reserve.rounds_open = reserve.rounds_open.saturating_sub(1);
    if won {
        // The stake stops being escrow and the whole payout becomes owed instead.
        reserve.user_escrow_base = reserve
            .user_escrow_base
            .saturating_sub(round.stake_base)
            .checked_add(round.max_payout_base)
            .ok_or(RangeError::MathOverflow)?;
    } else {
        // The stake becomes the providers'.
        reserve.user_escrow_base = reserve.user_escrow_base.saturating_sub(round.stake_base);
    }

    emit!(RoundSettled {
        reserve: reserve.key(),
        round: round.key(),
        round_id: round.round_id,
        closing_print,
        won,
        payout_base: if won { round.max_payout_base } else { 0 },
    });
    Ok(())
}

/// A round whose Window never answered. The buyer is made whole and the reserve takes its capital back.
fn void_to_owner(reserve: &mut Account<Reserve>, round: &mut Account<Round>, book: &mut Account<ExpiryBook>, now: i64) -> Result<()> {
    round.status = RoundStatus::Void;
    round.settled_at_sec = now;
    reserve.locked_base = reserve.locked_base.saturating_sub(round.house_locked_base);
    reserve.rounds_open = reserve.rounds_open.saturating_sub(1);
    book.locked_base = book.locked_base.saturating_sub(round.house_locked_base);
    book.rounds_open = book.rounds_open.saturating_sub(1);
    emit!(RoundVoided {
        reserve: reserve.key(),
        round: round.key(),
        round_id: round.round_id,
        refund_base: round.stake_base,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct VoidStale<'info> {
    pub cranker: Signer<'info>,
    #[account(mut, seeds = [RESERVE_SEED], bump = reserve.bump)]
    pub reserve: Account<'info, Reserve>,
    #[account(
        mut,
        seeds = [ROUND_SEED, &round.round_id.to_le_bytes()],
        bump = round.bump,
        constraint = round.reserve == reserve.key() @ RangeError::WrongMarket,
    )]
    pub round: Account<'info, Round>,
    /// The boundary book this round was counted into at open; released here.
    #[account(
        mut,
        seeds = [EXPIRY_SEED, &round.expiry_sec.to_le_bytes()],
        bump = expiry_book.bump,
        constraint = expiry_book.reserve == reserve.key() @ RangeError::WrongExpiry,
    )]
    pub expiry_book: Account<'info, ExpiryBook>,
}

/// A round can never be stuck live. Once the grace past its Window's close has passed with no answer from the
/// engine, anyone may void it and the buyer may claim their stake back.
pub fn void_stale(ctx: Context<VoidStale>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    require!(ctx.accounts.round.status == RoundStatus::Live, RangeError::RoundNotLive);
    let deadline = ctx.accounts.round.expiry_sec.saturating_add(VOID_GRACE_SEC);
    require!(now > deadline, RangeError::NotStale);
    void_to_owner(&mut ctx.accounts.reserve, &mut ctx.accounts.round, &mut ctx.accounts.expiry_book, now)
}

#[derive(Accounts)]
pub struct ClaimRound<'info> {
    /// Permissionless to call; the money only ever goes to `round.owner` (AD-5).
    pub cranker: Signer<'info>,
    #[account(mut, seeds = [RESERVE_SEED], bump = reserve.bump)]
    pub reserve: Account<'info, Reserve>,
    #[account(
        mut,
        seeds = [ROUND_SEED, &round.round_id.to_le_bytes()],
        bump = round.bump,
        constraint = round.reserve == reserve.key() @ RangeError::WrongMarket,
    )]
    pub round: Account<'info, Round>,
    #[account(mut, seeds = [VAULT_SEED], bump = reserve.vault_bump)]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, token::mint = collateral_mint, token::authority = round.owner)]
    pub owner_token: InterfaceAccount<'info, TokenAccount>,
    #[account(address = reserve.collateral_mint)]
    pub collateral_mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
}

/// Pay a settled round. A win pays the full payout; a void returns the stake. The destination is the round's
/// own owner and is not a caller's choice, so a crank can be run by anyone without being able to redirect it.
pub fn claim_round(ctx: Context<ClaimRound>) -> Result<()> {
    let amount_base = match ctx.accounts.round.status {
        RoundStatus::Won => ctx.accounts.round.max_payout_base,
        RoundStatus::Void => ctx.accounts.round.stake_base,
        RoundStatus::Lost => return Err(RangeError::RoundDidNotWin.into()),
        RoundStatus::Claimed => return Err(RangeError::RoundDidNotWin.into()),
        RoundStatus::Live => return Err(RangeError::RoundNotSettled.into()),
    };

    let reserve_bump = ctx.accounts.reserve.bump;
    let seeds: &[&[u8]] = &[RESERVE_SEED, &[reserve_bump]];
    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.vault.to_account_info(),
                mint: ctx.accounts.collateral_mint.to_account_info(),
                to: ctx.accounts.owner_token.to_account_info(),
                authority: ctx.accounts.reserve.to_account_info(),
            },
            &[seeds],
        ),
        amount_base,
        ctx.accounts.collateral_mint.decimals,
    )?;

    let round = &mut ctx.accounts.round;
    round.status = RoundStatus::Claimed;
    let reserve = &mut ctx.accounts.reserve;
    reserve.user_escrow_base = reserve.user_escrow_base.saturating_sub(amount_base);

    emit!(RoundClaimed {
        reserve: reserve.key(),
        round: round.key(),
        round_id: round.round_id,
        owner: round.owner,
        payout_base: amount_base,
    });
    Ok(())
}
