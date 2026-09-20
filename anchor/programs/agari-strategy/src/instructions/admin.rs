use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use crate::constants::REGISTRY_SEED;
use crate::events::RegistryInitialized;
use crate::state::Registry;

#[derive(Accounts)]
pub struct AdminInitRegistry<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(init, payer = admin, space = 8 + Registry::INIT_SPACE, seeds = [REGISTRY_SEED], bump)]
    pub registry: Account<'info, Registry>,
    /// The one collateral subscription fees are paid in: the venue's.
    pub collateral_mint: InterfaceAccount<'info, Mint>,
    pub system_program: Program<'info, System>,
}

/// The registry holds no money and has no custody. All it keeps is the next strategy id and the mint fees move in.
pub fn admin_init_registry(ctx: Context<AdminInitRegistry>) -> Result<()> {
    let registry = &mut ctx.accounts.registry;
    registry.admin = ctx.accounts.admin.key();
    registry.collateral_mint = ctx.accounts.collateral_mint.key();
    registry.next_strategy_id = 1;
    registry.bump = ctx.bumps.registry;
    emit!(RegistryInitialized { registry: registry.key(), admin: registry.admin, collateral_mint: registry.collateral_mint });
    Ok(())
}
