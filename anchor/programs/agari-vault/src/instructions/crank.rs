//! `public_crank_settle()` (vault.md §3.5; Masayume `EventVault.sol:193-205, 364-376`): anyone redeems an owner's
//! settled slot out of the vault seat, and the payout always lands on that owner's `available` (FR-31: liveness is
//! never custody). Each side is a PROGRAM partial redeem whose custody delta must equal the exact payout.

use anchor_lang::prelude::*;
use anchor_spl::token::{accessor, Token, TokenAccount};

use agari_common::grid::partial_payout;
use agari_events::program::AgariEvents;

use crate::constants::{ACCOUNT_SEED, ATTENDED, CUSTODY_SEED, EVENTS_CONFIG, EVENTS_EVENT_AUTHORITY, SEAT, VAULT_CONFIG};
use crate::engine::{self, Engine};
use crate::errors::VaultError;
use crate::events::Settled;
use crate::positions::settle_slot;
use crate::state::{Grant, VaultAccount, VaultConfig};

#[event_cpi]
#[derive(Accounts)]
pub struct PublicCrankSettle<'info> {
    /// Pays the fee only.
    pub cranker: Signer<'info>,
    #[account(address = VAULT_CONFIG)]
    pub vault_config: AccountLoader<'info, VaultConfig>,
    /// CHECK: the owner whose slot settles; derives the account and custody seeds and is always the one credited.
    pub owner: UncheckedAccount<'info>,
    #[account(mut, seeds = [ACCOUNT_SEED, owner.key().as_ref()], bump = account.load()?.bump)]
    pub account: AccountLoader<'info, VaultAccount>,
    #[account(mut, seeds = [CUSTODY_SEED, owner.key().as_ref()], bump = account.load()?.custody_bump)]
    pub custody: Box<Account<'info, TokenAccount>>,
    /// The grant that opened the YES side (or both sides, passed once).
    #[account(mut)]
    pub yes_grant: Option<AccountLoader<'info, Grant>>,
    /// The grant that opened the NO side, when it differs from the YES side's.
    #[account(mut)]
    pub no_grant: Option<AccountLoader<'info, Grant>>,
    /// CHECK: the vault's seat PDA; it signs the redeems.
    #[account(address = SEAT)]
    pub seat: UncheckedAccount<'info>,
    pub events_program: Program<'info, AgariEvents>,
    /// CHECK: agari-events GlobalConfig, read with `load_checked`.
    #[account(address = EVENTS_CONFIG)]
    pub events_config: UncheckedAccount<'info>,
    /// CHECK: bound to the market with `load_checked` (UnknownMarket).
    pub series: UncheckedAccount<'info>,
    /// CHECK: an agari-events Market, read with `load_checked`.
    #[account(mut)]
    pub market: UncheckedAccount<'info>,
    /// CHECK: bound to the market both ways; the vault's seat is checked in it.
    #[account(mut)]
    pub ledger: UncheckedAccount<'info>,
    /// CHECK: must be `market.mvault`.
    #[account(mut)]
    pub mvault: UncheckedAccount<'info>,
    /// CHECK: the vault's collateral mint.
    #[account(address = vault_config.load()?.collateral_mint @ VaultError::WrongCollateral)]
    pub collateral_mint: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
    /// CHECK: agari-events' event authority.
    #[account(address = EVENTS_EVENT_AUTHORITY)]
    pub events_event_authority: UncheckedAccount<'info>,
}

/// Step 3: a side attributed to `grant_id` needs that owner's grant passed (GrantAccountMissing). Grant accounts are
/// created only at `["grant", id]` with a unique id, so the loaded id and owner identify the PDA.
fn attributed<'a, 'info>(grant_id: u64, passed: Option<&'a AccountLoader<'info, Grant>>, owner: &Pubkey) -> Result<Option<&'a AccountLoader<'info, Grant>>> {
    if grant_id == ATTENDED {
        return Ok(None);
    }
    let loader = passed.ok_or(VaultError::GrantAccountMissing)?;
    let g = loader.load()?;
    require!(g.grant_id == grant_id && g.owner == *owner, VaultError::GrantAccountMissing);
    Ok(Some(loader))
}

pub fn public_crank_settle(ctx: Context<PublicCrankSettle>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let a = &ctx.accounts;
    let (owner, market) = (a.owner.key(), a.market.key());
    let e = Engine {
        program: a.events_program.to_account_info(),
        config: a.events_config.to_account_info(),
        series: a.series.to_account_info(),
        market: a.market.to_account_info(),
        book: None,
        ledger: a.ledger.to_account_info(),
        mvault: a.mvault.to_account_info(),
        mint: a.collateral_mint.to_account_info(),
        token_program: a.token_program.to_account_info(),
        event_authority: a.events_event_authority.to_account_info(),
        seat: a.seat.to_account_info(),
        custody: a.custody.to_account_info(),
    };
    let (collateral_mint, seat_bump) = {
        let c = a.vault_config.load()?;
        (c.collateral_mint, c.seat_bump)
    };

    // 1. R, then the Window is resolved or voided.
    let window = engine::resolve(&e, &collateral_mint, None)?;
    require!(window.is_settled(), VaultError::MarketNotSettled);
    // 2. The owner's slot for this market.
    let (index, slot) = {
        let account = a.account.load()?;
        let index = account.slot_of(&market).ok_or(VaultError::NothingToSettle)?;
        (index, account.positions[index])
    };
    // 3. Every attributed grant is present (a shared grant is passed once, as `yes_grant`).
    let yes_grant = attributed(slot.yes_grant, a.yes_grant.as_ref(), &owner)?;
    let no_grant = if slot.no_grant == slot.yes_grant { yes_grant } else { attributed(slot.no_grant, a.no_grant.as_ref(), &owner)? };

    // 4. Each held side: a partial redeem whose custody delta is exactly the payout.
    let mut payout = 0u64;
    for outcome in [0u8, 1] {
        let lots = slot.side(outcome).0;
        if lots == 0 {
            continue;
        }
        let expected = partial_payout(lots, window.cash_unit, window.payout(outcome)).ok_or(VaultError::MathOverflow)?;
        let before = accessor::amount(&e.custody)?;
        engine::redeem(&e, seat_bump, window.seat_index, outcome, lots)?;
        let received = accessor::amount(&e.custody)?.checked_sub(before);
        require!(received == Some(expected), VaultError::EngineAccountingMismatch);
        payout = payout.checked_add(expected).ok_or(VaultError::MathOverflow)?;
    }
    // 5. Each attributed side releases its grant's position count.
    for grant in [yes_grant, no_grant].into_iter().flatten() {
        let mut g = grant.load_mut()?;
        g.open_positions = g.open_positions.saturating_sub(1);
    }
    // 6. Credit the owner and free the slot.
    settle_slot(&mut *a.account.load_mut()?, index, payout)?;

    emit_cpi!(Settled { owner, market, payout, yes_redeemed: slot.yes_lots, no_redeemed: slot.no_lots, by: a.cranker.key(), at_sec: now });
    Ok(())
}
