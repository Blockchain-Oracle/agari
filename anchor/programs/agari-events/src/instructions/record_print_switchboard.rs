//! `public_record_print_switchboard` (prints.md §4.4; session-lanes.md §2.2; events-instructions.md §2). The 24/7
//! token lane's print: the ed25519 quote instruction immediately before this one must carry one Switchboard Surge
//! quote over the policy's feed hash, signed at a slot the cluster still remembers by at least
//! `config.switchboard_min_oracles` distinct oracles of the pinned queue. Quotes carry a slot, not a timestamp, so
//! admission is clock-bounded (`T + min_delay_sec ≤ now ≤ T + admission_sec`): "observed ≤ 60 s after T".

use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{get_stack_height, TRANSACTION_LEVEL_STACK_HEIGHT};
use solana_instructions_sysvar::{load_current_index_checked, load_instruction_at_checked};

use agari_common::print::switchboard::{check_quote_ix, check_signers, check_slothash, quote_print, verify_with_crate, QuoteView};
use agari_common::print::PrintError;
use agari_common::seeds::CONFIG_SEED;

use super::print_rules::{admit, print_error, record};
use crate::errors::EventsError;
use crate::state::{GlobalConfig, Market, Series, Source};

/// `SysvarS1otHashes111111111111111111111111111`.
pub const SLOT_HASHES_ID: Pubkey = anchor_lang::pubkey!("SysvarS1otHashes111111111111111111111111111");

#[event_cpi]
#[derive(Accounts)]
pub struct PublicRecordPrintSwitchboard<'info> {
    pub series: AccountLoader<'info, Series>,
    #[account(mut)]
    pub market: AccountLoader<'info, Market>,
    #[account(seeds = [CONFIG_SEED], bump = config.load()?.bump)]
    pub config: AccountLoader<'info, GlobalConfig>,
    /// CHECK: key-pinned to `config.switchboard_queue` in the handler (the crate's verifier checks only its size);
    /// its data is read only as the queue's oracle signing keys.
    pub queue: UncheckedAccount<'info>,
    /// CHECK: address-constrained to the SlotHashes sysvar; read as bytes by `check_slothash` and the verifier.
    #[account(address = SLOT_HASHES_ID)]
    pub slothashes: UncheckedAccount<'info>,
    /// CHECK: address-constrained to the Instructions sysvar; read through the checked loaders.
    #[account(address = solana_instructions_sysvar::ID)]
    pub instructions: UncheckedAccount<'info>,
}

pub fn public_record_print_switchboard(ctx: Context<PublicRecordPrintSwitchboard>, which: u8) -> Result<()> {
    let clock = Clock::get()?;
    let now = clock.unix_timestamp;
    let series = ctx.accounts.series.load()?;
    let mut market = ctx.accounts.market.load_mut()?;
    // 1. Shared slot rules, including `T + min_delay_sec ≤ now ≤ T + admission_sec`.
    let slot = admit(&series, &ctx.accounts.series.key(), &market, which, Source::Switchboard, now)?;
    // 2. "The previous instruction" only means something at transaction level.
    require!(get_stack_height() == TRANSACTION_LEVEL_STACK_HEIGHT, EventsError::CpiNotAllowed);

    // 3. The pinned queue (a zero key is the unset placeholder, never a queue).
    let (queue_key, min_oracles) = {
        let config = ctx.accounts.config.load()?;
        (config.switchboard_queue, config.switchboard_min_oracles)
    };
    require!(queue_key != Pubkey::default() && ctx.accounts.queue.key() == queue_key, EventsError::SwitchboardQueueMismatch);

    // 4. The quote instruction at `cur − 1`.
    let sysvar = ctx.accounts.instructions.to_account_info();
    let current = load_current_index_checked(&sysvar)?;
    require!(current >= 1, EventsError::BadAttestation);
    let previous = load_instruction_at_checked(usize::from(current - 1), &sysvar)?;
    check_quote_ix(&previous.program_id, &previous.data, current).map_err(print_error)?;
    let quote = QuoteView::parse(&previous.data).map_err(print_error)?;

    // 5. Slot age first (so a stale quote is always named), then what the crate verifier would `assert!`, then the
    //    verifier itself.
    let max_slot_age = slot.policy.max_slot_age;
    match clock.slot.checked_sub(quote.slot()) {
        Some(age) if age <= u64::from(max_slot_age) => {}
        _ => return Err(print_error(PrintError::QuoteSlotStale)),
    }
    check_slothash(&quote, &ctx.accounts.slothashes.try_borrow_data()?).map_err(print_error)?;
    check_signers(&quote, &ctx.accounts.queue.try_borrow_data()?).map_err(print_error)?;
    let (queue, slothashes) = (ctx.accounts.queue.to_account_info(), ctx.accounts.slothashes.to_account_info());
    verify_with_crate(&queue, &slothashes, &sysvar, clock.slot, max_slot_age, &previous.data).map_err(print_error)?;

    // 6. Distinct oracles, the feed, the value; then record and emit.
    let raw = quote_print(&quote, &slot.policy.feed_id, max_slot_age, min_oracles, clock.slot, slot.t).map_err(print_error)?;
    let event = record(&mut market, ctx.accounts.market.key(), slot.which, Source::Switchboard, raw, now)?;
    drop(market);
    drop(series);
    emit_cpi!(event);
    Ok(())
}
