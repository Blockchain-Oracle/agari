//! agari-swap-stub: a stand-in router for agari-desk's LiteSVM tests (desk.md §9). It does what a route does from
//! the desk's point of view, and nothing else: pulls `amount_in` from the caller's account into its pool, and pays
//! `amount_out` from its pool to the caller's receiving account. Both amounts are arguments, so a test can make it spend
//! the wrong amount, return too little, or return nothing, and watch the desk refuse. Extra accounts are ignored,
//! which is how a test slips a desk-owned account into the route to prove the leak check. Never deployed.

use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

declare_id!("DgmjPTF4CFfmw5CBQ12macVMuhYM4ogNiaCVwnu1t7ES");

pub const POOL_SEED: &[u8] = b"pool";

#[program]
pub mod agari_swap_stub {
    use super::*;

    /// `caller_in (authority) → pool_in` for `amount_in`, then `pool_out → caller_out` for `amount_out`.
    pub fn swap(ctx: Context<Swap>, amount_in: u64, amount_out: u64) -> Result<()> {
        let a = &ctx.accounts;
        if amount_in > 0 {
            token_interface::transfer_checked(
                CpiContext::new(
                    a.token_program_in.key(),
                    TransferChecked { from: a.caller_in.to_account_info(), mint: a.mint_in.to_account_info(), to: a.pool_in.to_account_info(), authority: a.authority.to_account_info() },
                ),
                amount_in,
                a.mint_in.decimals,
            )?;
        }
        if amount_out > 0 {
            let bump = [ctx.bumps.pool_authority];
            let seeds: &[&[u8]] = &[POOL_SEED, &bump];
            token_interface::transfer_checked(
                CpiContext::new_with_signer(
                    a.token_program_out.key(),
                    TransferChecked { from: a.pool_out.to_account_info(), mint: a.mint_out.to_account_info(), to: a.caller_out.to_account_info(), authority: a.pool_authority.to_account_info() },
                    &[seeds],
                ),
                amount_out,
                a.mint_out.decimals,
            )?;
        }
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Swap<'info> {
    /// The caller: the desk PDA, signing through `invoke_signed`.
    pub authority: Signer<'info>,
    #[account(mut)]
    pub caller_in: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub pool_in: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub pool_out: InterfaceAccount<'info, TokenAccount>,
    /// The caller's receiving account (the desk's own associated account in every honest test).
    #[account(mut)]
    pub caller_out: InterfaceAccount<'info, TokenAccount>,
    pub mint_in: InterfaceAccount<'info, Mint>,
    pub mint_out: InterfaceAccount<'info, Mint>,
    /// CHECK: the stub's `["pool"]` PDA, which owns `pool_in` and `pool_out`.
    #[account(seeds = [POOL_SEED], bump)]
    pub pool_authority: UncheckedAccount<'info>,
    pub token_program_in: Interface<'info, TokenInterface>,
    pub token_program_out: Interface<'info, TokenInterface>,
}
