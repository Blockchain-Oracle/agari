use anchor_lang::prelude::*;
use anchor_spl::token::{transfer_checked, TransferChecked};
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::constants::{RESERVE_SEED, TICKET_SEED, VAULT_SEED, VOID_GRACE_SEC};
use crate::errors::ParlayError;
use crate::events::{LegResolved, ParlayClaimed, ParlaySettled};
use crate::legs::{engine_has_answer, read_leg_outcome};
use crate::state::{LegStatus, ParlayReserve, ParlayStatus, ParlayTicket, Settled};

/// Shared by the two cranks that decide a ticket: neither moves money, so neither names a token account.
#[derive(Accounts)]
pub struct DecideTicket<'info> {
    /// Permissionless: deciding a ticket never pays the caller.
    pub cranker: Signer<'info>,
    #[account(mut, seeds = [RESERVE_SEED], bump = reserve.bump)]
    pub reserve: Box<Account<'info, ParlayReserve>>,
    #[account(
        mut,
        seeds = [TICKET_SEED, &ticket.parlay_id.to_le_bytes()],
        bump = ticket.bump,
        constraint = ticket.reserve == reserve.key() @ ParlayError::WrongReserve,
    )]
    pub ticket: Box<Account<'info, ParlayTicket>>,
    /// CHECK: the leg's Window, matched against the ticket's own record and read by cast with `load_checked`.
    pub market: UncheckedAccount<'info>,
}

/// Settle one leg on the venue's resolution.
///
/// Anyone may call this and nobody is paid for it, because the outcome is a fact the engine already recorded.
/// A finished ticket or a decided leg is a no-op, so two cranks racing never fail each other; a Window that has
/// not settled refuses, to be cranked again later. A losing leg kills the ticket and its stake becomes the
/// providers'; a voided Window voids the ticket and the stake is owed back; the last winning leg makes the whole
/// payout claimable.
pub fn resolve_leg(ctx: Context<DecideTicket>, leg_idx: u8) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let idx = usize::from(leg_idx);
    let ticket = &mut ctx.accounts.ticket;
    let leg = *ticket.legs.get(idx).ok_or(ParlayError::WrongLeg)?;
    require_keys_eq!(leg.market, ctx.accounts.market.key(), ParlayError::WrongLeg);
    if ticket.status != ParlayStatus::Live || leg.status != LegStatus::Pending {
        return Ok(());
    }

    let outcome = read_leg_outcome(&ctx.accounts.market.to_account_info(), &ctx.accounts.reserve.events_program, leg.is_up, now)?;
    let settled = ticket.apply_leg(idx, outcome, now)?;
    emit!(LegResolved {
        ticket: ticket.key(),
        parlay_id: ticket.parlay_id,
        leg_idx,
        market: leg.market,
        outcome,
        cranker: ctx.accounts.cranker.key(),
    });

    if let Some(how) = settled {
        close_out(&mut ctx.accounts.reserve, ticket, how, outcome)?;
    }
    Ok(())
}

/// A ticket can never be stuck live. Once the grace past its last boundary has run out and the venue still has no
/// answer for the leg that is next to be decided, anyone may void it and the buyer may claim the stake back.
///
/// It refuses while the venue does have an answer. Without that, a winning ticket nobody had cranked within the
/// hour could be voided by anyone, and the people with a reason to would be the providers it was about to cost.
pub fn void_stale(ctx: Context<DecideTicket>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let ticket = &mut ctx.accounts.ticket;
    require!(ticket.status == ParlayStatus::Live, ParlayError::TicketNotLive);
    require!(now > ticket.last_expiry_sec.saturating_add(VOID_GRACE_SEC), ParlayError::NotStale);

    let waiting_on = ticket.next_leg().and_then(|idx| ticket.legs.get(idx)).ok_or(ParlayError::TicketNotLive)?;
    require_keys_eq!(waiting_on.market, ctx.accounts.market.key(), ParlayError::WrongLeg);
    let answered = engine_has_answer(&ctx.accounts.market.to_account_info(), &ctx.accounts.reserve.events_program, now);
    require!(!answered, ParlayError::MustResolve);

    ticket.finish(Settled::Void, now);
    close_out(&mut ctx.accounts.reserve, ticket, Settled::Void, LegStatus::Void)
}

fn close_out(reserve: &mut Account<ParlayReserve>, ticket: &Account<ParlayTicket>, how: Settled, outcome: LegStatus) -> Result<()> {
    reserve.book_settled(how, ticket.stake_base, ticket.house_locked_base, ticket.max_payout_base, &ticket.expiries())?;
    emit!(ParlaySettled {
        reserve: reserve.key(),
        ticket: ticket.key(),
        owner: ticket.owner,
        parlay_id: ticket.parlay_id,
        outcome,
        owed_base: ticket.claimable_base().unwrap_or(0),
    });
    Ok(())
}

#[derive(Accounts)]
pub struct ClaimParlay<'info> {
    /// Permissionless to call; the money only ever goes to `ticket.owner` (AD-5).
    pub cranker: Signer<'info>,
    #[account(mut, seeds = [RESERVE_SEED], bump = reserve.bump)]
    pub reserve: Box<Account<'info, ParlayReserve>>,
    #[account(
        mut,
        seeds = [TICKET_SEED, &ticket.parlay_id.to_le_bytes()],
        bump = ticket.bump,
        constraint = ticket.reserve == reserve.key() @ ParlayError::WrongReserve,
    )]
    pub ticket: Box<Account<'info, ParlayTicket>>,
    #[account(mut, seeds = [VAULT_SEED], bump = reserve.vault_bump)]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, token::mint = collateral_mint, token::authority = ticket.owner)]
    pub owner_token: InterfaceAccount<'info, TokenAccount>,
    #[account(address = reserve.collateral_mint)]
    pub collateral_mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
}

/// Pay a settled ticket. A win pays the whole payout; a void returns the stake. The destination is the ticket's
/// own owner and is not the caller's choice, so a payout never waits on a keeper and no keeper can redirect one.
pub fn claim_parlay(ctx: Context<ClaimParlay>) -> Result<()> {
    let amount_base = ctx.accounts.ticket.claimable_base()?;

    // The books are closed before the money moves: a ticket is Claimed by the time anything outside this program
    // runs, so there is no moment at which it could be paid twice.
    let ticket = &mut ctx.accounts.ticket;
    ticket.status = ParlayStatus::Claimed;
    ticket.claimed_base = amount_base;
    ctx.accounts.reserve.book_claim(amount_base);

    let seeds: &[&[u8]] = &[RESERVE_SEED, &[ctx.accounts.reserve.bump]];
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

    let ticket = &ctx.accounts.ticket;
    emit!(ParlayClaimed {
        reserve: ctx.accounts.reserve.key(),
        ticket: ticket.key(),
        owner: ticket.owner,
        parlay_id: ticket.parlay_id,
        paid_base: amount_base,
        cranker: ctx.accounts.cranker.key(),
    });
    Ok(())
}
