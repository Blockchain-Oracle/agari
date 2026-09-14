//! Attested message layout (golden computed independently in Python) and every ed25519 offsets attack refused.

use super::*;

const T: i64 = 1_789_156_800;
const GOLDEN: &str = "61676172692d7072696e742d76310101010101010101010101010101010101010101010101010101010101010101670202020202020202020202020202020202020202020202020202020202020202\
01c05da46a0000000010ac2d0200000000fbffffffc05da46a000000000303030303030303030303030303030303030303030303030303030303030303845da46a000000003c000b5ea46a00000000";

fn fields() -> AttestFields {
    AttestFields {
        program_id: Pubkey::new_from_array([1; 32]),
        cluster_tag: 103,
        market: Pubkey::new_from_array([2; 32]),
        which: 1,
        boundary_ts: T,
        price: 36_547_600,
        expo: -5,
        feed_id: [3; 32],
        bar_start_ts: T - 60,
        bar_len_sec: 60,
        fetched_at_ts: T + 75,
    }
}

const POLICY: AttestedPolicy = AttestedPolicy { feed_id: [3; 32], min_delay_sec: 60, bar_len_sec: 60 };
const ATTESTOR: [u8; 32] = [9; 32];

/// The ed25519 precompile's own layout: `count ‖ pad ‖ offsets[14] ‖ pubkey[32] ‖ signature[64] ‖ message`.
fn ix_data(pubkey: [u8; 32], message: &[u8], index: u16) -> Vec<u8> {
    let (key_off, sig_off, msg_off) = (16u16, 48u16, 112u16);
    let mut d = vec![1u8, 0];
    for v in [sig_off, index, key_off, index, msg_off, message.len() as u16, index] {
        d.extend_from_slice(&v.to_le_bytes());
    }
    d.extend_from_slice(&pubkey);
    d.extend_from_slice(&[7u8; 64]);
    d.extend_from_slice(message);
    d
}

fn verify(f: &AttestFields, data: &[u8], cur: u16) -> Result<RawPrint, PrintError> {
    verify_attested(f, &POLICY, &[Pubkey::default(), Pubkey::new_from_array(ATTESTOR)], (&ED25519_PROGRAM_ID, data, cur), T + 80)
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

#[test]
fn message_layout_is_the_158_byte_golden() {
    let m = attest_message(&fields());
    assert_eq!(m.len(), 158);
    assert_eq!(hex(&m), GOLDEN);
}

#[test]
fn accepts_our_message_from_our_attestor_at_either_index_encoding() {
    let f = fields();
    let ok = RawPrint { price: 36_547_600, expo: -5, source_ts: T, signers: 1 };
    assert_eq!(verify(&f, &ix_data(ATTESTOR, &attest_message(&f), 2), 3), Ok(ok));
    assert_eq!(verify(&f, &ix_data(ATTESTOR, &attest_message(&f), u16::MAX), 3), Ok(ok));
}

#[test]
fn refuses_every_offsets_attack() {
    let f = fields();
    let msg = attest_message(&f);
    let good = ix_data(ATTESTOR, &msg, 2);
    // Any one index pointing at another instruction (where an attacker controls bytes) is refused.
    for field in [4usize, 8, 14] {
        let mut bad = good.clone();
        bad[field..field + 2].copy_from_slice(&0u16.to_le_bytes());
        assert_eq!(verify(&f, &bad, 3), Err(PrintError::BadAttestation), "index field at {field}");
    }
    let mut two = good.clone();
    two[0] = 2;
    assert_eq!(verify(&f, &two, 3), Err(PrintError::BadAttestation));
    let mut short_msg = good.clone();
    short_msg[12..14].copy_from_slice(&157u16.to_le_bytes());
    assert_eq!(verify(&f, &short_msg, 3), Err(PrintError::BadAttestation));
    let mut out_of_bounds = good.clone();
    out_of_bounds[10..12].copy_from_slice(&200u16.to_le_bytes());
    assert_eq!(verify(&f, &out_of_bounds, 3), Err(PrintError::BadAttestation));
    assert_eq!(verify(&f, &good[..20], 3), Err(PrintError::BadAttestation));
    assert_eq!(verify(&f, &good, 0), Err(PrintError::BadAttestation));
    let other_program = Pubkey::new_from_array([5; 32]);
    assert_eq!(verify_attested(&f, &POLICY, &[Pubkey::new_from_array(ATTESTOR)], (&other_program, &good, 3), T + 80), Err(PrintError::BadAttestation));
}

#[test]
fn refuses_strangers_and_any_other_message() {
    let f = fields();
    let msg = attest_message(&f);
    assert_eq!(verify(&f, &ix_data([8; 32], &msg, 2), 3), Err(PrintError::UnknownAttestor));
    assert_eq!(verify(&f, &ix_data([0; 32], &msg, 2), 3), Err(PrintError::UnknownAttestor));
    // Signed for another market (or cluster, slot, price…): the bytes differ.
    let other = attest_message(&AttestFields { market: Pubkey::new_from_array([4; 32]), ..f });
    assert_eq!(verify(&f, &ix_data(ATTESTOR, &other, 2), 3), Err(PrintError::BadAttestation));
    let devnet_sig_on_mainnet = AttestFields { cluster_tag: 101, ..f };
    assert_eq!(verify(&devnet_sig_on_mainnet, &ix_data(ATTESTOR, &msg, 2), 3), Err(PrintError::BadAttestation));
}

#[test]
fn bar_cutoff_and_value_rules() {
    let f = fields();
    let check = |g: AttestFields| verify(&g, &ix_data(ATTESTOR, &attest_message(&g), 2), 3);
    assert_eq!(check(AttestFields { bar_start_ts: T - 59, ..f }), Err(PrintError::BadAttestation));
    assert_eq!(check(AttestFields { fetched_at_ts: T + 59, ..f }), Err(PrintError::BadAttestation));
    assert_eq!(check(AttestFields { fetched_at_ts: T + 81, ..f }), Err(PrintError::BadAttestation));
    assert_eq!(check(AttestFields { feed_id: [6; 32], ..f }), Err(PrintError::BadAttestation));
    assert!(check(AttestFields { fetched_at_ts: T + 60, ..f }).is_ok());
    assert_eq!(check(AttestFields { price: 0, ..f }), Err(PrintError::InvalidPrintValue));
    assert_eq!(check(AttestFields { expo: 1, ..f }), Err(PrintError::InvalidPrintValue));
    assert_eq!(check(AttestFields { expo: -19, ..f }), Err(PrintError::InvalidPrintValue));
}
