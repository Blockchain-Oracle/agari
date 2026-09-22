//! The hash chain over the record (desk.md §6): `head = sha256(head ‖ seq LE u64 ‖ decision_hash)` from 32 zero
//! bytes, advanced in the same transaction as the action it seals. `packages/core/src/desk/hashing.ts` `chainHead`
//! computes the same bytes; `anchor/tests/vectors/desk/chain-head.json` is asserted on both sides.

use anchor_lang::prelude::*;
use solana_sha256_hasher::hashv;

use crate::errors::DeskError;
use crate::state::Desk;

pub fn next_head(head: &[u8; 32], seq: u64, decision_hash: &[u8; 32]) -> [u8; 32] {
    hashv(&[head, &seq.to_le_bytes(), decision_hash]).to_bytes()
}

/// `seq += 1`, `head = next_head(...)`. Returns the new `seq`. A zero hash is refused before anything else.
pub fn seal(desk: &mut Desk, decision_hash: &[u8; 32]) -> Result<u64> {
    require!(*decision_hash != [0u8; 32], DeskError::ZeroHash);
    let seq = desk.seq.checked_add(1).ok_or(DeskError::MathOverflow)?;
    desk.head = next_head(&desk.head, seq, decision_hash);
    desk.seq = seq;
    Ok(seq)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;

    fn hex32(text: &str) -> [u8; 32] {
        let bytes: Vec<u8> = (2..text.len()).step_by(2).map(|i| u8::from_str_radix(&text[i..i + 2], 16).unwrap()).collect();
        bytes.try_into().unwrap()
    }

    #[test]
    fn chain_head_vectors() {
        let text = std::fs::read_to_string(format!("{}/../../tests/vectors/desk/chain-head.json", env!("CARGO_MANIFEST_DIR"))).unwrap();
        let file: Value = serde_json::from_str(&text).unwrap();
        // The canonical body's sha256, so the record hash and the chain agree on one hash function.
        let json = file["canonical"]["json"].as_str().unwrap();
        assert_eq!(hashv(&[json.as_bytes()]).to_bytes(), hex32(file["canonical"]["sha256"].as_str().unwrap()));
        let mut head = [0u8; 32];
        for step in file["steps"].as_array().unwrap() {
            assert_eq!(head, hex32(step["prevHead"].as_str().unwrap()));
            head = next_head(&head, step["seq"].as_u64().unwrap(), &hex32(step["decisionHash"].as_str().unwrap()));
            assert_eq!(head, hex32(step["head"].as_str().unwrap()));
        }
    }

    #[test]
    fn seal_advances_and_refuses_zero() {
        let mut desk = crate::state::Desk { owner: Pubkey::default(), operator: Pubkey::default(), head: [0; 32], seq: 0, per_action_cap: 0, daily_cap: 0, spent_in_window: 0, window_start_sec: 0, tokens: [crate::state::DeskToken::default(); 8], max_premium_bps: 0, mode: 0, paused: 0, require_pyth_index: 0, bump: 0, token_count: 0, _pad0: 0, _reserved: [0; 64] };
        assert!(seal(&mut desk, &[0u8; 32]).is_err());
        assert_eq!(seal(&mut desk, &[7u8; 32]).unwrap(), 1);
        assert_eq!(desk.head, next_head(&[0u8; 32], 1, &[7u8; 32]));
        assert_eq!(seal(&mut desk, &[7u8; 32]).unwrap(), 2);
    }
}
