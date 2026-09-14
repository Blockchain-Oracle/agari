//! Pyth verifier against the real archived trial update (anchor/tests/vectors/prints/pyth-tsla-1789156800.*).

use super::*;
use crate::print::normalize::normalize;
use base64::Engine as _;
use pythnet_sdk::{
    messages::{Message, PriceFeedMessage},
    wire::{
        from_slice,
        v1::{AccumulatorUpdateData, Proof},
    },
};

const B64: &str = include_str!("../../../../../tests/vectors/prints/pyth-tsla-1789156800.b64");
const EXPECTED: &str = include_str!("../../../../../tests/vectors/prints/pyth-tsla-1789156800.json");

fn hex32(s: &str) -> [u8; 32] {
    let mut out = [0u8; 32];
    for (i, byte) in out.iter_mut().enumerate() {
        *byte = u8::from_str_radix(&s[2 * i..2 * i + 2], 16).unwrap();
    }
    out
}

/// Every `PriceFeedMessage` inside a Hermes accumulator update (no Wormhole/Merkle verification: that is the
/// receiver's job on-chain; here we only need the exact message the receiver would store).
fn decode_messages(b64: &str) -> Vec<PriceFeedMessage> {
    let bytes = base64::engine::general_purpose::STANDARD.decode(b64.trim()).unwrap();
    let update = AccumulatorUpdateData::try_from_slice(&bytes).unwrap();
    let Proof::WormholeMerkle { updates, .. } = update.proof;
    updates
        .iter()
        .filter_map(|u| match from_slice::<byteorder::BE, Message>(u.message.as_ref()).unwrap() {
            Message::PriceFeedMessage(m) => Some(m),
            _ => None,
        })
        .collect()
}

struct Fixture {
    t: i64,
    view: PythUpdateView,
    policy: PythPolicy,
    normalized: i64,
}

fn fixture() -> Fixture {
    let exp: serde_json::Value = serde_json::from_str(EXPECTED).unwrap();
    let feed_id = hex32(exp["feedId"].as_str().unwrap());
    let messages = decode_messages(B64);
    assert_eq!(messages.len(), 3, "the archived update carries TSLA, QQQ and VOO");
    let m = messages.into_iter().find(|m| m.feed_id == feed_id).expect("TSLA message present");
    // The decoded bytes are exactly what Hermes parsed.
    assert_eq!(m.price, exp["price"].as_i64().unwrap());
    assert_eq!(m.conf, exp["conf"].as_u64().unwrap());
    assert_eq!(i64::from(m.exponent), exp["expo"].as_i64().unwrap());
    assert_eq!(m.publish_time, exp["publishTime"].as_i64().unwrap());
    assert_eq!(m.prev_publish_time, exp["prevPublishTime"].as_i64().unwrap());
    let view = PythUpdateView {
        fully_verified: true,
        feed_id: m.feed_id,
        price: m.price,
        conf: m.conf,
        exponent: m.exponent,
        publish_time: m.publish_time,
        prev_publish_time: m.prev_publish_time,
    };
    Fixture {
        t: exp["T"].as_i64().unwrap(),
        view,
        policy: PythPolicy { feed_id, grace_sec: 5, max_conf_bps: 50 },
        normalized: exp["normalizedPrice"].as_i64().unwrap(),
    }
}

#[test]
fn real_trial_update_prints_at_exact_t() {
    let f = fixture();
    let print = verify_pyth(&f.view, &f.policy, f.t).unwrap();
    assert_eq!(print, RawPrint { price: 36_547_600, expo: -5, source_ts: f.t, signers: 0 });
    assert_eq!(normalize(i128::from(print.price), print.expo), Ok(f.normalized));
}

#[test]
fn the_same_update_is_not_the_print_for_t_plus_or_minus_one() {
    let f = fixture();
    // T − 1: the update's prev_publish_time is T − 1, which is not < T − 1 (the previous update was that print).
    assert_eq!(verify_pyth(&f.view, &f.policy, f.t - 1), Err(PrintError::PrintNotUnique));
    // T + 1: the update was published before the boundary.
    assert_eq!(verify_pyth(&f.view, &f.policy, f.t + 1), Err(PrintError::PrintNotUnique));
}

#[test]
fn refuses_wrong_feed_unverified_and_wide_confidence() {
    let f = fixture();
    let wrong = PythPolicy { feed_id: [7u8; 32], ..f.policy };
    assert_eq!(verify_pyth(&f.view, &wrong, f.t), Err(PrintError::FeedIdMismatch));
    let partial = PythUpdateView { fully_verified: false, ..f.view };
    assert_eq!(verify_pyth(&partial, &f.policy, f.t), Err(PrintError::InsufficientVerification));
    // conf 6,068 on 36,547,600 is ≈ 1.66 bps: a 1 bp cap refuses it, 2 bp accepts.
    assert_eq!(verify_pyth(&f.view, &PythPolicy { max_conf_bps: 1, ..f.policy }, f.t), Err(PrintError::ConfidenceTooWide));
    assert!(verify_pyth(&f.view, &PythPolicy { max_conf_bps: 2, ..f.policy }, f.t).is_ok());
}

#[test]
fn grace_bounds_a_late_first_update() {
    let f = fixture();
    // A feed that skipped seconds: the first update after T is still the print while within grace.
    let late = PythUpdateView { publish_time: f.t + 5, prev_publish_time: f.t - 2, ..f.view };
    assert!(verify_pyth(&late, &f.policy, f.t).is_ok());
    let too_late = PythUpdateView { publish_time: f.t + 6, ..late };
    assert_eq!(verify_pyth(&too_late, &f.policy, f.t), Err(PrintError::PrintNotUnique));
    let zero = PythUpdateView { price: 0, ..f.view };
    assert_eq!(verify_pyth(&zero, &f.policy, f.t), Err(PrintError::InvalidPrintValue));
}

#[cfg(feature = "pyth")]
#[test]
fn sdk_account_converts_to_the_view() {
    use pyth_solana_receiver_sdk::price_update::{PriceUpdateV2, VerificationLevel};
    let f = fixture();
    let message = decode_messages(B64).into_iter().find(|m| m.feed_id == f.policy.feed_id).unwrap();
    let account = PriceUpdateV2 {
        write_authority: anchor_lang::prelude::Pubkey::default(),
        verification_level: VerificationLevel::Full,
        price_message: message,
        posted_slot: 0,
    };
    assert_eq!(PythUpdateView::from(&account), f.view);
    let partial = PriceUpdateV2 { verification_level: VerificationLevel::Partial { num_signatures: 3 }, ..account };
    assert!(!PythUpdateView::from(&partial).fully_verified);
}
