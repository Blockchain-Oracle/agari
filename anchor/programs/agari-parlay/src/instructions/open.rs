use anchor_lang::prelude::*;
use anchor_spl::token::{transfer_checked, TransferChecked};
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::constants::{ACCOUNTS_PER_LEG, MAX_LEGS, MIN_LEGS, RESERVE_SEED, TICKET_SEED, VAULT_SEED};
use crate::errors::ParlayError;
use crate::events::{LegPriced, ParlayOpened};
use crate::legs::{price_leg, LegAccounts, PricingClock};
use crate::math::{combine_prob, floor_stake};
use crate::state::{LegStatus, ParlayLeg, ParlayReserve, ParlayStatus, ParlayTicket};

/// The legs' engine accounts follow as remaining accounts: Market, Book, Series for leg 0, then leg 1, and so on.
#[derive(Accounts)]
pub struct OpenParlay<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut, seeds = [RESERVE_SEED], bump = reserve.bump)]
    pub reserve: Box<Account<'info, ParlayReserve>>,
    #[account(
        init,
        payer = owner,
        space = 8 + ParlayTicket::INIT_SPACE,
        seeds = [TICKET_SEED, &reserve.next_parlay_id.to_le_bytes()],
        bump,
    )]
    pub ticket: Box<Account<'info, ParlayTicket>>,
    #[account(mut, seeds = [VAULT_SEED], bump = reserve.vault_bump)]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, token::mint = collateral_mint, token::authority = owner)]
    pub owner_token: InterfaceAccount<'info, TokenAccount>,
    #[account(address = reserve.collateral_mint)]
    pub collateral_mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

/// Open one ticket against the reserve.
///
/// The buyer names the Windows, a side on each, the payout they want and the most they will pay for it. Every leg
/// is priced here, off its Window's own book as it rests in this slot, so nothing the buyer supplies can set a
/// price. `max_stake_base` exists because the books move between the quote a person saw and this landing: they
/// are never charged more than they agreed to, and never shown a price the chain will not honour.
pub fn open_parlay(ctx: Context<OpenParlay>, legs_up: Vec<bool>, max_payout_base: u64, max_stake_base: u64) -> Result<()> {
    let clock = Clock::get()?;
    let reserve_key = ctx.accounts.reserve.key();
    let reserve = &ctx.accounts.reserve;
    let params = reserve.params;
    require!(!reserve.paused, ParlayError::Paused);

    let count = legs_up.len();
    let most = usize::from(params.max_legs).min(MAX_LEGS);
    require!((MIN_LEGS..=most).contains(&count), ParlayError::BadLegCount);
    require!(ctx.remaining_accounts.len() == count * ACCOUNTS_PER_LEG, ParlayError::BadLegAccounts);
    require!(max_payout_base > 0, ParlayError::ZeroAmount);
    require!(max_payout_base <= params.max_payout_cap_base, ParlayError::OverPayoutCap);

    // A leg is priced over the depth the reserve would need to lay the ticket off, and never less than the floor.
    let quantity_raw = max_payout_base.max(params.price_depth_raw);
    let pricing = PricingClock {
        now: clock.unix_timestamp,
        slot: clock.slot,
        one: 10i128.checked_pow(u32::from(ctx.accounts.collateral_mint.decimals)).ok_or(ParlayError::MathOverflow)?,
    };

    let mut legs: Vec<ParlayLeg> = Vec::with_capacity(count);
    for (idx, accounts) in ctx.remaining_accounts.chunks_exact(ACCOUNTS_PER_LEG).enumerate() {
        let leg = LegAccounts { market: &accounts[0], book: &accounts[1], series: &accounts[2] };
        require!(legs.iter().all(|seen| seen.market != leg.market.key()), ParlayError::DuplicateLeg);
        let priced = price_leg(&leg, &reserve.events_program, legs_up[idx], quantity_raw, &params, &pricing)?;
        legs.push(ParlayLeg {
            market: leg.market.key(),
            is_up: legs_up[idx],
            status: LegStatus::Pending,
            expiry_sec: priced.expiry_sec,
            resolved_at_sec: 0,
            price_raw: priced.price_raw,
        });
    }

    let prices: Vec<i128> = legs.iter().map(|leg| i128::from(leg.price_raw)).collect();
    let expiries: Vec<i64> = legs.iter().map(|leg| leg.expiry_sec).collect();
    let combined = combine_prob(&prices, &expiries, pricing.one, i128::from(params.correlation_bps));
    // Integer products of small prices reach zero; a free ticket is not a long shot, it is a bug.
    require!(combined > 0 && combined >= i128::from(params.min_combined_prob_raw), ParlayError::LongShot);

    let stake = floor_stake(i128::from(max_payout_base), combined, pricing.one, i128::from(params.margin_bps));
    let stake_base = u64::try_from(stake).map_err(|_| ParlayError::MathOverflow)?;
    require!(stake_base > 0, ParlayError::ZeroAmount);
    // The house must front something, or the ticket is not a parlay.
    require!(stake_base < max_payout_base, ParlayError::Underpriced);
    require!(stake_base <= max_stake_base, ParlayError::StakeAboveMax);
    let house_locked_base = max_payout_base - stake_base;

    let parlay_id = ctx.accounts.reserve.book_open(ctx.accounts.vault.amount, stake_base, house_locked_base, &expiries)?;

    transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.owner_token.to_account_info(),
                mint: ctx.accounts.collateral_mint.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.owner.to_account_info(),
            },
        ),
        stake_base,
        ctx.accounts.collateral_mint.decimals,
    )?;

    let ticket_key = ctx.accounts.ticket.key();
    for (idx, leg) in legs.iter().enumerate() {
        emit!(LegPriced {
            ticket: ticket_key,
            parlay_id,
            leg_idx: idx as u8,
            market: leg.market,
            is_up: leg.is_up,
            price_raw: leg.price_raw,
            expiry_sec: leg.expiry_sec,
        });
    }

    let last_expiry_sec = expiries.iter().copied().max().unwrap_or(pricing.now);
    let combined_prob_raw = u64::try_from(combined).map_err(|_| ParlayError::MathOverflow)?;
    let ticket = &mut ctx.accounts.ticket;
    ticket.reserve = reserve_key;
    ticket.owner = ctx.accounts.owner.key();
    ticket.parlay_id = parlay_id;
    ticket.status = ParlayStatus::Live;
    ticket.leg_count = count as u8;
    ticket.won_count = 0;
    ticket.legs = legs;
    ticket.opened_at_sec = pricing.now;
    ticket.settled_at_sec = 0;
    ticket.last_expiry_sec = last_expiry_sec;
    ticket.stake_base = stake_base;
    ticket.max_payout_base = max_payout_base;
    ticket.house_locked_base = house_locked_base;
    ticket.combined_prob_raw = combined_prob_raw;
    ticket.claimed_base = 0;
    ticket.bump = ctx.bumps.ticket;

    emit!(ParlayOpened {
        reserve: reserve_key,
        ticket: ticket_key,
        owner: ticket.owner,
        parlay_id,
        leg_count: ticket.leg_count,
        stake_base,
        max_payout_base,
        combined_prob_raw,
        last_expiry_sec,
    });
    Ok(())
}
