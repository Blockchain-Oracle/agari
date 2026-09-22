//! `public_init_reference` and `public_post_reference` (desk.md §3, §4.2). Permissionless: anyone may pay to create a
//! name's reference and anyone may post one, but only a message signed by a configured attestor in the instruction
//! immediately before this one is accepted, exactly as attested prints are (`record_print_sources.rs`).

use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{get_stack_height, TRANSACTION_LEVEL_STACK_HEIGHT};
use anchor_spl::token_2022;
use anchor_spl::token_interface::Mint;
use core::mem::size_of;
use solana_instructions_sysvar::{load_current_index_checked, load_instruction_at_checked};

use crate::constants::{DESK_CONFIG, DESK_REF_SEED, TOKEN_DECIMALS};
use crate::errors::DeskError;
use crate::events::{ReferenceInitialized, ReferencePosted};
use crate::reference::{verify_reference, RefFields};
use crate::state::{DeskConfig, DeskRef};

#[event_cpi]
#[derive(Accounts)]
pub struct PublicInitReference<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// A PreStocks name: Token-2022, 9 decimals, checked in the handler.
    pub mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(init, payer = payer, space = 8 + size_of::<DeskRef>(), seeds = [DESK_REF_SEED, mint.key().as_ref()], bump)]
    pub desk_ref: AccountLoader<'info, DeskRef>,
    pub system_program: Program<'info, System>,
}

pub fn public_init_reference(ctx: Context<PublicInitReference>) -> Result<()> {
    let a = &ctx.accounts;
    require!(*a.mint.to_account_info().owner == token_2022::ID && a.mint.decimals == TOKEN_DECIMALS, DeskError::BadToken);
    {
        let mut r = a.desk_ref.load_init()?;
        r.mint = a.mint.key();
        r.bump = ctx.bumps.desk_ref;
    }
    emit_cpi!(ReferenceInitialized { mint: a.mint.key(), reference: a.desk_ref.key() });
    Ok(())
}

#[event_cpi]
#[derive(Accounts)]
pub struct PublicPostReference<'info> {
    pub payer: Signer<'info>,
    #[account(address = DESK_CONFIG)]
    pub config: AccountLoader<'info, DeskConfig>,
    /// CHECK: only its key is read; it is the reference's seed and `has_one` binds it.
    pub mint: UncheckedAccount<'info>,
    #[account(mut, seeds = [DESK_REF_SEED, mint.key().as_ref()], bump = desk_ref.load()?.bump, has_one = mint @ DeskError::WrongMint)]
    pub desk_ref: AccountLoader<'info, DeskRef>,
    /// CHECK: address-constrained to the Instructions sysvar; read through the checked loaders.
    #[account(address = solana_instructions_sysvar::ID)]
    pub instructions: UncheckedAccount<'info>,
}

/// The ed25519 precompile instruction at `current − 1` must have signed the exact 114 B message (desk.md §3).
pub fn public_post_reference(ctx: Context<PublicPostReference>, token_price_e8: u64, mark_price_e8: u64, multiplier_e12: u64, fetched_at_sec: i64) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let a = &ctx.accounts;
    // "The previous instruction" only means something at transaction level.
    require!(get_stack_height() == TRANSACTION_LEVEL_STACK_HEIGHT, DeskError::CpiNotAllowed);
    let sysvar = a.instructions.to_account_info();
    let current = load_current_index_checked(&sysvar)?;
    require!(current >= 1, DeskError::BadAttestation);
    let previous = load_instruction_at_checked(usize::from(current - 1), &sysvar)?;

    let config = a.config.load()?;
    let fields = RefFields { program_id: crate::ID, cluster_tag: config.cluster_tag, mint: a.mint.key(), token_price_e8, mark_price_e8, multiplier_e12, fetched_at_sec };
    let previous_fetched_at_sec = a.desk_ref.load()?.fetched_at_sec;
    verify_reference(&fields, &config.attestors, (&previous.program_id, &previous.data, current), previous_fetched_at_sec, now)?;
    drop(config);

    {
        let mut r = a.desk_ref.load_mut()?;
        r.token_price_e8 = token_price_e8;
        r.mark_price_e8 = mark_price_e8;
        r.multiplier_e12 = multiplier_e12;
        r.fetched_at_sec = fetched_at_sec;
        r.posted_by = a.payer.key();
    }
    emit_cpi!(ReferencePosted { mint: a.mint.key(), token_price_e8, mark_price_e8, multiplier_e12, fetched_at_sec, posted_by: a.payer.key() });
    Ok(())
}
