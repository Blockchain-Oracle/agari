use agari_vault::state::Grant;
use anchor_lang::prelude::*;
use anchor_spl::token::{transfer_checked, TransferChecked};
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::constants::{REGISTRY_SEED, STRATEGY_SEED, SUBSCRIPTION_SEED};
use crate::errors::StrategyError;
use crate::events::{Subscribed, Unsubscribed};
use crate::state::{eligible_grant, Registry, Strategy, Subscription};

#[derive(Accounts)]
pub struct Subscribe<'info> {
    #[account(mut)]
    pub subscriber: Signer<'info>,
    #[account(seeds = [REGISTRY_SEED], bump = registry.bump)]
    pub registry: Account<'info, Registry>,
    #[account(mut, seeds = [STRATEGY_SEED, &strategy.strategy_id.to_le_bytes()], bump = strategy.bump)]
    pub strategy: Box<Account<'info, Strategy>>,
    #[account(
        init_if_needed,
        payer = subscriber,
        space = 8 + Subscription::INIT_SPACE,
        seeds = [SUBSCRIPTION_SEED, &strategy.strategy_id.to_le_bytes(), subscriber.key().as_ref()],
        bump,
    )]
    pub subscription: Account<'info, Subscription>,
    /// The subscriber's own grant on `agari-vault`. The loader checks the vault owns it, so it is a real Grant.
    pub grant: AccountLoader<'info, Grant>,
    /// Both token accounts are needed only when the strategy charges a fee.
    #[account(mut, token::mint = collateral_mint, token::authority = subscriber)]
    pub subscriber_token: Option<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, token::mint = collateral_mint, token::authority = strategy.creator)]
    pub creator_token: Option<InterfaceAccount<'info, TokenAccount>>,
    #[account(address = registry.collateral_mint)]
    pub collateral_mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

/// Consent to be copied: the caller's live strategy grant to this strategy's runner, inside the envelope.
///
/// The registry moves nothing but the fee, straight from the subscriber to the creator. Execution and every ceiling
/// live on the vault (AD-5), and the runner can only ever open positions the subscriber owns. `max_fee_base` is the
/// fee the subscriber was shown: a creator who raises it between the read and the signature gets a refusal, not
/// the higher fee.
pub fn subscribe(ctx: Context<Subscribe>, max_fee_base: u64) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let subscriber = ctx.accounts.subscriber.key();
    ctx.accounts.strategy.takes_subscribers()?;
    let (grant_key, grant_id) = {
        let grant = ctx.accounts.grant.load()?;
        eligible_grant(&grant, &ctx.accounts.strategy, &subscriber, now)?;
        (ctx.accounts.grant.key(), grant.grant_id)
    };

    let fee_base = ctx.accounts.strategy.subscription_fee_base;
    require!(fee_base <= max_fee_base, StrategyError::FeeAboveMax);
    if fee_base > 0 {
        let (Some(from), Some(to)) = (&ctx.accounts.subscriber_token, &ctx.accounts.creator_token) else {
            return Err(StrategyError::FeeAccountsMissing.into());
        };
        transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.key(),
                TransferChecked {
                    from: from.to_account_info(),
                    mint: ctx.accounts.collateral_mint.to_account_info(),
                    to: to.to_account_info(),
                    authority: ctx.accounts.subscriber.to_account_info(),
                },
            ),
            fee_base,
            ctx.accounts.collateral_mint.decimals,
        )?;
    }

    let strategy = &mut ctx.accounts.strategy;
    let subscription = &mut ctx.accounts.subscription;
    if !subscription.active {
        strategy.subscribers = strategy.subscribers.checked_add(1).ok_or(StrategyError::MathOverflow)?;
    }
    subscription.strategy_id = strategy.strategy_id;
    subscription.subscriber = subscriber;
    subscription.grant = grant_key;
    subscription.grant_id = grant_id;
    subscription.subscribed_at_sec = now;
    subscription.active = true;
    subscription.bump = ctx.bumps.subscription;

    emit!(Subscribed { strategy_id: strategy.strategy_id, subscriber, grant_id, fee_base, subscribers: strategy.subscribers });
    Ok(())
}

#[derive(Accounts)]
pub struct Unsubscribe<'info> {
    pub subscriber: Signer<'info>,
    #[account(mut, seeds = [STRATEGY_SEED, &strategy.strategy_id.to_le_bytes()], bump = strategy.bump)]
    pub strategy: Box<Account<'info, Strategy>>,
    #[account(
        mut,
        seeds = [SUBSCRIPTION_SEED, &strategy.strategy_id.to_le_bytes(), subscriber.key().as_ref()],
        bump = subscription.bump,
    )]
    pub subscription: Account<'info, Subscription>,
}

/// Ends the consent record. Revoking the grant on the vault is what actually stops the runner; this keeps the
/// registry's count honest either way, and works on an inactive strategy too.
pub fn unsubscribe(ctx: Context<Unsubscribe>) -> Result<()> {
    let subscription = &mut ctx.accounts.subscription;
    require!(subscription.active, StrategyError::NotSubscribed);
    subscription.active = false;
    let strategy = &mut ctx.accounts.strategy;
    strategy.subscribers = strategy.subscribers.saturating_sub(1);
    emit!(Unsubscribed { strategy_id: strategy.strategy_id, subscriber: subscription.subscriber, subscribers: strategy.subscribers });
    Ok(())
}
