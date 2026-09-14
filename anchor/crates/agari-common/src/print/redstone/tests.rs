//! RedStone verifier over synthetic packages in the exact wire format, signed by five test secp256k1 keys. The SDK
//! runs its real recovery path (host `secp256k1_recover` = k256), so these exercise the same code as on-chain.

use super::*;
use k256::ecdsa::{RecoveryId, Signature, SigningKey};
use k256::elliptic_curve::PrimeField;
use sha3::{Digest, Keccak256};

const T: i64 = 1_789_156_800;
const STRICT: u32 = 300;
const TSLA: [u8; 32] = *b"TSLA\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0";

fn keccak(bytes: &[u8]) -> [u8; 32] {
    Keccak256::digest(bytes).into()
}

fn key(i: u8) -> SigningKey {
    SigningKey::from_bytes(&[i + 1; 32].into()).unwrap()
}

fn address(k: &SigningKey) -> [u8; 20] {
    let point = k.verifying_key().to_encoded_point(false);
    keccak(&point.as_bytes()[1..])[12..].try_into().unwrap()
}

fn signers() -> Vec<[u8; 20]> {
    (0..5).map(|i| address(&key(i))).collect()
}

fn value32(v: u128) -> [u8; 32] {
    let mut out = [0u8; 32];
    out[16..].copy_from_slice(&v.to_be_bytes());
    out
}

/// One 142 B package: `feed[32] ‖ value[32] ‖ ts_ms[6] ‖ value_size[4] ‖ count[3] ‖ r‖s‖v[65]`, low-s signed.
fn package(k: &SigningKey, feed: [u8; 32], value: [u8; 32], ts_ms: u64) -> Vec<u8> {
    let mut p = Vec::with_capacity(PACKAGE_LEN);
    p.extend_from_slice(&feed);
    p.extend_from_slice(&value);
    p.extend_from_slice(&ts_ms.to_be_bytes()[2..]);
    p.extend_from_slice(&VALUE_SIZE.to_be_bytes());
    p.extend_from_slice(&1u32.to_be_bytes()[1..]);
    let (mut sig, mut recid): (Signature, RecoveryId) = k.sign_prehash_recoverable(&keccak(&p)).unwrap();
    if let Some(low) = sig.normalize_s() {
        sig = low;
        recid = RecoveryId::new(!recid.is_y_odd(), recid.is_x_reduced());
    }
    p.extend_from_slice(&sig.to_bytes());
    p.push(recid.to_byte());
    p
}

fn payload(packages: &[Vec<u8>]) -> Vec<u8> {
    let mut out: Vec<u8> = packages.concat();
    out.extend_from_slice(&(packages.len() as u16).to_be_bytes());
    out.extend_from_slice(&[0, 0, 0]);
    out.extend_from_slice(&MARKER);
    out
}

fn prices(values: &[u128]) -> Vec<Vec<u8>> {
    values.iter().enumerate().map(|(i, v)| package(&key(i as u8), TSLA, value32(*v), T as u64 * 1_000)).collect()
}

fn verify(payload: &[u8], now: i64) -> Result<RawPrint, PrintError> {
    let s = signers();
    verify_redstone(payload, &RedStonePolicy { feed_id: TSLA, strict_sec: STRICT }, RedStoneSigners { signers: &s, threshold: 3 }, T, now)
}

#[test]
fn five_signers_inside_strict_print_the_median() {
    let p = payload(&prices(&[36_547_000_000, 36_548_000_000, 36_547_600_000, 36_549_000_000, 36_546_000_000]));
    assert_eq!(p.len(), 5 * 142 + 14);
    assert_eq!(verify(&p, T + 10), Ok(RawPrint { price: 36_547_600_000, expo: -8, source_ts: T, signers: 5 }));
}

#[test]
fn four_inside_strict_is_refused_three_after_strict_prints() {
    let four = payload(&prices(&[1, 2, 3, 4]));
    assert_eq!(verify(&four, T + STRICT as i64 - 1), Err(PrintError::InsufficientRedStoneSigners));
    let three = payload(&prices(&[36_547_000_000, 36_547_600_000, 36_548_000_000]));
    assert_eq!(verify(&three, T + STRICT as i64 - 1), Err(PrintError::InsufficientRedStoneSigners));
    assert_eq!(verify(&three, T + STRICT as i64).map(|p| (p.price, p.signers)), Ok((36_547_600_000, 3)));
    let two = payload(&prices(&[1, 2]));
    assert_eq!(verify(&two, T + 900), Err(PrintError::InsufficientRedStoneSigners));
}

#[test]
fn even_count_takes_the_floor_average() {
    let four = payload(&prices(&[100_000_000, 200_000_000, 300_000_001, 400_000_000]));
    assert_eq!(verify(&four, T + STRICT as i64).map(|p| p.price), Ok(250_000_000));
}

#[test]
fn a_repeated_signer_refuses_the_whole_print() {
    let mut packages = prices(&[10, 11, 12, 13]);
    packages.push(package(&key(0), TSLA, value32(14), T as u64 * 1_000));
    assert_eq!(verify(&payload(&packages), T + 10), Err(PrintError::BadRedStonePackage));
}

#[test]
fn an_unknown_or_malleated_signature_drops_below_n() {
    let mut packages = prices(&[10, 11, 12, 13]);
    packages.push(package(&key(9), TSLA, value32(14), T as u64 * 1_000));
    assert_eq!(verify(&payload(&packages), T + 10), Err(PrintError::InsufficientRedStoneSigners));

    // High-s twin of a valid signature: the SDK rejects it as malleable, so that package counts for nothing.
    let mut packages = prices(&[10, 11, 12, 13, 14]);
    let sig_at = 77;
    let s_bytes: [u8; 32] = packages[4][sig_at + 32..sig_at + 64].try_into().unwrap();
    let s = k256::Scalar::from_repr(s_bytes.into()).unwrap();
    packages[4][sig_at + 32..sig_at + 64].copy_from_slice(&(-s).to_bytes());
    packages[4][sig_at + 64] ^= 1;
    assert_eq!(verify(&payload(&packages), T + STRICT as i64), Err(PrintError::InsufficientRedStoneSigners));
}

#[test]
fn timestamps_feeds_and_values_are_exact() {
    let mut packages = prices(&[10, 11, 12, 13]);
    packages.push(package(&key(4), TSLA, value32(14), (T as u64 + 10) * 1_000));
    assert_eq!(verify(&payload(&packages), T + 10), Err(PrintError::RedStoneTimestampMismatch));

    let nvda = *b"NVDA\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0";
    let wrong: Vec<_> = (0..5).map(|i| package(&key(i), nvda, value32(10), T as u64 * 1_000)).collect();
    assert_eq!(verify(&payload(&wrong), T + 10), Err(PrintError::FeedIdMismatch));

    let huge = payload(&prices(&[u128::from(u64::MAX); 5]));
    assert_eq!(verify(&huge, T + 10), Err(PrintError::InvalidPrintValue));
    let zero = payload(&prices(&[0, 0, 0, 0, 0]));
    assert_eq!(verify(&zero, T + 10), Err(PrintError::InsufficientRedStoneSigners));
}

#[test]
fn malformed_payloads_never_reach_crypto() {
    let good = payload(&prices(&[10, 11, 12, 13, 14]));
    let mut bad_marker = good.clone();
    *bad_marker.last_mut().unwrap() = 1;
    assert_eq!(verify(&bad_marker, T + 10), Err(PrintError::BadRedStonePackage));
    assert_eq!(verify(&good[1..], T + 10), Err(PrintError::BadRedStonePackage));
    assert_eq!(verify(&good[..10], T + 10), Err(PrintError::BadRedStonePackage));
    let six = payload(&[prices(&[1, 2, 3, 4, 5]), vec![package(&key(0), TSLA, value32(6), T as u64 * 1_000)]].concat());
    assert_eq!(verify(&six, T + 10), Err(PrintError::BadRedStonePackage));
    let mut two_points = good.clone();
    two_points[76] = 2; // data_point_count low byte of package 0
    assert_eq!(verify(&two_points, T + 10), Err(PrintError::BadRedStonePackage));
    let mut metadata = good;
    let len = metadata.len();
    metadata[len - 10] = 1; // unsigned metadata size
    assert_eq!(verify(&metadata, T + 10), Err(PrintError::BadRedStonePackage));
}
