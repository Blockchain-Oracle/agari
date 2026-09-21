//! The registry's two rules and the seal, against a real vault Grant and a real sha256.

use super::*;
use anchor_lang::prelude::Pubkey;

const NOW: i64 = 1_800_000_000;

fn key(n: u8) -> Pubkey {
    Pubkey::new_from_array([n; 32])
}

fn envelope() -> Envelope {
    Envelope { max_stake_per_trade: 5_000_000, max_daily_spend: 50_000_000, max_open_positions: 4, max_price_ticks: 0 }
}

fn strategy() -> Strategy {
    Strategy {
        creator: key(1),
        runner: key(2),
        strategy_id: 1,
        spec_hash: [0; 32],
        metadata_hash: [0; 32],
        envelope: envelope(),
        subscription_fee_base: 0,
        created_at_sec: NOW,
        subscribers: 0,
        revision: 0,
        active: true,
        sealed: false,
        bump: 0,
        metadata: Vec::new(),
    }
}

/// A live strategy grant from `key(9)` to the strategy's runner, exactly on the envelope's ceilings.
fn grant() -> Grant {
    let mut g: Grant = bytemuck::Zeroable::zeroed();
    (g.owner, g.actor, g.grant_id, g.expires_at_sec, g.kind) = (key(9), key(2), 7, NOW + 3_600, GRANT_KIND_STRATEGY);
    (g.max_stake_per_trade, g.max_daily_spend, g.max_open_positions) = (5_000_000, 50_000_000, 4);
    g
}

#[test]
fn a_grant_on_the_envelopes_own_ceilings_is_inside_it() {
    assert_eq!(eligible_grant(&grant(), &strategy(), &key(9), NOW), Ok(()));
}

#[test]
fn a_grant_has_to_be_the_subscribers_a_strategy_grant_and_to_this_runner() {
    assert_eq!(eligible_grant(&grant(), &strategy(), &key(8), NOW), Err(StrategyError::NotGrantOwner));
    for kind in [0u8, 1] {
        assert_eq!(eligible_grant(&Grant { kind, ..grant() }, &strategy(), &key(9), NOW), Err(StrategyError::WrongGrantKind));
    }
    assert_eq!(eligible_grant(&Grant { actor: key(3), ..grant() }, &strategy(), &key(9), NOW), Err(StrategyError::WrongActor));
}

/// The vault's own rule (`caps::require_live`): not revoked, and live through the second it expires.
#[test]
fn a_revoked_or_expired_grant_backs_nothing() {
    assert_eq!(eligible_grant(&Grant { revoked: 1, ..grant() }, &strategy(), &key(9), NOW), Err(StrategyError::GrantNotLive));
    assert_eq!(eligible_grant(&Grant { expires_at_sec: NOW, ..grant() }, &strategy(), &key(9), NOW), Ok(()));
    assert_eq!(eligible_grant(&Grant { expires_at_sec: NOW - 1, ..grant() }, &strategy(), &key(9), NOW), Err(StrategyError::GrantNotLive));
}

#[test]
fn any_ceiling_wider_than_the_envelope_is_refused() {
    let s = strategy();
    for wide in [
        Grant { max_stake_per_trade: 5_000_001, ..grant() },
        Grant { max_daily_spend: 50_000_001, ..grant() },
        Grant { max_open_positions: 5, ..grant() },
        // The vault writes "no cap" as u64::MAX, which no finite envelope admits.
        Grant { max_stake_per_trade: u64::MAX, ..grant() },
    ] {
        assert_eq!(eligible_grant(&wide, &s, &key(9), NOW), Err(StrategyError::CapsOutsideEnvelope));
    }
    assert_eq!(eligible_grant(&Grant { max_stake_per_trade: 1, max_daily_spend: 1, max_open_positions: 1, ..grant() }, &s, &key(9), NOW), Ok(()));
}

/// A price ceiling runs the other way: 0 means none. An envelope that sets one refuses a grant that sets none.
#[test]
fn a_price_ceiling_binds_only_when_the_envelope_sets_one() {
    let open = strategy();
    assert_eq!(eligible_grant(&Grant { max_price_ticks: 990, ..grant() }, &open, &key(9), NOW), Ok(()));

    let capped = Strategy { envelope: Envelope { max_price_ticks: 700, ..envelope() }, ..strategy() };
    assert_eq!(eligible_grant(&Grant { max_price_ticks: 700, ..grant() }, &capped, &key(9), NOW), Ok(()));
    assert_eq!(eligible_grant(&Grant { max_price_ticks: 701, ..grant() }, &capped, &key(9), NOW), Err(StrategyError::CapsOutsideEnvelope));
    assert_eq!(eligible_grant(&Grant { max_price_ticks: 0, ..grant() }, &capped, &key(9), NOW), Err(StrategyError::CapsOutsideEnvelope));
}

#[test]
fn an_envelope_needs_all_three_ceilings() {
    assert_eq!(envelope().validate(), Ok(()));
    for bad in [Envelope { max_stake_per_trade: 0, ..envelope() }, Envelope { max_daily_spend: 0, ..envelope() }, Envelope { max_open_positions: 0, ..envelope() }] {
        assert_eq!(bad.validate(), Err(StrategyError::BadEnvelope));
    }
}

fn digest(bytes: &[u8]) -> [u8; 32] {
    solana_sha256_hasher::hash(bytes).to_bytes()
}

/// A strategy's words arrive in pieces, in any order, and it seals only when they are exactly what was declared.
#[test]
fn metadata_written_in_pieces_seals_only_when_it_is_whole() {
    let text: Vec<u8> = (0..1_700u32).map(|i| b'a' + (i % 26) as u8).collect();
    let mut s = strategy();
    s.begin_metadata(digest(&text), text.len()).unwrap();
    assert_eq!(s.takes_subscribers(), Err(StrategyError::NotSealed));

    s.write_metadata(0, &text[..700]).unwrap();
    assert_eq!(s.seal(digest(&s.metadata.clone())), Err(StrategyError::MetadataMismatch));
    assert!(!s.sealed);

    // The last piece before the middle one: order does not matter, only the result.
    s.write_metadata(1_400, &text[1_400..]).unwrap();
    s.write_metadata(700, &text[700..1_400]).unwrap();
    assert_eq!(s.seal(digest(&s.metadata.clone())), Ok(()));
    assert_eq!(s.takes_subscribers(), Ok(()));
    assert_eq!(s.metadata, text);
}

#[test]
fn a_sealed_text_cannot_be_rewritten_and_a_write_cannot_run_past_the_end() {
    let text = b"{\"name\":\"Quiet open\"}".to_vec();
    let mut s = strategy();
    s.begin_metadata(digest(&text), text.len()).unwrap();
    assert_eq!(s.write_metadata(text.len() - 1, b"ab"), Err(StrategyError::WriteOutOfBounds));
    assert_eq!(s.write_metadata(usize::MAX, b"a"), Err(StrategyError::WriteOutOfBounds));
    s.write_metadata(0, &text).unwrap();
    s.seal(digest(&text)).unwrap();
    assert_eq!(s.write_metadata(0, b"x"), Err(StrategyError::AlreadySealed));

    // A new revision starts the text over, unsealed, and takes no subscribers until it is sealed again.
    let next = b"{\"name\":\"Quiet open v2\"}".to_vec();
    s.begin_metadata(digest(&next), next.len()).unwrap();
    assert_eq!(s.takes_subscribers(), Err(StrategyError::NotSealed));
    s.write_metadata(0, &next).unwrap();
    assert_eq!(s.seal(digest(&text)), Err(StrategyError::MetadataMismatch));
    assert_eq!(s.seal(digest(&next)), Ok(()));
}

#[test]
fn metadata_has_a_ceiling_and_a_floor() {
    let mut s = strategy();
    assert_eq!(s.begin_metadata([0; 32], 0), Err(StrategyError::MetadataTooLong));
    assert_eq!(s.begin_metadata([0; 32], MAX_METADATA_LEN + 1), Err(StrategyError::MetadataTooLong));
    assert_eq!(s.begin_metadata([0; 32], MAX_METADATA_LEN), Ok(()));
}

#[test]
fn an_inactive_strategy_takes_nobody_even_when_sealed() {
    let mut s = Strategy { sealed: true, ..strategy() };
    assert_eq!(s.takes_subscribers(), Ok(()));
    s.active = false;
    assert_eq!(s.takes_subscribers(), Err(StrategyError::StrategyInactive));
}

/// A-1c: the two consent records, and the rule that a wallet may hold only one of them.
mod fade {
    use super::*;
    use anchor_lang::{AccountDeserialize, AccountSerialize, Discriminator};

    fn subscription(active: bool) -> Subscription {
        Subscription { strategy_id: 1, subscriber: key(9), grant: key(4), grant_id: 7, subscribed_at_sec: NOW, active, bump: 254 }
    }

    fn fade_record(active: bool) -> FadeSubscription {
        FadeSubscription { strategy_id: 1, subscriber: key(9), grant: key(4), grant_id: 7, subscribed_at_sec: NOW, active, bump: 253 }
    }

    fn bytes<T: AccountSerialize>(record: &T) -> Vec<u8> {
        let mut out = Vec::new();
        record.try_serialize(&mut out).unwrap();
        out
    }

    /// What the instruction's guard does with a buffer: deserialize as the expected record, or treat it as no consent.
    fn reads_active<T: AccountDeserialize + Consent>(data: &[u8]) -> bool {
        T::try_deserialize(&mut &data[..]).map(|record| record.is_active()).unwrap_or(false)
    }

    #[test]
    fn the_two_records_are_different_account_types() {
        assert_ne!(Subscription::DISCRIMINATOR, FadeSubscription::DISCRIMINATOR);
    }

    #[test]
    fn a_live_follow_is_consent_and_a_cancelled_one_is_not() {
        assert!(reads_active::<Subscription>(&bytes(&subscription(true))));
        assert!(!reads_active::<Subscription>(&bytes(&subscription(false))));
        assert!(reads_active::<FadeSubscription>(&bytes(&fade_record(true))));
        assert!(!reads_active::<FadeSubscription>(&bytes(&fade_record(false))));
    }

    /// The guard is handed an address, not a type: a follow record where a fade is expected must not count, or a
    /// wallet that follows a strategy could never fade any other one.
    #[test]
    fn one_record_is_never_mistaken_for_the_other() {
        assert!(!reads_active::<FadeSubscription>(&bytes(&subscription(true))));
        assert!(!reads_active::<Subscription>(&bytes(&fade_record(true))));
    }

    /// An account that was never created reads as empty, and a truncated one must not be read past its end.
    #[test]
    fn an_absent_or_half_written_record_is_no_consent() {
        assert!(!reads_active::<Subscription>(&[]));
        assert!(!reads_active::<FadeSubscription>(&[]));
        assert!(!reads_active::<Subscription>(&[0u8; 8]));
        let whole = bytes(&subscription(true));
        for cut in [8, 16, whole.len() - 1] {
            assert!(!reads_active::<Subscription>(&whole[..cut]), "a {cut}-byte buffer is not a consent record");
        }
    }

    /// Both records carry the same shape, which is what lets one guard read either.
    #[test]
    fn a_fade_records_the_same_consent_as_a_follow() {
        let (follow, fade) = (subscription(true), fade_record(true));
        assert_eq!((follow.strategy_id, follow.subscriber, follow.grant, follow.grant_id), (fade.strategy_id, fade.subscriber, fade.grant, fade.grant_id));
        assert_eq!(8 + Subscription::INIT_SPACE, 8 + FadeSubscription::INIT_SPACE);
    }
}
