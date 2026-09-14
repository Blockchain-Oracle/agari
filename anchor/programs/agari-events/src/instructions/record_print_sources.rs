//! `public_record_print_pyth`, `public_record_print_redstone` and `public_record_print_attested` (prints.md §4.1–4.3;
//! events-instructions.md §2). Permissionless: the first valid print wins its slot. Each handler admits the slot
//! (`print_rules::admit`), runs the source's pure verifier, then records the normalized print.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{get_stack_height, TRANSACTION_LEVEL_STACK_HEIGHT};
use pyth_solana_receiver_sdk::price_update::PriceUpdateV2;
use solana_instructions_sysvar::{load_current_index_checked, load_instruction_at_checked};

use agari_common::print::attested::{verify_attested, AttestFields, AttestedPolicy};
use agari_common::print::pyth::{verify_pyth, PythPolicy, PythUpdateView};
use agari_common::print::redstone::{verify_redstone, RedStonePolicy, RedStoneSigners};
use agari_common::seeds::CONFIG_SEED;

use super::print_rules::{admit, print_error, record};
use crate::errors::EventsError;
use crate::state::{GlobalConfig, Market, Series, Source};

#[event_cpi]
#[derive(Accounts)]
pub struct PublicRecordPrintPyth<'info> {
    pub series: AccountLoader<'info, Series>,
    #[account(mut)]
    pub market: AccountLoader<'info, Market>,
    /// Anchor's owner check pins the receiver compiled into `pyth-solana-receiver-sdk` (default feature, D-021).
    pub price_update: Account<'info, PriceUpdateV2>,
}

pub fn public_record_print_pyth(ctx: Context<PublicRecordPrintPyth>, which: u8) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let series = ctx.accounts.series.load()?;
    let mut market = ctx.accounts.market.load_mut()?;
    let slot = admit(&series, &ctx.accounts.series.key(), &market, which, Source::Pyth, now)?;
    let policy = PythPolicy { feed_id: slot.policy.feed_id, grace_sec: slot.policy.grace_sec, max_conf_bps: slot.policy.max_conf_bps };
    let raw = verify_pyth(&PythUpdateView::from(&*ctx.accounts.price_update), &policy, slot.t).map_err(print_error)?;
    let event = record(&mut market, ctx.accounts.market.key(), slot.which, Source::Pyth, raw, now)?;
    drop(market);
    drop(series);
    emit_cpi!(event);
    Ok(())
}

#[event_cpi]
#[derive(Accounts)]
pub struct PublicRecordPrintRedstone<'info> {
    pub series: AccountLoader<'info, Series>,
    #[account(mut)]
    pub market: AccountLoader<'info, Market>,
    #[account(seeds = [CONFIG_SEED], bump = config.load()?.bump)]
    pub config: AccountLoader<'info, GlobalConfig>,
}

/// `payload` is the RedStone wire payload: N single-feed packages then the trailer (prints.md §4.2).
pub fn public_record_print_redstone(ctx: Context<PublicRecordPrintRedstone>, which: u8, payload: Vec<u8>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let series = ctx.accounts.series.load()?;
    let mut market = ctx.accounts.market.load_mut()?;
    let slot = admit(&series, &ctx.accounts.series.key(), &market, which, Source::RedStone, now)?;
    let config = ctx.accounts.config.load()?;
    let signers = RedStoneSigners { signers: config.redstone_signers(), threshold: config.redstone_threshold };
    let policy = RedStonePolicy { feed_id: slot.policy.feed_id, strict_sec: slot.policy.strict_sec };
    let raw = verify_redstone(&payload, &policy, signers, slot.t, now).map_err(print_error)?;
    drop(config);
    let event = record(&mut market, ctx.accounts.market.key(), slot.which, Source::RedStone, raw, now)?;
    drop(market);
    drop(series);
    emit_cpi!(event);
    Ok(())
}

#[event_cpi]
#[derive(Accounts)]
pub struct PublicRecordPrintAttested<'info> {
    pub series: AccountLoader<'info, Series>,
    #[account(mut)]
    pub market: AccountLoader<'info, Market>,
    #[account(seeds = [CONFIG_SEED], bump = config.load()?.bump)]
    pub config: AccountLoader<'info, GlobalConfig>,
    /// CHECK: address-constrained to the Instructions sysvar; read through the checked loaders.
    #[account(address = solana_instructions_sysvar::ID)]
    pub instructions: UncheckedAccount<'info>,
}

/// "Demo data" by user opt-in only (plan PD-1). The ed25519 precompile instruction at `current − 1` must have signed
/// the exact 158 B message with a configured attestor (prints.md §4.3).
pub fn public_record_print_attested(
    ctx: Context<PublicRecordPrintAttested>,
    which: u8,
    price: i64,
    expo: i32,
    bar_start_ts: i64,
    fetched_at_ts: i64,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let series = ctx.accounts.series.load()?;
    let mut market = ctx.accounts.market.load_mut()?;
    let slot = admit(&series, &ctx.accounts.series.key(), &market, which, Source::Attested, now)?;
    // §4.3 step 1: "the previous instruction" only means something at transaction level.
    require!(get_stack_height() == TRANSACTION_LEVEL_STACK_HEIGHT, EventsError::CpiNotAllowed);

    let sysvar = ctx.accounts.instructions.to_account_info();
    let current = load_current_index_checked(&sysvar)?;
    require!(current >= 1, EventsError::BadAttestation);
    let previous = load_instruction_at_checked(usize::from(current - 1), &sysvar)?;

    let config = ctx.accounts.config.load()?;
    let fields = AttestFields {
        program_id: crate::ID,
        cluster_tag: config.cluster_tag,
        market: ctx.accounts.market.key(),
        which: u8::from(slot.which),
        boundary_ts: slot.t,
        price,
        expo,
        feed_id: slot.policy.feed_id,
        bar_start_ts,
        bar_len_sec: slot.policy.bar_len_sec,
        fetched_at_ts,
    };
    let policy = AttestedPolicy { feed_id: slot.policy.feed_id, min_delay_sec: slot.policy.min_delay_sec, bar_len_sec: slot.policy.bar_len_sec };
    let raw = verify_attested(&fields, &policy, &config.attestors, (&previous.program_id, &previous.data, current), now).map_err(print_error)?;
    drop(config);

    let event = record(&mut market, ctx.accounts.market.key(), slot.which, Source::Attested, raw, now)?;
    drop(market);
    drop(series);
    emit_cpi!(event);
    Ok(())
}
