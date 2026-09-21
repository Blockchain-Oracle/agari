use agari_vault::state::Grant;
use anchor_lang::prelude::*;
use anchor_spl::token::{transfer_checked, TransferChecked};
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::constants::{FADE_SEED, REGISTRY_SEED, STRATEGY_SEED, SUBSCRIPTION_SEED};
use crate::errors::StrategyError;
use crate::events::{Faded, Subscribed, Unfaded, Unsubscribed};
use crate::state::{eligible_grant, Consent, FadeSubscription, Registry, Strategy, Subscription};

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
    /// CHECK: pinned to this wallet's fade record by seeds; read only to refuse a wallet that holds both (A-1c).
    #[account(seeds = [FADE_SEED, &strategy.strategy_id.to_le_bytes(), subscriber.key().as_ref()], bump)]
    pub fade: UncheckedAccount<'info>,
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
    require!(!active_consent::<FadeSubscription>(&ctx.accounts.fade.to_account_info())?, StrategyError::AlreadyFading);
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

/// Reads a consent record that may not exist yet at its own PDA.
///
/// Both instructions have to see the other direction's record to refuse a wallet that holds both, and that record
/// is usually absent. Anchor's `Account` cannot express "this exact PDA, or nothing there", so the address is
/// pinned by seeds and the bytes are read here: an empty account is simply no consent, and anything that is not a
/// whole record of the expected type is not consent either. `try_deserialize` checks the discriminator and the
/// length, so nothing is read past the end of the buffer.
fn active_consent<T: AccountDeserialize + Consent>(info: &AccountInfo) -> Result<bool> {
    let data = info.try_borrow_data()?;
    Ok(T::try_deserialize(&mut &data[..]).map(|record| record.is_active()).unwrap_or(false))
}

#[derive(Accounts)]
pub struct Fade<'info> {
    #[account(mut)]
    pub subscriber: Signer<'info>,
    #[account(seeds = [REGISTRY_SEED], bump = registry.bump)]
    pub registry: Account<'info, Registry>,
    #[account(mut, seeds = [STRATEGY_SEED, &strategy.strategy_id.to_le_bytes()], bump = strategy.bump)]
    pub strategy: Box<Account<'info, Strategy>>,
    #[account(
        init_if_needed,
        payer = subscriber,
        space = 8 + FadeSubscription::INIT_SPACE,
        seeds = [FADE_SEED, &strategy.strategy_id.to_le_bytes(), subscriber.key().as_ref()],
        bump,
    )]
    pub fade: Account<'info, FadeSubscription>,
    /// CHECK: pinned to this wallet's follow record by seeds; read only to refuse a wallet that holds both.
    #[account(seeds = [SUBSCRIPTION_SEED, &strategy.strategy_id.to_le_bytes(), subscriber.key().as_ref()], bump)]
    pub subscription: UncheckedAccount<'info>,
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

/// Consent to be copied **in the opposite direction**: the runner places the other side of whatever this strategy
/// decides, for this wallet only (A-1c).
///
/// Everything else is a subscription: the same eligible grant, the same fee to the creator, the same ceilings on
/// the vault. What it is not is a short — the position opened is an ordinary call on the other side of the same
/// Window. A wallet that already follows this strategy is refused rather than quietly holding both consents.
pub fn fade(ctx: Context<Fade>, max_fee_base: u64) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let subscriber = ctx.accounts.subscriber.key();
    ctx.accounts.strategy.takes_subscribers()?;
    require!(!active_consent::<Subscription>(&ctx.accounts.subscription.to_account_info())?, StrategyError::AlreadyFollowing);

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
    let fade = &mut ctx.accounts.fade;
    if !fade.active {
        strategy.subscribers = strategy.subscribers.checked_add(1).ok_or(StrategyError::MathOverflow)?;
    }
    fade.strategy_id = strategy.strategy_id;
    fade.subscriber = subscriber;
    fade.grant = grant_key;
    fade.grant_id = grant_id;
    fade.subscribed_at_sec = now;
    fade.active = true;
    fade.bump = ctx.bumps.fade;

    emit!(Faded { strategy_id: strategy.strategy_id, subscriber, grant_id, fee_base, subscribers: strategy.subscribers });
    Ok(())
}

#[derive(Accounts)]
pub struct Unfade<'info> {
    pub subscriber: Signer<'info>,
    #[account(mut, seeds = [STRATEGY_SEED, &strategy.strategy_id.to_le_bytes()], bump = strategy.bump)]
    pub strategy: Box<Account<'info, Strategy>>,
    #[account(
        mut,
        seeds = [FADE_SEED, &strategy.strategy_id.to_le_bytes(), subscriber.key().as_ref()],
        bump = fade.bump,
    )]
    pub fade: Account<'info, FadeSubscription>,
}

/// Ends the fade consent. As with an unsubscribe, revoking the grant on the vault is what actually stops the
/// runner; this keeps the registry's count honest either way.
pub fn unfade(ctx: Context<Unfade>) -> Result<()> {
    let fade = &mut ctx.accounts.fade;
    require!(fade.active, StrategyError::NotFading);
    fade.active = false;
    let strategy = &mut ctx.accounts.strategy;
    strategy.subscribers = strategy.subscribers.saturating_sub(1);
    emit!(Unfaded { strategy_id: strategy.strategy_id, subscriber: fade.subscriber, subscribers: strategy.subscribers });
    Ok(())
}
