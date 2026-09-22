//! `operator_checkpoint` (desk.md §4.5): seals a non-action into the chain. Allowed while paused and in practice
//! mode: "paused, did nothing" is a record too.

use anchor_lang::prelude::*;

use crate::chain;
use crate::constants::DESK_SEED;
use crate::errors::DeskError;
use crate::events::Checkpoint;
use crate::state::Desk;

#[event_cpi]
#[derive(Accounts)]
pub struct OperatorCheckpoint<'info> {
    pub operator: Signer<'info>,
    /// CHECK: the desk's owner, bound by the desk's seeds and `has_one`; only its key is read.
    pub owner: UncheckedAccount<'info>,
    #[account(mut, seeds = [DESK_SEED, owner.key().as_ref()], bump = desk.load()?.bump, has_one = owner @ DeskError::NotOwner)]
    pub desk: AccountLoader<'info, Desk>,
}

/// Steps 1–3 of the operator checks (operator, non-zero hash, deadline), then `seq`/`head`.
pub fn operator_checkpoint(ctx: Context<OperatorCheckpoint>, deadline_sec: i64, decision_hash: [u8; 32]) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let owner = ctx.accounts.owner.key();
    let (seq, head) = {
        let mut desk = ctx.accounts.desk.load_mut()?;
        require!(desk.is_operator(&ctx.accounts.operator.key()), DeskError::NotOperator);
        require!(decision_hash != [0u8; 32], DeskError::ZeroHash);
        require!(now <= deadline_sec, DeskError::DeadlinePassed);
        let seq = chain::seal(&mut desk, &decision_hash)?;
        (seq, desk.head)
    };
    emit_cpi!(Checkpoint { owner, seq, decision_hash, head });
    Ok(())
}
