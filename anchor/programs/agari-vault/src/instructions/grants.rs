//! Grants (vault.md §3.3; Masayume `EventVault.sol:98-133, 264-319`): create (optionally with its deposit, so a grant
//! never exists without its budget), fund and revoke. The Grant PDA is created in the handler after the checks, so a
//! stale id is refused as StaleGrantId before anything is allocated.

use anchor_lang::prelude::*;
use anchor_lang::system_program::{self, Allocate, Assign, CreateAccount, Transfer};
use anchor_lang::Discriminator;
use anchor_spl::token::{Mint, Token, TokenAccount};
use core::mem::size_of;

use crate::caps::{require_live, revoke};
use crate::constants::{ACCOUNT_SEED, CUSTODY_SEED, GRANT_KINDS, GRANT_SEED, VAULT_CONFIG};
use crate::errors::VaultError;
use crate::events::{Deposited, GrantCreated, GrantFunded, GrantRevoked};
use crate::instructions::funding::deposit;
use crate::state::{Grant, VaultAccount, VaultConfig};

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct CapsArgs {
    pub max_stake_per_trade: u64,
    pub max_daily_spend: u64,
    pub max_open_positions: u32,
    pub max_price_ticks: u16,
}

#[event_cpi]
#[derive(Accounts)]
#[instruction(grant_id: u64)]
pub struct OwnerGrant<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut, address = VAULT_CONFIG)]
    pub vault_config: AccountLoader<'info, VaultConfig>,
    #[account(mut, seeds = [ACCOUNT_SEED, owner.key().as_ref()], bump = account.load()?.bump)]
    pub account: AccountLoader<'info, VaultAccount>,
    /// CHECK: the new Grant PDA; created and written by the handler after the checks.
    #[account(mut, seeds = [GRANT_SEED, &grant_id.to_le_bytes()], bump)]
    pub grant: UncheckedAccount<'info>,
    /// The owner's active grant of this kind, revoked first; required when one exists.
    #[account(mut)]
    pub previous_grant: Option<AccountLoader<'info, Grant>>,
    pub system_program: Program<'info, System>,
}

#[event_cpi]
#[derive(Accounts)]
#[instruction(amount: u64, grant_id: u64)]
pub struct OwnerDepositAndGrant<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut, address = VAULT_CONFIG)]
    pub vault_config: AccountLoader<'info, VaultConfig>,
    #[account(mut, seeds = [ACCOUNT_SEED, owner.key().as_ref()], bump = account.load()?.bump)]
    pub account: AccountLoader<'info, VaultAccount>,
    #[account(mut, seeds = [CUSTODY_SEED, owner.key().as_ref()], bump = account.load()?.custody_bump)]
    pub custody: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub owner_ata: Box<Account<'info, TokenAccount>>,
    #[account(address = vault_config.load()?.collateral_mint @ VaultError::WrongCollateral)]
    pub collateral_mint: Box<Account<'info, Mint>>,
    pub token_program: Program<'info, Token>,
    /// CHECK: the new Grant PDA; created and written by the handler after the checks.
    #[account(mut, seeds = [GRANT_SEED, &grant_id.to_le_bytes()], bump)]
    pub grant: UncheckedAccount<'info>,
    #[account(mut)]
    pub previous_grant: Option<AccountLoader<'info, Grant>>,
    pub system_program: Program<'info, System>,
}

/// `owner_fund_grant` and `owner_revoke`.
#[event_cpi]
#[derive(Accounts)]
pub struct OwnerManageGrant<'info> {
    pub owner: Signer<'info>,
    #[account(mut, seeds = [ACCOUNT_SEED, owner.key().as_ref()], bump = account.load()?.bump)]
    pub account: AccountLoader<'info, VaultAccount>,
    #[account(mut)]
    pub grant: AccountLoader<'info, Grant>,
}

/// The grant a caller asks for.
#[derive(Clone, Copy)]
pub struct Terms {
    pub grant_id: u64,
    pub kind: u8,
    pub actor: Pubkey,
    pub caps: CapsArgs,
    pub expires_at_sec: i64,
    pub budget: u64,
}

/// The accounts creating a grant touches.
pub struct NewGrant<'a, 'info> {
    pub owner: &'a Signer<'info>,
    pub vault_config: &'a AccountLoader<'info, VaultConfig>,
    pub account: &'a AccountLoader<'info, VaultAccount>,
    pub grant: &'a UncheckedAccount<'info>,
    pub grant_bump: u8,
    pub previous: Option<&'a AccountLoader<'info, Grant>>,
    pub system_program: &'a Program<'info, System>,
}

/// Creates the PDA as Anchor's `init` does: `create_account`, or top up + allocate + assign when pre-funded.
fn create_grant_account(n: &NewGrant, grant_id: u64) -> Result<()> {
    let space = 8 + size_of::<Grant>();
    let lamports = Rent::get()?.minimum_balance(space);
    let (id, bump) = (grant_id.to_le_bytes(), [n.grant_bump]);
    let seeds: &[&[u8]] = &[GRANT_SEED, &id, &bump];
    let signer = &[seeds];
    let (payer, target, program) = (n.owner.to_account_info(), n.grant.to_account_info(), n.system_program.key());
    let current = target.lamports();
    if current == 0 {
        return system_program::create_account(CpiContext::new_with_signer(program, CreateAccount { from: payer, to: target }, signer), lamports, space as u64, &crate::ID);
    }
    let top_up = lamports.saturating_sub(current);
    if top_up > 0 {
        system_program::transfer(CpiContext::new(program, Transfer { from: payer, to: target.clone() }), top_up)?;
    }
    system_program::allocate(CpiContext::new_with_signer(program, Allocate { account_to_allocate: target.clone() }, signer), space as u64)?;
    system_program::assign(CpiContext::new_with_signer(program, Assign { account_to_assign: target }, signer), &crate::ID)
}

/// `owner_grant` steps 1–6 and effects. Returns the replaced grant's event (if one was revoked) and the new grant's.
pub fn create_grant(n: &NewGrant, t: Terms) -> Result<(Option<GrantRevoked>, GrantCreated)> {
    let now = Clock::get()?.unix_timestamp;
    let owner = n.owner.key();
    // 1–4. The next id, a known kind, a real actor, a future expiry.
    require!(t.grant_id == n.vault_config.load()?.next_grant_id, VaultError::StaleGrantId);
    let kind = usize::from(t.kind);
    require!(kind < GRANT_KINDS, VaultError::BadGrantKind);
    require!(t.actor != Pubkey::default(), VaultError::ZeroActor);
    require!(t.expires_at_sec > now, VaultError::BadExpiry);
    let revoked = {
        let mut account = n.account.load_mut()?;
        // 5. The active grant of this kind is revoked first, its budget back before the new one is taken.
        let active = account.active_grants[kind];
        let revoked = if active != 0 {
            let previous = n.previous.ok_or(VaultError::ActiveGrantMismatch)?;
            let mut p = previous.load_mut()?;
            require!(p.grant_id == active && p.owner == owner, VaultError::ActiveGrantMismatch);
            revoke(&mut p, &mut account)?.map(|returned| GrantRevoked { grant_id: active, owner, returned })
        } else {
            None
        };
        // 6. The budget comes out of `available`.
        account.available = account.available.checked_sub(t.budget).ok_or(VaultError::Insufficient)?;
        account.active_grants[kind] = t.grant_id;
        revoked
    };

    create_grant_account(n, t.grant_id)?;
    {
        let mut data = n.grant.try_borrow_mut_data()?;
        let (disc, body) = data.split_at_mut(8);
        disc.copy_from_slice(Grant::DISCRIMINATOR);
        let g: &mut Grant = bytemuck::try_from_bytes_mut(&mut body[..size_of::<Grant>()]).map_err(|_| ErrorCode::AccountDidNotDeserialize)?;
        *g = Grant {
            owner,
            actor: t.actor,
            grant_id: t.grant_id,
            expires_at_sec: t.expires_at_sec,
            spent_day: 0,
            spent_today: 0,
            budget: t.budget,
            max_stake_per_trade: t.caps.max_stake_per_trade,
            max_daily_spend: t.caps.max_daily_spend,
            max_open_positions: t.caps.max_open_positions,
            open_positions: 0,
            max_price_ticks: t.caps.max_price_ticks,
            kind: t.kind,
            revoked: 0,
            bump: n.grant_bump,
            _pad: [0; 3],
            _reserved: [0; 32],
        };
    }
    let mut config = n.vault_config.load_mut()?;
    config.next_grant_id = config.next_grant_id.checked_add(1).ok_or(VaultError::MathOverflow)?;

    let c = t.caps;
    let created = GrantCreated {
        grant_id: t.grant_id,
        owner,
        actor: t.actor,
        kind: t.kind,
        max_stake_per_trade: c.max_stake_per_trade,
        max_daily_spend: c.max_daily_spend,
        max_open_positions: c.max_open_positions,
        max_price_ticks: c.max_price_ticks,
        expires_at_sec: t.expires_at_sec,
        budget: t.budget,
    };
    Ok((revoked, created))
}

pub fn owner_grant(ctx: Context<OwnerGrant>, t: Terms) -> Result<()> {
    let a = &ctx.accounts;
    let n = NewGrant { owner: &a.owner, vault_config: &a.vault_config, account: &a.account, grant: &a.grant, grant_bump: ctx.bumps.grant, previous: a.previous_grant.as_ref(), system_program: &a.system_program };
    let (revoked, created) = create_grant(&n, t)?;
    if let Some(event) = revoked {
        emit_cpi!(event);
    }
    emit_cpi!(created);
    Ok(())
}

pub fn owner_deposit_and_grant(ctx: Context<OwnerDepositAndGrant>, amount: u64, t: Terms) -> Result<()> {
    let a = &ctx.accounts;
    let available = deposit(&a.owner, &a.account, &a.custody, &a.owner_ata, &a.collateral_mint, &a.token_program, amount)?;
    let n = NewGrant { owner: &a.owner, vault_config: &a.vault_config, account: &a.account, grant: &a.grant, grant_bump: ctx.bumps.grant, previous: a.previous_grant.as_ref(), system_program: &a.system_program };
    let (revoked, created) = create_grant(&n, t)?;
    emit_cpi!(Deposited { owner: a.owner.key(), amount, available });
    if let Some(event) = revoked {
        emit_cpi!(event);
    }
    emit_cpi!(created);
    Ok(())
}

pub fn owner_fund_grant(ctx: Context<OwnerManageGrant>, amount: u64) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let a = &ctx.accounts;
    let (grant_id, budget) = {
        let mut g = a.grant.load_mut()?;
        require_keys_eq!(g.owner, a.owner.key(), VaultError::NotGrantOwner);
        require_live(&g, now)?;
        require!(amount > 0, VaultError::ZeroAmount);
        let mut account = a.account.load_mut()?;
        account.available = account.available.checked_sub(amount).ok_or(VaultError::Insufficient)?;
        g.budget = g.budget.checked_add(amount).ok_or(VaultError::MathOverflow)?;
        (g.grant_id, g.budget)
    };
    emit_cpi!(GrantFunded { grant_id, amount, budget });
    Ok(())
}

pub fn owner_revoke(ctx: Context<OwnerManageGrant>) -> Result<()> {
    let a = &ctx.accounts;
    let owner = a.owner.key();
    let revoked = {
        let mut g = a.grant.load_mut()?;
        require_keys_eq!(g.owner, owner, VaultError::NotGrantOwner);
        // Already revoked: success and no event (`EventVault.sol:297`). Expired grants revoke normally.
        revoke(&mut g, &mut *a.account.load_mut()?)?.map(|returned| GrantRevoked { grant_id: g.grant_id, owner, returned })
    };
    if let Some(event) = revoked {
        emit_cpi!(event);
    }
    Ok(())
}
