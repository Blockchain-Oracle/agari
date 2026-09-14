//! Print helpers (S2 lane P): keys that sign real proofs, the policies that use them, instruction
//! builders, and a one-call world with a Series, books and Windows.

use agari_common::print::attested::{attest_message, AttestFields, ED25519_PROGRAM_ID};
use agari_common::print::redstone::MARKER;
use agari_common::seeds::event_authority_address;
use agari_events::instructions::{OpenWindowArgs, PolicyVersionArgs, PrintPolicyArgs, SetAuthoritiesArgs};
use anchor_lang::prelude::Pubkey;
use anchor_lang::solana_program::instruction::Instruction;
use anchor_lang::{AccountDeserialize, AccountSerialize, InstructionData, ToAccountMetas};
use base64::Engine;
use k256::ecdsa::{RecoveryId, Signature, SigningKey};
use pyth_solana_receiver_sdk::price_update::PriceUpdateV2;
use sha3::{Digest, Keccak256};
use solana_account::Account;
use solana_keypair::Keypair;
use solana_signer::Signer;

use crate::fixtures::{series_args, TRIAL_FROM};
use crate::harness::{key, Harness};
use crate::ix::window_accounts;

/// 2026-09-11 20:00:00Z: the boundary of the real archived Pyth trial update (TSLA 365.476, conf 0.06068).
pub const T_PYTH: i64 = 1_789_156_800;
pub const TSLA_FEED: [u8; 32] = [
    0x16, 0xda, 0xd5, 0x06, 0xd7, 0xdb, 0x8d, 0xa0, 0x1c, 0x87, 0x58, 0x1c, 0x87, 0xca, 0x89, 0x7a, 0x01, 0x2a, 0x15, 0x35,
    0x57, 0xd4, 0xd5, 0x78, 0xc3, 0xb9, 0xc9, 0xe1, 0xbc, 0x06, 0x32, 0xf1,
];
/// The newer receiver generation (`pro-compatible` feature), which agari-events does NOT accept (D-021).
pub const PRO_RECEIVER: Pubkey = anchor_lang::pubkey!("rec2HHDDnjLfj4kE7VyEtFA1HPGQLK33259532cRyHp");
pub const CLUSTER_TAG: u8 = 103;
pub const ATTEST_FEED: [u8; 32] = [0xA7; 32];

/// Five RedStone test signers and one attestor.
pub struct PrintKeys {
    pub redstone: Vec<SigningKey>,
    pub attestor: Keypair,
}

pub fn print_keys() -> PrintKeys {
    PrintKeys { redstone: (0..5).map(|i| SigningKey::from_bytes(&[i + 1; 32].into()).unwrap()).collect(), attestor: key(9) }
}

fn keccak(bytes: &[u8]) -> [u8; 32] {
    Keccak256::digest(bytes).into()
}

pub fn evm_address(k: &SigningKey) -> [u8; 20] {
    let point = k.verifying_key().to_encoded_point(false);
    keccak(&point.as_bytes()[1..])[12..].try_into().unwrap()
}

/// The fixture authorities, with the test RedStone signers (threshold 3) and the test attestor.
pub fn print_authorities(keys: &PrintKeys) -> SetAuthoritiesArgs {
    let mut a = crate::fixtures::authorities();
    for (slot, k) in a.redstone_signers.iter_mut().zip(&keys.redstone) {
        *slot = evm_address(k);
    }
    a.attestors[0] = keys.attestor.pubkey();
    a
}

pub fn feed(tag: &[u8]) -> [u8; 32] {
    let mut f = [0u8; 32];
    f[..tag.len()].copy_from_slice(tag);
    f
}

pub fn pyth_policy() -> PrintPolicyArgs {
    PrintPolicyArgs { source: 1, grace_sec: 5, feed_id: TSLA_FEED, max_conf_bps: 50, open_admission_sec: 900, close_admission_sec: 900, ..Default::default() }
}

pub fn attested_policy() -> PrintPolicyArgs {
    PrintPolicyArgs { source: 4, feed_id: ATTEST_FEED, min_delay_sec: 60, bar_len_sec: 60, open_admission_sec: 900, close_admission_sec: 900, ..Default::default() }
}

/// An open-ended version from the trial start: `primary`, plus an optional check at 25 bps / 120 s.
pub fn version(primary: PrintPolicyArgs, check: Option<PrintPolicyArgs>) -> PolicyVersionArgs {
    let (check, max_divergence_bps, check_admission_sec) = match check {
        Some(mut c) => {
            (c.open_admission_sec, c.close_admission_sec) = (120, 120);
            (c, 25, 120)
        }
        None => (PrintPolicyArgs::default(), 0, 0),
    };
    PolicyVersionArgs { valid_from_ts: TRIAL_FROM, valid_until_ts: i64::MAX, primary, check, max_divergence_bps, check_admission_sec }
}

/// One RedStone wire payload: a 142 B low-s signed package per key for `feed` at `ts_ms`, then the trailer.
pub fn redstone_payload(keys: &[SigningKey], feed_id: [u8; 32], value_e8: u128, ts_ms: u64) -> Vec<u8> {
    let mut out = Vec::new();
    for k in keys {
        let mut p = Vec::with_capacity(142);
        p.extend_from_slice(&feed_id);
        let mut value = [0u8; 32];
        value[16..].copy_from_slice(&value_e8.to_be_bytes());
        p.extend_from_slice(&value);
        p.extend_from_slice(&ts_ms.to_be_bytes()[2..]);
        p.extend_from_slice(&32u32.to_be_bytes());
        p.extend_from_slice(&1u32.to_be_bytes()[1..]);
        let (mut sig, mut recid): (Signature, RecoveryId) = k.sign_prehash_recoverable(&keccak(&p)).unwrap();
        if let Some(low) = sig.normalize_s() {
            sig = low;
            recid = RecoveryId::new(!recid.is_y_odd(), recid.is_x_reduced());
        }
        p.extend_from_slice(&sig.to_bytes());
        p.push(recid.to_byte());
        out.extend_from_slice(&p);
    }
    out.extend_from_slice(&(keys.len() as u16).to_be_bytes());
    out.extend_from_slice(&[0, 0, 0]);
    out.extend_from_slice(&MARKER);
    out
}

/// An ed25519 precompile instruction over `message`, with every offset naming `index` (its own position).
pub fn ed25519_ix(signer: &Keypair, message: &[u8], index: u16) -> Instruction {
    let signature = signer.sign_message(message);
    let (key_off, sig_off, msg_off) = (16u16, 48u16, 112u16);
    let mut data = vec![1u8, 0];
    for v in [sig_off, index, key_off, index, msg_off, message.len() as u16, index] {
        data.extend_from_slice(&v.to_le_bytes());
    }
    data.extend_from_slice(signer.pubkey().as_ref());
    data.extend_from_slice(signature.as_ref());
    data.extend_from_slice(message);
    Instruction { program_id: ED25519_PROGRAM_ID, accounts: vec![], data }
}

/// The 158 B message an attestor signs for `(market, which, T, price, expo)` on a 60 s bar fetched at `fetched_at_ts`.
pub fn attested_message(market: Pubkey, which: u8, t: i64, price: i64, expo: i32, fetched_at_ts: i64) -> [u8; 158] {
    attest_message(&AttestFields {
        program_id: agari_events::ID,
        cluster_tag: CLUSTER_TAG,
        market,
        which,
        boundary_ts: t,
        price,
        expo,
        feed_id: ATTEST_FEED,
        bar_start_ts: t - 60,
        bar_len_sec: 60,
        fetched_at_ts,
    })
}

/// The real archived TSLA trial update, as the default receiver stored it on a devnet fork (D-021).
pub fn pyth_fixture() -> PriceUpdateV2 {
    let text = std::fs::read_to_string(format!("{}/vectors/prints/pyth-tsla-1789156800.account.b64", env!("CARGO_MANIFEST_DIR"))).unwrap();
    let bytes = base64::engine::general_purpose::STANDARD.decode(text.trim()).unwrap();
    PriceUpdateV2::try_deserialize(&mut bytes.as_slice()).unwrap()
}

fn ix(accounts: impl ToAccountMetas, data: impl InstructionData) -> Instruction {
    Instruction { program_id: agari_events::ID, accounts: accounts.to_account_metas(None), data: data.data() }
}

fn event_authority() -> Pubkey {
    event_authority_address(&agari_events::ID).0
}

/// A Series with one policy version, `books` free books and the print keys, ready to open Windows.
pub struct World {
    pub h: Harness,
    pub keys: PrintKeys,
    pub series: Pubkey,
    pub books: Vec<Pubkey>,
}

impl World {
    pub fn new(basis_args: agari_events::instructions::RegisterSeriesArgs, v: PolicyVersionArgs, books: usize) -> Self {
        let keys = print_keys();
        let mut h = Harness::new();
        h.setup_config(print_authorities(&keys));
        let series = h.register_series(basis_args);
        h.add_policy(&series, 0, v).unwrap();
        let books = (0..books).map(|_| h.add_book(&series, 256)).collect();
        Self { h, keys, series, books }
    }

    /// A 5-minute Regular Series on `v` (ticker 1).
    pub fn regular(v: PolicyVersionArgs, books: usize) -> Self {
        Self::new(series_args(1, 300, 0), v, books)
    }

    /// Opens Window `index` on book `index` (clock set before `trading_start`) and returns its Market.
    pub fn open(&mut self, args: OpenWindowArgs) -> Pubkey {
        self.h.warp_to(args.trading_start - 60);
        let book = self.books[args.index as usize];
        self.h.open_window(&self.series, &book, args).expect("open window");
        window_accounts(&self.series, args.index).market
    }

    pub fn put_price_update(&mut self, owner: Pubkey, update: &PriceUpdateV2) -> Pubkey {
        let mut data = Vec::new();
        update.try_serialize(&mut data).unwrap();
        let address = self.h.fresh_key().pubkey();
        let lamports = self.h.svm.minimum_balance_for_rent_exemption(data.len());
        self.h.svm.set_account(address, Account { lamports, data, owner, executable: false, rent_epoch: 0 }).unwrap();
        address
    }

    pub fn pyth_ix(&self, market: Pubkey, price_update: Pubkey, which: u8) -> Instruction {
        let accounts = agari_events::accounts::PublicRecordPrintPyth { series: self.series, market, price_update, event_authority: event_authority(), program: agari_events::ID };
        ix(accounts, agari_events::instruction::PublicRecordPrintPyth { which })
    }

    pub fn redstone_ix(&self, market: Pubkey, which: u8, payload: Vec<u8>) -> Instruction {
        let accounts = agari_events::accounts::PublicRecordPrintRedstone { series: self.series, market, config: crate::ix::config(), event_authority: event_authority(), program: agari_events::ID };
        ix(accounts, agari_events::instruction::PublicRecordPrintRedstone { which, payload })
    }

    pub fn attested_ix(&self, market: Pubkey, which: u8, price: i64, expo: i32, t: i64, fetched_at_ts: i64) -> Instruction {
        let accounts = agari_events::accounts::PublicRecordPrintAttested {
            series: self.series,
            market,
            config: crate::ix::config(),
            instructions: anchor_lang::pubkey!("Sysvar1nstructions1111111111111111111111111"),
            event_authority: event_authority(),
            program: agari_events::ID,
        };
        ix(accounts, agari_events::instruction::PublicRecordPrintAttested { which, price, expo, bar_start_ts: t - 60, fetched_at_ts })
    }

    /// `[ed25519 over the attested message, public_record_print_attested]`, signed by `signer`.
    pub fn attested_pair(&self, signer: &Keypair, market: Pubkey, which: u8, price: i64, t: i64, fetched_at_ts: i64) -> [Instruction; 2] {
        let message = attested_message(market, which, t, price, -8, fetched_at_ts);
        [ed25519_ix(signer, &message, 0), self.attested_ix(market, which, price, -8, t, fetched_at_ts)]
    }

    pub fn copy_open_ix(&self, market: Pubkey, prev_market: Pubkey) -> Instruction {
        let accounts = agari_events::accounts::PublicCopyOpenFromPrev { series: self.series, market, prev_market, event_authority: event_authority(), program: agari_events::ID };
        ix(accounts, agari_events::instruction::PublicCopyOpenFromPrev {})
    }

    /// Sends `ixs` paid by the stranger: prints need no role.
    pub fn send(&mut self, ixs: &[Instruction]) -> Result<crate::Sent, u32> {
        self.h.send(ixs, &[&key(3)])
    }
}
