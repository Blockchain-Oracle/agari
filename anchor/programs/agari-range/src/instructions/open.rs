use anchor_lang::prelude::*;
use anchor_spl::token::{transfer_checked, TransferChecked};
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::basis::read_open_basis;
use crate::constants::{EXPIRY_SEED, ONE_RAW, RESERVE_SEED, ROUND_SEED, VAULT_SEED};
use crate::errors::RangeError;
use crate::events::RoundOpened;
use crate::math::{band_prob_e6, floor_stake, side_prob_raw, BPS};
use crate::state::{ExpiryBook, Reserve, Round, RoundStatus};

/// `expiry_sec` is an argument only so the expiry book's PDA can be derived before the Market is read; the
/// instruction checks it against the Window's own boundary and refuses a mismatch.
#[derive(Accounts)]
#[instruction(is_inside: bool, low_print: i64, high_print: i64, max_payout_base: u64, max_stake_base: u64, expiry_sec: i64)]
pub struct OpenRound<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut, seeds = [RESERVE_SEED], bump = reserve.bump)]
    pub reserve: Account<'info, Reserve>,
    #[account(
        init,
        payer = owner,
        space = 8 + Round::INIT_SPACE,
        seeds = [ROUND_SEED, &reserve.next_round_id.to_le_bytes()],
        bump,
    )]
    pub round: Account<'info, Round>,
    /// The book of capital coming due at this Window's boundary. Created the first time one is opened there.
    #[account(
        init_if_needed,
        payer = owner,
        space = 8 + ExpiryBook::INIT_SPACE,
        seeds = [EXPIRY_SEED, &expiry_sec.to_le_bytes()],
        bump,
    )]
    pub expiry_book: Account<'info, ExpiryBook>,
    #[account(mut, seeds = [VAULT_SEED], bump = reserve.vault_bump)]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, token::mint = collateral_mint, token::authority = owner)]
    pub owner_token: InterfaceAccount<'info, TokenAccount>,
    #[account(address = reserve.collateral_mint)]
    pub collateral_mint: InterfaceAccount<'info, Mint>,
    /// CHECK: an agari-events Market, read by cast with `load_checked` against `reserve.events_program`.
    pub market: UncheckedAccount<'info>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

/// Open one round against the reserve.
///
/// The buyer names the band, the side and the payout they want, plus the most they will pay for it. The reserve
/// prices it at the *fresh* basis and charges the exact stake that basis implies — which is why `max_stake_base`
/// exists: between the quote a person saw and this instruction landing, the Window's clock has moved and so has
/// its mark. They are never charged more than they agreed to, and never quoted a price the chain won't honour.
pub fn open_round(
    ctx: Context<OpenRound>,
    is_inside: bool,
    low_print: i64,
    high_print: i64,
    max_payout_base: u64,
    max_stake_base: u64,
    expiry_sec: i64,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let reserve_key = ctx.accounts.reserve.key();
    let reserve = &ctx.accounts.reserve;
    require!(!reserve.paused, RangeError::Paused);
    require!(low_print > 0 && high_print > low_print, RangeError::BadBand);
    require!(max_payout_base > 0, RangeError::ZeroAmount);
    require!(max_payout_base <= reserve.params.max_payout_cap_base, RangeError::OverPayoutCap);

    let params = reserve.params;
    let basis = read_open_basis(&ctx.accounts.market.to_account_info(), &reserve.events_program, &params, now)?;
    // The caller named a boundary to derive the expiry book from; it must be this Window's own.
    require!(expiry_sec == basis.expiry_sec, RangeError::WrongExpiry);

    let inside_prob_e6 = band_prob_e6(
        i128::from(basis.opening_print),
        i128::from(low_print),
        i128::from(high_print),
        i128::from(basis.center_q_e6),
        i128::from(params.sigma_e8),
        i64::from(basis.tau_sec),
    );
    let prob_raw = side_prob_raw(inside_prob_e6, is_inside, ONE_RAW);
    require!(prob_raw >= i128::from(params.min_prob_raw), RangeError::LongShot);
    require!(prob_raw <= i128::from(params.max_prob_raw), RangeError::NearCertain);

    let stake_i128 = floor_stake(i128::from(max_payout_base), prob_raw, ONE_RAW, i128::from(params.margin_bps));
    let stake_base = u64::try_from(stake_i128).map_err(|_| RangeError::MathOverflow)?;
    require!(stake_base < max_payout_base, RangeError::Underpriced);
    require!(stake_base <= max_stake_base, RangeError::StakeAboveMax);

    let house_locked_base = max_payout_base.checked_sub(stake_base).ok_or(RangeError::MathOverflow)?;

    // The reserve must be able to pay this round out of capital it is not already promising elsewhere, and the
    // whole book of open rounds must stay inside its exposure limit.
    let vault_balance = ctx.accounts.vault.amount;
    require!(house_locked_base <= reserve.free_base(vault_balance), RangeError::InsufficientLiquidity);
    let equity = reserve.equity_base(vault_balance);
    let locked_after = reserve.locked_base.checked_add(house_locked_base).ok_or(RangeError::MathOverflow)?;
    let exposure_cap = u64::try_from((u128::from(equity) * u128::from(params.max_exposure_bps)) / (BPS as u128))
        .map_err(|_| RangeError::MathOverflow)?;
    require!(locked_after <= exposure_cap, RangeError::OverExposure);

    // And not all of it may come due at once.
    let expiry_after = ctx.accounts.expiry_book.locked_base.checked_add(house_locked_base).ok_or(RangeError::MathOverflow)?;
    require!(expiry_after <= params.max_expiry_locked_base, RangeError::OverExpiryCap);

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

    let round_id = reserve.next_round_id;
    let round = &mut ctx.accounts.round;
    round.reserve = reserve_key;
    round.owner = ctx.accounts.owner.key();
    round.market = ctx.accounts.market.key();
    round.round_id = round_id;
    round.status = RoundStatus::Live;
    round.is_inside = is_inside;
    round.opening_print = basis.opening_print;
    round.low_print = low_print;
    round.high_print = high_print;
    round.closing_print = 0;
    round.stake_base = stake_base;
    round.max_payout_base = max_payout_base;
    round.house_locked_base = house_locked_base;
    round.prob_raw = u64::try_from(prob_raw).map_err(|_| RangeError::MathOverflow)?;
    round.opened_at_sec = now;
    round.settled_at_sec = 0;
    round.expiry_sec = basis.expiry_sec;
    round.bump = ctx.bumps.round;

    let expiry_book = &mut ctx.accounts.expiry_book;
    expiry_book.reserve = reserve_key;
    expiry_book.expiry_sec = basis.expiry_sec;
    expiry_book.bump = ctx.bumps.expiry_book;
    expiry_book.locked_base = expiry_after;
    expiry_book.rounds_open = expiry_book.rounds_open.saturating_add(1);

    let reserve = &mut ctx.accounts.reserve;
    reserve.next_round_id = round_id.checked_add(1).ok_or(RangeError::MathOverflow)?;
    reserve.locked_base = locked_after;
    // The stake is in the vault but it is not the providers': it is this round's escrow until it resolves.
    reserve.user_escrow_base = reserve.user_escrow_base.checked_add(stake_base).ok_or(RangeError::MathOverflow)?;
    reserve.rounds_open = reserve.rounds_open.checked_add(1).ok_or(RangeError::MathOverflow)?;

    emit!(RoundOpened {
        reserve: reserve_key,
        round: ctx.accounts.round.key(),
        owner: ctx.accounts.round.owner,
        market: ctx.accounts.round.market,
        round_id,
        is_inside,
        opening_print: basis.opening_print,
        low_print,
        high_print,
        center_q_e6: basis.center_q_e6,
        sigma_e8: params.sigma_e8,
        tau_sec: basis.tau_sec,
        prob_raw: ctx.accounts.round.prob_raw,
        stake_base,
        max_payout_base,
    });
    Ok(())
}
