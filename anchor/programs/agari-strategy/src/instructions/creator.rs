use anchor_lang::prelude::*;

use crate::constants::{REGISTRY_SEED, STRATEGY_SEED};
use crate::errors::StrategyError;
use crate::events::{Deactivated, Published, RunnerChanged, Sealed, Updated};
use crate::state::{Envelope, Registry, Strategy};

/// What a creator publishes or revises. The metadata itself is too long for one transaction, so its hash and
/// length are declared here with whatever first piece fits, and the rest follows through `creator_write_metadata`.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct Revision {
    pub spec_hash: [u8; 32],
    pub metadata_hash: [u8; 32],
    pub metadata_len: u16,
    pub first_chunk: Vec<u8>,
    pub subscription_fee_base: u64,
}

fn begin(strategy: &mut Strategy, revision: &Revision) -> Result<()> {
    strategy.spec_hash = revision.spec_hash;
    strategy.subscription_fee_base = revision.subscription_fee_base;
    strategy.begin_metadata(revision.metadata_hash, usize::from(revision.metadata_len))?;
    strategy.write_metadata(0, &revision.first_chunk)?;
    Ok(())
}

#[derive(Accounts)]
pub struct CreatorPublish<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    #[account(mut, seeds = [REGISTRY_SEED], bump = registry.bump)]
    pub registry: Account<'info, Registry>,
    #[account(
        init,
        payer = creator,
        space = 8 + Strategy::INIT_SPACE,
        seeds = [STRATEGY_SEED, &registry.next_strategy_id.to_le_bytes()],
        bump,
    )]
    pub strategy: Box<Account<'info, Strategy>>,
    pub system_program: Program<'info, System>,
}

/// A strategy bound to one runner key and one envelope. The envelope is fixed for life: subscribers agreed to it.
pub fn creator_publish(ctx: Context<CreatorPublish>, runner: Pubkey, envelope: Envelope, revision: Revision) -> Result<()> {
    require_keys_neq!(runner, Pubkey::default(), StrategyError::ZeroRunner);
    envelope.validate()?;

    let registry = &mut ctx.accounts.registry;
    let strategy_id = registry.next_strategy_id;
    registry.next_strategy_id = strategy_id.checked_add(1).ok_or(StrategyError::MathOverflow)?;

    let strategy = &mut ctx.accounts.strategy;
    strategy.creator = ctx.accounts.creator.key();
    strategy.runner = runner;
    strategy.strategy_id = strategy_id;
    strategy.envelope = envelope;
    strategy.created_at_sec = Clock::get()?.unix_timestamp;
    strategy.subscribers = 0;
    strategy.revision = 0;
    strategy.active = true;
    strategy.bump = ctx.bumps.strategy;
    begin(strategy, &revision)?;

    emit!(Published {
        strategy: strategy.key(),
        strategy_id,
        creator: strategy.creator,
        runner,
        spec_hash: strategy.spec_hash,
        metadata_hash: strategy.metadata_hash,
        envelope,
        subscription_fee_base: strategy.subscription_fee_base,
    });
    Ok(())
}

/// Everything else a creator does to their own strategy.
#[derive(Accounts)]
pub struct CreatorEdit<'info> {
    pub creator: Signer<'info>,
    #[account(
        mut,
        seeds = [STRATEGY_SEED, &strategy.strategy_id.to_le_bytes()],
        bump = strategy.bump,
        has_one = creator @ StrategyError::NotCreator,
    )]
    pub strategy: Box<Account<'info, Strategy>>,
}

pub fn creator_write_metadata(ctx: Context<CreatorEdit>, offset: u16, chunk: Vec<u8>) -> Result<()> {
    ctx.accounts.strategy.write_metadata(usize::from(offset), &chunk)?;
    Ok(())
}

/// Closes a revision's text: what was written has to hash to what was declared, or the strategy stays unsealed and
/// takes no subscribers. Until this lands, a half-written strategy is visible and harmless.
pub fn creator_seal(ctx: Context<CreatorEdit>) -> Result<()> {
    let strategy = &mut ctx.accounts.strategy;
    let digest = solana_sha256_hasher::hash(&strategy.metadata).to_bytes();
    strategy.seal(digest)?;
    emit!(Sealed { strategy_id: strategy.strategy_id, revision: strategy.revision, metadata_len: strategy.metadata.len() as u32 });
    Ok(())
}

/// A new spec revision or fee. The envelope does not change, and neither do the subscriptions already on record.
/// The new text is unsealed until `creator_seal`, so nobody new subscribes to words that are still being written.
pub fn creator_update(ctx: Context<CreatorEdit>, revision: Revision) -> Result<()> {
    let strategy = &mut ctx.accounts.strategy;
    begin(strategy, &revision)?;
    strategy.revision = strategy.revision.checked_add(1).ok_or(StrategyError::MathOverflow)?;
    emit!(Updated {
        strategy_id: strategy.strategy_id,
        spec_hash: strategy.spec_hash,
        metadata_hash: strategy.metadata_hash,
        subscription_fee_base: strategy.subscription_fee_base,
        revision: strategy.revision,
    });
    Ok(())
}

/// Rotate the runner key. Existing grants name the old key, so subscribers re-grant to follow.
pub fn creator_set_runner(ctx: Context<CreatorEdit>, runner: Pubkey) -> Result<()> {
    require_keys_neq!(runner, Pubkey::default(), StrategyError::ZeroRunner);
    let strategy = &mut ctx.accounts.strategy;
    strategy.runner = runner;
    emit!(RunnerChanged { strategy_id: strategy.strategy_id, runner });
    Ok(())
}

pub fn creator_deactivate(ctx: Context<CreatorEdit>) -> Result<()> {
    let strategy = &mut ctx.accounts.strategy;
    strategy.active = false;
    emit!(Deactivated { strategy_id: strategy.strategy_id });
    Ok(())
}
