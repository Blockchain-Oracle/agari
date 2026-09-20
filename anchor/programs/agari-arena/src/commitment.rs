//! The deck commitment, word for word what `packages/core/src/games/commitment.ts` encodes.
//!
//! Fixed 32-byte words with an explicit count before each array: chain id, the Arena account, the match id, the
//! policy version, the server seed, |client seeds|, the client seeds, |cards|, the cards. The counts are what make the
//! encoding unambiguous; without them, moving an element from the seeds to the cards would leave the concatenation
//! unchanged and two different decks would share a commitment. A Solana address is exactly one word: its 32 bytes.
//!
//! The golden vector below is the one in `commitment.test.ts`. If it ever has to change, both change in one commit
//! or the reveal stops verifying.

use anchor_lang::prelude::Pubkey;

fn word(value: u64) -> [u8; 32] {
    let mut out = [0u8; 32];
    out[24..].copy_from_slice(&value.to_be_bytes());
    out
}

pub fn preimage(chain_id: u64, arena: &Pubkey, match_id: &[u8; 32], policy_version: u32, server_seed: &[u8; 32], client_seeds: &[[u8; 32]], cards: &[Pubkey]) -> Vec<u8> {
    let mut out = Vec::with_capacity(32 * (7 + client_seeds.len() + cards.len()));
    out.extend_from_slice(&word(chain_id));
    out.extend_from_slice(arena.as_ref());
    out.extend_from_slice(match_id);
    out.extend_from_slice(&word(u64::from(policy_version)));
    out.extend_from_slice(server_seed);
    out.extend_from_slice(&word(client_seeds.len() as u64));
    for seed in client_seeds {
        out.extend_from_slice(seed);
    }
    out.extend_from_slice(&word(cards.len() as u64));
    for card in cards {
        out.extend_from_slice(card.as_ref());
    }
    out
}

/// keccak-256 of the preimage: the hash the deckmaster commits to before either player has seen a card.
pub fn deck_hash(chain_id: u64, arena: &Pubkey, match_id: &[u8; 32], policy_version: u32, server_seed: &[u8; 32], client_seeds: &[[u8; 32]], cards: &[Pubkey]) -> [u8; 32] {
    solana_keccak_hasher::hash(&preimage(chain_id, arena, match_id, policy_version, server_seed, client_seeds, cards)).to_bytes()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn hex(bytes: &[u8]) -> String {
        bytes.iter().map(|b| format!("{b:02x}")).collect()
    }

    const GOLDEN: &str = concat!(
        "000000000000000000000000000000000000000000000000000000000000c488",
        "000000000000000000000000aaaa000000000000000000000000000000000001",
        "1111111111111111111111111111111111111111111111111111111111111111",
        "0000000000000000000000000000000000000000000000000000000000000001",
        "2222222222222222222222222222222222222222222222222222222222222222",
        "0000000000000000000000000000000000000000000000000000000000000002",
        "3333333333333333333333333333333333333333333333333333333333333333",
        "4444444444444444444444444444444444444444444444444444444444444444",
        "0000000000000000000000000000000000000000000000000000000000000003",
        "a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1",
        "b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2",
        "c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3",
    );

    fn golden_input() -> (Pubkey, [[u8; 32]; 2], [Pubkey; 3]) {
        let mut arena = [0u8; 32];
        arena[12] = 0xaa;
        arena[13] = 0xaa;
        arena[31] = 0x01;
        (Pubkey::new_from_array(arena), [[0x33; 32], [0x44; 32]], [Pubkey::new_from_array([0xa1; 32]), Pubkey::new_from_array([0xb2; 32]), Pubkey::new_from_array([0xc3; 32])])
    }

    #[test]
    fn the_preimage_is_cores_golden_vector_byte_for_byte() {
        let (arena, seeds, cards) = golden_input();
        let got = preimage(50_312, &arena, &[0x11; 32], 1, &[0x22; 32], &seeds, &cards);
        assert_eq!(hex(&got), GOLDEN);
        assert_eq!(got.len(), 12 * 32);
    }

    #[test]
    fn no_two_decks_share_a_commitment() {
        let (arena, seeds, cards) = golden_input();
        let base = deck_hash(50_312, &arena, &[0x11; 32], 1, &[0x22; 32], &seeds, &cards);
        let reversed = [cards[2], cards[1], cards[0]];
        assert_ne!(deck_hash(50_312, &arena, &[0x11; 32], 1, &[0x22; 32], &seeds, &reversed), base);
        assert_ne!(deck_hash(103, &arena, &[0x11; 32], 1, &[0x22; 32], &seeds, &cards), base);
        assert_ne!(deck_hash(50_312, &arena, &[0x11; 32], 2, &[0x22; 32], &seeds, &cards), base);
        assert_ne!(deck_hash(50_312, &cards[0], &[0x11; 32], 1, &[0x22; 32], &seeds, &cards), base);
        // An element moved from the cards to the seeds: the explicit counts keep the two encodings apart.
        let moved_seeds = [seeds[0], seeds[1], [0xa1; 32]];
        assert_ne!(preimage(50_312, &arena, &[0x11; 32], 1, &[0x22; 32], &moved_seeds, &cards[1..]), preimage(50_312, &arena, &[0x11; 32], 1, &[0x22; 32], &seeds, &cards));
    }

    #[test]
    fn the_hash_is_keccak_256() {
        // keccak256("") is the well-known c5d2…a470, which SHA3-256 would not produce.
        assert_eq!(hex(&solana_keccak_hasher::hash(&[]).to_bytes()), "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470");
    }
}
