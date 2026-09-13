use anchor_lang::prelude::*;
use solana_instructions_sysvar::{load_current_index_checked, load_instruction_at_checked};
use switchboard_on_demand::QuoteVerifier;

use crate::SpikeError;

pub const ED25519_PROGRAM: Pubkey = pubkey!("Ed25519SigVerify111111111111111111111111111");

/// Verify a Switchboard ed25519 quote at absolute index `ed_idx`, accepting both the
/// JS SDK 3.10.6 "current instruction" (0xFFFF) encoding and absolute indices.
/// Returns (raw i128 value scaled 1e18, quote slot).
pub fn verify_single_feed<'info>(
    ix_sysvar: &AccountInfo<'info>,
    queue: &AccountInfo<'info>,
    slothashes: &AccountInfo<'info>,
    ed_idx: u16,
    expected_feed_id: &[u8; 32],
    min_distinct_sigs: usize,
    max_age_slots: u64,
) -> Result<(i128, u64)> {
    let cur = load_current_index_checked(ix_sysvar)?;
    require!(ed_idx < cur, SpikeError::BadQuote);
    let ix = load_instruction_at_checked(ed_idx as usize, ix_sysvar)?;
    require!(ix.program_id.to_bytes() == ED25519_PROGRAM.to_bytes(), SpikeError::BadQuote);
    let d = &ix.data;
    require!(d.len() >= 16, SpikeError::BadQuote);
    let n = d[0] as usize;
    // every offsets record: sig/pubkey/message instruction index must be 0xFFFF or ed_idx
    for i in 0..n {
        let o = 2 + i * 14;
        require!(d.len() >= o + 14, SpikeError::BadQuote);
        for off in [2usize, 6, 12] {
            let v = u16::from_le_bytes([d[o + off], d[o + off + 1]]);
            require!(v == u16::MAX || v == ed_idx, SpikeError::BadQuote);
        }
    }
    let clock = Clock::get()?;
    let quote = QuoteVerifier::new()
        .queue(queue)
        .slothash_sysvar(slothashes)
        .ix_sysvar(ix_sysvar)
        .clock_slot(clock.slot)
        .max_age(max_age_slots)
        .verify(d)
        .map_err(|_| error!(SpikeError::BadQuote))?;
    // QuoteVerifier does not dedupe oracle indices: enforce distinct signers here
    let mut seen = [false; 256];
    let mut distinct = 0usize;
    for s in 0..quote.oracle_count as usize {
        let idx = quote.oracle_index(s).map_err(|_| error!(SpikeError::BadQuote))? as usize;
        if !seen[idx] {
            seen[idx] = true;
            distinct += 1;
        }
    }
    require!(distinct >= min_distinct_sigs, SpikeError::BadQuote);
    let f = quote.feed(expected_feed_id).map_err(|_| error!(SpikeError::BadQuote))?;
    Ok((f.feed_value(), quote.slot()))
}
