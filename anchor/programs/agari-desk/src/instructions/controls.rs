//! Owner controls (desk.md §4.3–§4.4): limits, mode, operator, unpause, and `pause`, which the operator may call too.
//! Owner calls are never blocked by the desk's state.

use anchor_lang::prelude::*;

use crate::constants::{is_mode, DESK_SEED};
use crate::errors::DeskError;
use crate::events::{LimitsSet, ModeSet, OperatorRevoked, OperatorSet, Paused, Unpaused};
use crate::state::Desk;

#[event_cpi]
#[derive(Accounts)]
pub struct OwnerControls<'info> {
    pub owner: Signer<'info>,
    #[account(mut, seeds = [DESK_SEED, owner.key().as_ref()], bump = desk.load()?.bump, has_one = owner @ DeskError::NotOwner)]
    pub desk: AccountLoader<'info, Desk>,
}

pub fn owner_set_limits(ctx: Context<OwnerControls>, per_action_cap: u64, daily_cap: u64, max_premium_bps: u16, require_pyth_index: bool) -> Result<()> {
    require!(per_action_cap > 0 && per_action_cap <= daily_cap, DeskError::BadConfig);
    {
        let mut desk = ctx.accounts.desk.load_mut()?;
        desk.per_action_cap = per_action_cap;
        desk.daily_cap = daily_cap;
        desk.max_premium_bps = max_premium_bps;
        desk.require_pyth_index = u8::from(require_pyth_index);
    }
    emit_cpi!(LimitsSet { owner: ctx.accounts.owner.key(), per_action_cap, daily_cap, max_premium_bps, require_pyth_index });
    Ok(())
}

pub fn owner_set_mode(ctx: Context<OwnerControls>, mode: u8) -> Result<()> {
    require!(is_mode(mode), DeskError::BadConfig);
    ctx.accounts.desk.load_mut()?.mode = mode;
    emit_cpi!(ModeSet { owner: ctx.accounts.owner.key(), mode });
    Ok(())
}

pub fn owner_set_operator(ctx: Context<OwnerControls>, operator: Pubkey) -> Result<()> {
    let owner = ctx.accounts.owner.key();
    require!(operator != Pubkey::default() && operator != owner, DeskError::BadOperator);
    ctx.accounts.desk.load_mut()?.operator = operator;
    emit_cpi!(OperatorSet { owner, operator });
    Ok(())
}

/// Fire the agent: it loses all access at once and the desk is paused. Only the owner may start it again.
pub fn owner_revoke_operator(ctx: Context<OwnerControls>) -> Result<()> {
    let owner = ctx.accounts.owner.key();
    {
        let mut desk = ctx.accounts.desk.load_mut()?;
        desk.operator = Pubkey::default();
        desk.paused = 1;
    }
    emit_cpi!(OperatorRevoked { owner });
    emit_cpi!(Paused { owner, by: owner });
    Ok(())
}

pub fn owner_unpause(ctx: Context<OwnerControls>) -> Result<()> {
    ctx.accounts.desk.load_mut()?.paused = 0;
    emit_cpi!(Unpaused { owner: ctx.accounts.owner.key() });
    Ok(())
}

#[event_cpi]
#[derive(Accounts)]
pub struct Pause<'info> {
    /// The owner or the operator.
    pub signer: Signer<'info>,
    /// CHECK: the desk's owner, bound by the desk's seeds and `has_one`; only its key is read.
    pub owner: UncheckedAccount<'info>,
    #[account(mut, seeds = [DESK_SEED, owner.key().as_ref()], bump = desk.load()?.bump, has_one = owner @ DeskError::NotOwner)]
    pub desk: AccountLoader<'info, Desk>,
}

/// The owner or the operator may stop the desk. Only the owner may start it again.
pub fn pause(ctx: Context<Pause>) -> Result<()> {
    let by = ctx.accounts.signer.key();
    let owner = ctx.accounts.owner.key();
    {
        let mut desk = ctx.accounts.desk.load_mut()?;
        require!(by == desk.owner || desk.is_operator(&by), DeskError::NotOwnerOrOperator);
        desk.paused = 1;
    }
    emit_cpi!(Paused { owner, by });
    Ok(())
}
