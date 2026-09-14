//! Byte layouts asserted against `events-accounts.md` §3 (D-006): sizes, every field offset, rent, and the
//! checked part splitters on an 8-aligned buffer (account data is 8-aligned on-chain).

use core::mem::{align_of, offset_of, size_of};

use anchor_lang::Discriminator;

use super::*;
use crate::constants::{BOOK_FIXED_LEN, LEDGER_HEADER_LEN, ORDER_NODE_LEN, SEAT_LEN};

macro_rules! offsets {
    ($t:ty { $($field:ident @ $off:expr),+ $(,)? }) => {
        $(assert_eq!(offset_of!($t, $field), $off, concat!(stringify!($t), ".", stringify!($field)));)+
    };
}

#[test]
fn sizes_and_alignment() {
    assert_eq!((size_of::<PrintPolicy>(), align_of::<PrintPolicy>()), (56, 4));
    assert_eq!((size_of::<PolicyVersion>(), align_of::<PolicyVersion>()), (136, 8));
    assert_eq!((size_of::<Print>(), align_of::<Print>()), (24, 8));
    assert_eq!(size_of::<GlobalConfig>(), 848);
    assert_eq!(size_of::<Series>(), 1_360);
    assert_eq!(size_of::<Market>(), 448);
    assert_eq!(size_of::<MarketResult>(), 248);
    assert_eq!((size_of::<Ledger>(), LEDGER_HEADER_LEN), (96, 96));
    assert_eq!((size_of::<Seat>(), SEAT_LEN), (88, 88));
    assert_eq!((size_of::<Level>(), size_of::<OrderNode>(), ORDER_NODE_LEN), (16, 48, 48));
    assert_eq!((size_of::<Book>(), BOOK_FIXED_LEN), (32_384, 32_384));
    for disc in [GlobalConfig::DISCRIMINATOR, Series::DISCRIMINATOR, Market::DISCRIMINATOR, MarketResult::DISCRIMINATOR, Ledger::DISCRIMINATOR, Book::DISCRIMINATOR] {
        assert_eq!(disc.len(), 8);
    }
}

#[test]
fn config_and_policy_offsets() {
    offsets!(GlobalConfig { admin @ 0, collateral_mint @ 32, token_program @ 64, treasury @ 96, rollers @ 128, attestors @ 256,
        program_authorities @ 384, switchboard_queue @ 640, redstone_signers @ 672, redstone_signer_count @ 772,
        redstone_threshold @ 773, switchboard_min_oracles @ 774, mode @ 775, collateral_decimals @ 776, cluster_tag @ 777,
        bump @ 778, _pad0 @ 779, result_retention_sec @ 780, _reserved @ 784 });
    offsets!(PrintPolicy { source @ 0, _pad0 @ 1, grace_sec @ 2, feed_id @ 4, min_delay_sec @ 36, bar_len_sec @ 38,
        max_conf_bps @ 40, max_slot_age @ 42, open_admission_sec @ 44, close_admission_sec @ 48, strict_sec @ 52 });
    offsets!(PolicyVersion { valid_from_ts @ 0, valid_until_ts @ 8, primary @ 16, check @ 72, max_divergence_bps @ 128,
        _pad0 @ 130, check_admission_sec @ 132 });
}

#[test]
fn series_market_result_offsets() {
    offsets!(Series { ticker @ 0, basis @ 2, bump @ 3, cadence_sec @ 4, lot_base @ 8, tick_base @ 16, cash_unit @ 24,
        min_lots @ 32, seat_bond @ 40, next_index @ 48, last_expiry @ 56, min_rest_slots @ 64, max_lead_sec @ 68,
        fills_cap @ 72, evictions_cap @ 73, version_count @ 74, free_book_count @ 75, _pad0 @ 76, free_books @ 80,
        policy_versions @ 208, _reserved @ 1_296 });
    offsets!(Print { price @ 0, source_ts @ 8, expo @ 16, source @ 20, signers @ 21, flags @ 22, _pad0 @ 23 });
    offsets!(Market { series @ 0, book @ 32, ledger @ 64, mvault @ 96, rent_payer @ 128, index @ 160, trading_start @ 168,
        lock_at @ 176, expiry @ 184, open_deadline @ 192, close_deadline @ 200, open @ 208, close @ 232, check_open @ 256,
        check_close @ 280, backing_lots @ 304, volume_cash @ 312, volume_lots @ 320, trade_count @ 328,
        last_trade_ts @ 336, event_seq @ 344, resolved_ts @ 352, payout_yes @ 360, payout_no @ 364, dependents @ 368,
        last_price @ 372, policy_version @ 374, open_kind @ 375, close_kind @ 376, basis @ 377, state @ 378,
        void_reason @ 379, flags @ 380, bump @ 381, ledger_bump @ 382, mvault_bump @ 383, _reserved @ 384 });
    offsets!(MarketResult { market @ 0, series @ 32, rent_payer @ 64, open @ 96, close @ 120, check_open @ 144,
        check_close @ 168, resolved_ts @ 192, payout_yes @ 200, payout_no @ 204, policy_version @ 208, void_reason @ 209,
        single_source @ 210, winner @ 211, bump @ 212, _pad0 @ 213, _reserved @ 216 });
}

#[test]
fn ledger_and_book_offsets() {
    offsets!(Ledger { market @ 0, rent_payer @ 32, seat_bond @ 64, capacity @ 72, seats_used @ 74, bump @ 76, _pad0 @ 77, _reserved @ 80 });
    offsets!(Seat { owner @ 0, credit @ 32, locked_cash @ 40, yes_free @ 48, yes_locked @ 56, no_free @ 64, no_locked @ 72,
        open_orders @ 80, flags @ 82, _pad0 @ 83 });
    offsets!(Book { market @ 0, series @ 32, next_seq @ 64, generation @ 72, capacity @ 76, order_count @ 80, free_head @ 84,
        high_water @ 88, _pad0 @ 92, bid_bits @ 96, ask_bits @ 224, _reserved @ 352, bids @ 384, asks @ 16_384 });
    offsets!(Level { head @ 0, tail @ 4, live_lots @ 8 });
    offsets!(OrderNode { lots @ 0, seq @ 8, expire_ts @ 16, placed_slot @ 24, prev @ 32, next @ 36, price @ 40, seat @ 42,
        kind @ 44, flags @ 45, _pad0 @ 46 });
}

#[test]
fn account_bytes_and_rent_match_the_spec() {
    let account = |size: usize| 8 + size;
    assert_eq!((account(size_of::<GlobalConfig>()), rent_lamports(856)), (856, 4_998_720));
    assert_eq!((account(size_of::<Series>()), rent_lamports(1_368)), (1_368, 7_599_680));
    assert_eq!((account(size_of::<Market>()), rent_lamports(456)), (456, 2_966_720));
    assert_eq!((account(size_of::<MarketResult>()), rent_lamports(256)), (256, 1_950_720));
    assert_eq!((ledger_space(96), rent_lamports(ledger_space(96))), (8_552, 44_094_400));
    assert_eq!((ledger_space(1_024), rent_lamports(ledger_space(1_024))), (90_216, 458_947_520));
    assert_eq!(ledger_space(96 + 116) - ledger_space(96), 10_208);
    assert!(ledger_space(96 + 117) - ledger_space(96) > 10_240, "116 seats is the most one realloc can add");
    assert_eq!((book_space(256), rent_lamports(book_space(256))), (44_680, 227_624_640));
    assert_eq!((book_space(512), rent_lamports(book_space(512))), (56_968, 290_047_680));
    assert_eq!(rent_lamports(165), 1_488_440);
}

/// An 8-aligned zeroed buffer of `len` bytes, like on-chain account data.
fn aligned(len: usize) -> Vec<u64> {
    vec![0u64; len.div_ceil(8)]
}

#[test]
fn part_splitters_check_discriminator_capacity_and_alignment() {
    let mut words = aligned(ledger_space(96));
    let bytes: &mut [u8] = &mut bytemuck::cast_slice_mut(&mut words)[..ledger_space(96)];
    assert!(ledger_parts_mut(bytes).is_err(), "zeroed discriminator is refused");
    bytes[..8].copy_from_slice(Ledger::DISCRIMINATOR);
    bytes[8 + 72..8 + 74].copy_from_slice(&96u16.to_le_bytes());
    let (header, seats) = ledger_parts_mut(bytes).unwrap();
    assert_eq!((header.capacity, seats.len()), (96, 96));
    seats[95].credit = 7;
    assert!(!seats[95].is_drained() && seats[0].is_empty());
    bytes[8 + 72..8 + 74].copy_from_slice(&97u16.to_le_bytes());
    assert!(ledger_parts_mut(bytes).is_err(), "seats must fill the account exactly");

    let mut words = aligned(book_space(256));
    let bytes: &mut [u8] = &mut bytemuck::cast_slice_mut(&mut words)[..book_space(256)];
    bytes[..8].copy_from_slice(Book::DISCRIMINATOR);
    bytes[8 + 76..8 + 80].copy_from_slice(&256u32.to_le_bytes());
    let (book, nodes) = book_parts_mut(bytes).unwrap();
    assert_eq!((book.capacity, nodes.len(), book.free_head), (256, 256, 0));
    book.capacity = 512;
    assert!(book_parts_mut(bytes).is_err(), "capacity must match the account length exactly");
}

#[test]
fn node_refs_and_bitmaps() {
    assert_eq!((node_ref(0), node_index(1), node_index(0)), (Some(1), Some(0), None));
    let mut bits = [0u64; 16];
    for p in [1u16, 63, 64, 500, 999] {
        bit_set(&mut bits, p, true);
        assert!(bit_is_set(&bits, p));
    }
    bit_set(&mut bits, 64, false);
    assert!(!bit_is_set(&bits, 64) && bit_is_set(&bits, 63) && !bit_is_set(&bits, 1_000));
}

#[test]
fn policy_coverage_and_market_status() {
    let mut series: Series = bytemuck::Zeroable::zeroed();
    let v = |from: i64, until: i64| PolicyVersion { valid_from_ts: from, valid_until_ts: until, ..Default::default() };
    // D-003 TSLA: v1 until Fri 20:00Z (inclusive), v2 from Fri 20:00Z open-ended.
    series.policy_versions[0] = v(100, 1_000);
    series.policy_versions[1] = v(1_000, i64::MAX);
    series.version_count = 2;
    assert_eq!(series.highest_covering_version(700, 1_000), Some(0), "Friday's last intraday Window stays on v1");
    assert_eq!(series.highest_covering_version(1_000, 5_000), Some(1), "the Gap Window is v2 only");
    assert_eq!(series.highest_covering_version(50, 150), None);

    let mut market: Market = bytemuck::Zeroable::zeroed();
    (market.trading_start, market.lock_at, market.expiry) = (100, 200, 300);
    assert_eq!([market.status(99), market.status(100), market.status(200)], [MarketStatus::Listed, MarketStatus::Trading, MarketStatus::Locked]);
    market.state = u8::from(MarketState::Voided);
    assert_eq!(market.status(150), MarketStatus::Voided, "a void before lock_at stops trading at once");
    assert_eq!((market.boundary(Which::CheckOpen), market.boundary(Which::Close)), (100, 300));
    assert_eq!(market.next_seq(), Some(1));
}
