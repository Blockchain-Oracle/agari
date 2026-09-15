//! `public_record_print_switchboard` (prints.md §4.4; session-lanes.md §2.2; events-instructions.md §2). The 24/7
//! token lane's print: the ed25519 quote instruction immediately before this one must carry one Switchboard Surge
//! quote over the policy's feed hash, signed at a slot the cluster still remembers by at least
//! `config.switchboard_min_oracles` distinct oracles of the pinned queue. Quotes carry a slot, not a timestamp, so
//! admission is clock-bounded (`T + min_delay_sec ≤ now ≤ T + admission_sec`): "observed ≤ 60 s after T".
//!
//! Because a quote only proves "these oracles ran the job around slot S", every quote inside that window is
//! admissible and whoever picks the quote picks the price. Two rules keep the choice out of a trader's hands
//! (D-088 security review):
//! - until `T + SWITCHBOARD_PUBLIC_AFTER_SEC` only a configured attestor may record; the public path then reopens so
//!   a stalled relay can't strand a Window;
//! - an Open whose previous Window is adjacent and already has its Close belongs to `public_copy_open_from_prev`, so
//!   Window N's close and Window N + 1's open are always the same print.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{get_stack_height, TRANSACTION_LEVEL_STACK_HEIGHT};
use solana_instructions_sysvar::{load_current_index_checked, load_instruction_at_checked};

use agari_common::print::switchboard::{
    check_queue_account, check_quote_ix, check_signers, check_slothash, queue_owner_for, quote_print, recorder_admitted, verify_with_crate, QuoteView,
};
use agari_common::print::PrintError;
use agari_common::seeds::{market_address, CONFIG_SEED};

use super::print_rules::{admit, print_error, record};
use crate::errors::EventsError;
use crate::state::{GlobalConfig, Market, Series, Source, Which};

/// `SysvarS1otHashes111111111111111111111111111`.
pub const SLOT_HASHES_ID: Pubkey = anchor_lang::pubkey!("SysvarS1otHashes111111111111111111111111111");

#[event_cpi]
#[derive(Accounts)]
pub struct PublicRecordPrintSwitchboard<'info> {
    /// Until `T + 40` this must be a `config.attestors` key; afterwards any signer records (the fee payer signs anyway).
    pub recorder: Signer<'info>,
    pub series: AccountLoader<'info, Series>,
    #[account(mut)]
    pub market: AccountLoader<'info, Market>,
    #[account(seeds = [CONFIG_SEED], bump = config.load()?.bump)]
    pub config: AccountLoader<'info, GlobalConfig>,
    /// The Switchboard queue whose ed25519 oracle signing keys must have signed the quote.
    /// CHECK: key-pinned to `config.switchboard_queue`, owner-pinned to the cluster's on-demand program, and its bytes
    /// checked in the handler (the crate's verifier checks only its size).
    pub queue: UncheckedAccount<'info>,
    /// CHECK: address-constrained to the SlotHashes sysvar; read as bytes by `check_slothash` and the verifier.
    #[account(address = SLOT_HASHES_ID)]
    pub slothashes: UncheckedAccount<'info>,
    /// CHECK: address-constrained to the Instructions sysvar; read through the checked loaders.
    #[account(address = solana_instructions_sysvar::ID)]
    pub instructions: UncheckedAccount<'info>,
    /// Window `index − 1` of this Series, required for an Open print past index 0: an Open whose previous Close is in
    /// must be copied, never printed.
    pub prev_market: Option<AccountLoader<'info, Market>>,
}

/// prints.md §4.5 belongs to `public_copy_open_from_prev`: refuse a direct Open while the adjacent previous Close exists.
fn check_open_is_not_copyable(ctx: &Context<PublicRecordPrintSwitchboard>, market: &Market, series_key: &Pubkey) -> Result<()> {
    let Some(index) = market.index.checked_sub(1) else {
        return Ok(()); // The first Window of a Series has no previous print to copy.
    };
    let prev = ctx.accounts.prev_market.as_ref().ok_or(error!(EventsError::PrintNotAdjacent))?;
    require_keys_eq!(prev.key(), market_address(&crate::ID, series_key, index).0, EventsError::PrintNotAdjacent);
    let prev = prev.load()?;
    let adjacent = prev.series == *series_key && prev.expiry == market.trading_start;
    require!(!(adjacent && !prev.close.is_empty()), EventsError::PrintNotAdjacent);
    Ok(())
}

pub fn public_record_print_switchboard(ctx: Context<PublicRecordPrintSwitchboard>, which: u8) -> Result<()> {
    let clock = Clock::get()?;
    let now = clock.unix_timestamp;
    let series = ctx.accounts.series.load()?;
    let series_key = ctx.accounts.series.key();
    let mut market = ctx.accounts.market.load_mut()?;
    // 1. Shared slot rules, including `T + min_delay_sec ≤ now ≤ T + admission_sec`.
    let slot = admit(&series, &series_key, &market, which, Source::Switchboard, now)?;
    // 2. "The previous instruction" only means something at transaction level.
    require!(get_stack_height() == TRANSACTION_LEVEL_STACK_HEIGHT, EventsError::CpiNotAllowed);

    // 3. The pinned queue (a zero key is the unset placeholder, never a queue), its owner and its own bytes.
    let (queue_key, min_oracles, is_attestor, cluster_tag) = {
        let config = ctx.accounts.config.load()?;
        (config.switchboard_queue, config.switchboard_min_oracles, config.is_attestor(&ctx.accounts.recorder.key()), config.cluster_tag)
    };
    require!(queue_key != Pubkey::default() && ctx.accounts.queue.key() == queue_key, EventsError::SwitchboardQueueMismatch);
    require_keys_eq!(*ctx.accounts.queue.owner, queue_owner_for(cluster_tag), EventsError::SwitchboardQueueMismatch);
    let oracle_count = check_queue_account(&ctx.accounts.queue.try_borrow_data()?).map_err(print_error)?;

    // 4. Who may choose the quote: an attestor at once, anyone once the public window opens.
    require!(recorder_admitted(is_attestor, now, slot.t), EventsError::UnknownAttestor);
    // 5. An Open that `public_copy_open_from_prev` can fill is not printable.
    if slot.which == Which::Open {
        check_open_is_not_copyable(&ctx, &market, &series_key)?;
    }

    // 6. The quote instruction at `cur − 1`.
    let sysvar = ctx.accounts.instructions.to_account_info();
    let current = load_current_index_checked(&sysvar)?;
    require!(current >= 1, EventsError::BadAttestation);
    let previous = load_instruction_at_checked(usize::from(current - 1), &sysvar)?;
    check_quote_ix(&previous.program_id, &previous.data, current).map_err(print_error)?;
    let quote = QuoteView::parse(&previous.data).map_err(print_error)?;

    // 7. Slot age first (so a stale quote is always named), then what the crate verifier would `assert!`, then the
    //    verifier itself.
    let max_slot_age = slot.policy.max_slot_age;
    match clock.slot.checked_sub(quote.slot()) {
        Some(age) if age <= u64::from(max_slot_age) => {}
        _ => return Err(print_error(PrintError::QuoteSlotStale)),
    }
    check_slothash(&quote, &ctx.accounts.slothashes.try_borrow_data()?).map_err(print_error)?;
    check_signers(&quote, &ctx.accounts.queue.try_borrow_data()?, oracle_count).map_err(print_error)?;
    let (queue, slothashes) = (ctx.accounts.queue.to_account_info(), ctx.accounts.slothashes.to_account_info());
    verify_with_crate(&queue, &slothashes, &sysvar, clock.slot, max_slot_age, &previous.data).map_err(print_error)?;

    // 8. Distinct oracles, the feed, the value; then record and emit.
    let raw = quote_print(&quote, &slot.policy.feed_id, max_slot_age, min_oracles, clock.slot, slot.t).map_err(print_error)?;
    let event = record(&mut market, ctx.accounts.market.key(), slot.which, Source::Switchboard, raw, now)?;
    drop(market);
    drop(series);
    emit_cpi!(event);
    Ok(())
}
