//! The parts of an operator swap that are not the money maths (desk.md §4.5): the common first checks, which
//! reference the premium is measured against, the CPI into the router with the desk PDA as signer, and the leak
//! check over the route's accounts. `guard.rs` owns the numbers; `swap.rs` owns the order.

use agari_common::print::pyth::PythUpdateView;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::program::invoke_signed;
use anchor_spl::{token, token_2022};
use pyth_solana_receiver_sdk::price_update::PriceUpdateV2;

use crate::constants::{DESK_SEED, MODE_PRACTICE, REFERENCE_MARK, REFERENCE_PYTH_INDEX};
use crate::errors::DeskError;
use crate::reference::pyth_index_e8;
use crate::state::{Desk, DeskRef};

/// Steps 1–5: operator · non-zero hash and amount · deadline · not paused · not practice.
pub fn common_checks(desk: &Desk, signer: &Pubkey, decision_hash: &[u8; 32], amount: u64, deadline_sec: i64, now: i64) -> Result<()> {
    require!(desk.is_operator(signer), DeskError::NotOperator);
    require!(*decision_hash != [0u8; 32], DeskError::ZeroHash);
    require!(amount > 0, DeskError::ZeroAmount);
    require!(now <= deadline_sec, DeskError::DeadlinePassed);
    require!(!desk.is_paused(), DeskError::IsPaused);
    require!(desk.mode != MODE_PRACTICE, DeskError::ShadowMode);
    Ok(())
}

/// Step 8's reference: the PreStocks mark, or, when the owner requires it, Pyth's fully verified index for this name
/// (≤ 60 s). Returns the reference in E8 and the `Bought.reference_source` code.
pub fn premium_reference(desk: &Desk, desk_ref: &DeskRef, price_update: Option<&Account<PriceUpdateV2>>, now: i64) -> Result<(u64, u8)> {
    if desk.require_pyth_index == 0 {
        require!(desk_ref.mark_price_e8 > 0, DeskError::ReferenceUnavailable);
        return Ok((desk_ref.mark_price_e8, REFERENCE_MARK));
    }
    let update = price_update.ok_or(DeskError::PythIndexRequired)?;
    let view = PythUpdateView::from(&**update);
    Ok((pyth_index_e8(&view, &desk_ref.pyth_feed_id, now)?, REFERENCE_PYTH_INDEX))
}

/// Step 12: the route, forwarded as opaque bytes to the configured router with every remaining account as given and
/// the desk PDA flagged as signer (Jupiter's `user_transfer_authority`). The router account itself rides along so the
/// runtime can find the callee.
pub fn invoke_router<'info>(swap_program: &AccountInfo<'info>, remaining: &[AccountInfo<'info>], desk: &Pubkey, owner: &Pubkey, bump: u8, data: Vec<u8>) -> Result<()> {
    let accounts: Vec<AccountMeta> = remaining
        .iter()
        .map(|a| AccountMeta { pubkey: *a.key, is_signer: a.is_signer || a.key == desk, is_writable: a.is_writable })
        .collect();
    let instruction = Instruction { program_id: *swap_program.key, accounts, data };
    let mut infos: Vec<AccountInfo<'info>> = Vec::with_capacity(remaining.len() + 1);
    infos.extend(remaining.iter().cloned());
    infos.push(swap_program.clone());
    let bump = [bump];
    let seeds: &[&[u8]] = &[DESK_SEED, owner.as_ref(), &bump];
    invoke_signed(&instruction, &infos, &[seeds]).map_err(Into::into)
}

/// SPL Token and Token-2022 token accounts: 165 bytes, or longer with the account-type byte 2 at 165 (Token-2022 TLV).
const TOKEN_ACCOUNT_LEN: usize = 165;
const ACCOUNT_OWNER_RANGE: core::ops::Range<usize> = 32..64;
const ACCOUNT_STATE_AT: usize = 108;
const ACCOUNT_TYPE_AT: usize = 165;
const ACCOUNT_TYPE_ACCOUNT: u8 = 2;

/// Whether `data` is an initialised token account of either token program.
fn is_token_account(owner_program: &Pubkey, data: &[u8]) -> bool {
    if *owner_program != token::ID && *owner_program != token_2022::ID {
        return false;
    }
    let sized = data.len() == TOKEN_ACCOUNT_LEN || (data.len() > TOKEN_ACCOUNT_LEN && data[ACCOUNT_TYPE_AT] == ACCOUNT_TYPE_ACCOUNT);
    sized && data[ACCOUNT_STATE_AT] != 0
}

/// Step 14: every token account in the route whose owner is the desk PDA must be one of the desk's two named
/// associated accounts. Anything else is a way to move the desk's money somewhere the post-checks cannot see.
pub fn require_no_leak(remaining: &[AccountInfo], desk: &Pubkey, allowed: [&Pubkey; 2]) -> Result<()> {
    for info in remaining {
        let data = info.try_borrow_data()?;
        if !is_token_account(info.owner, &data) {
            continue;
        }
        let holder = Pubkey::try_from(&data[ACCOUNT_OWNER_RANGE]).map_err(|_| DeskError::DeskAccountLeak)?;
        require!(holder != *desk || allowed.contains(&info.key), DeskError::DeskAccountLeak);
    }
    Ok(())
}
