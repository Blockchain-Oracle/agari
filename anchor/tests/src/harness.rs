//! The VM, deployment, keys, clock and transaction sending.

use anchor_lang::prelude::Pubkey;
use anchor_lang::solana_program::bpf_loader_upgradeable;
use anchor_lang::solana_program::instruction::Instruction;
use anchor_lang::solana_program::program_pack::Pack;
use anchor_lang::solana_program::system_instruction;
use anchor_spl::token::spl_token;
use litesvm::LiteSVM;
use solana_account::Account;
use solana_clock::Clock;
use solana_instruction_error::InstructionError;
use solana_keypair::Keypair;
use solana_signer::Signer;
use solana_transaction::Transaction;
use solana_transaction_error::TransactionError;

pub const COLLATERAL_DECIMALS: u8 = 6;
pub const SOL: u64 = 1_000_000_000;

/// A confirmed transaction's cost.
#[derive(Debug, Clone, Copy)]
pub struct Sent {
    pub compute_units: u64,
    pub tx_bytes: usize,
}

pub struct Harness {
    pub svm: LiteSVM,
    /// Upgrade authority, config admin and default fee payer.
    pub admin: Keypair,
    pub roller: Keypair,
    /// A funded key with no role, for refusal tests.
    pub stranger: Keypair,
    pub mint: Pubkey,
    pub treasury: Pubkey,
    next_seed: u8,
}

/// Deterministic keys: the same seed always yields the same key.
pub fn key(seed: u8) -> Keypair {
    Keypair::new_from_array([seed; 32])
}

fn so_path() -> String {
    format!("{}/../target/deploy/agari_events.so", env!("CARGO_MANIFEST_DIR"))
}

impl Harness {
    /// A VM with agari-events deployed (upgrade authority = `admin`), keys funded, the mint and treasury created.
    pub fn new() -> Self {
        let mut h = Harness {
            svm: LiteSVM::new(),
            admin: key(1),
            roller: key(2),
            stranger: key(3),
            mint: Pubkey::default(),
            treasury: Pubkey::default(),
            next_seed: 100,
        };
        for k in [h.admin.pubkey(), h.roller.pubkey(), h.stranger.pubkey()] {
            h.svm.airdrop(&k, 1_000 * SOL).expect("airdrop");
        }
        h.deploy_upgradeable(&h.admin.pubkey());
        let mint = h.fresh_key();
        let treasury = h.fresh_key();
        h.create_mint(&mint);
        h.create_token_account(&treasury, &mint.pubkey(), &h.admin.pubkey());
        h.mint = mint.pubkey();
        h.treasury = treasury.pubkey();
        h
    }

    /// A new deterministic keypair (seeds 100, 101, …).
    pub fn fresh_key(&mut self) -> Keypair {
        self.next_seed = self.next_seed.checked_add(1).expect("seed space");
        key(self.next_seed)
    }

    /// The program the way `solana program deploy` leaves it: a Program account pointing at ProgramData.
    fn deploy_upgradeable(&mut self, authority: &Pubkey) {
        let elf = std::fs::read(so_path()).expect("run `NO_DNA=1 anchor build` first");
        let program_id = agari_events::ID;
        let program_data = bpf_loader_upgradeable::get_program_data_address(&program_id);
        // UpgradeableLoaderState::ProgramData { slot: 0, upgrade_authority_address: Some(authority) } (bincode) + ELF.
        let mut data = Vec::with_capacity(45 + elf.len());
        data.extend_from_slice(&3u32.to_le_bytes());
        data.extend_from_slice(&0u64.to_le_bytes());
        data.push(1);
        data.extend_from_slice(authority.as_ref());
        data.extend_from_slice(&elf);
        self.put(program_data, data, bpf_loader_upgradeable::ID, false);
        // UpgradeableLoaderState::Program { programdata_address }.
        let mut program = Vec::with_capacity(36);
        program.extend_from_slice(&2u32.to_le_bytes());
        program.extend_from_slice(program_data.as_ref());
        self.put(program_id, program, bpf_loader_upgradeable::ID, true);
    }

    fn put(&mut self, address: Pubkey, data: Vec<u8>, owner: Pubkey, executable: bool) {
        let lamports = self.svm.minimum_balance_for_rent_exemption(data.len());
        self.svm.set_account(address, Account { lamports, data, owner, executable, rent_epoch: 0 }).expect("set account");
    }

    /// Sends `ixs` with `signers[0]` as fee payer. `Err` carries the failing custom error code (or panics on a
    /// non-custom failure, printing the logs, so a broken fixture never passes as an expected refusal).
    pub fn send(&mut self, ixs: &[Instruction], signers: &[&Keypair]) -> Result<Sent, u32> {
        self.svm.expire_blockhash();
        let tx = Transaction::new_signed_with_payer(ixs, Some(&signers[0].pubkey()), signers, self.svm.latest_blockhash());
        let tx_bytes = tx.message_data().len() + 1 + 64 * tx.signatures.len();
        match self.svm.send_transaction(tx) {
            Ok(meta) => Ok(Sent { compute_units: meta.compute_units_consumed, tx_bytes }),
            Err(failed) => match failed.err {
                TransactionError::InstructionError(_, InstructionError::Custom(code)) => Err(code),
                other => panic!("transaction failed without a custom error: {other:?}\n{}", failed.meta.pretty_logs()),
            },
        }
    }

    /// Like `send`, but expects success and returns the cost.
    pub fn ok(&mut self, ixs: &[Instruction], signers: &[&Keypair]) -> Sent {
        match self.send(ixs, signers) {
            Ok(sent) => sent,
            Err(code) => panic!("expected success, got custom error {code}"),
        }
    }

    /// Sets the cluster clock to `unix_ts` (and moves the slot forward).
    pub fn warp_to(&mut self, unix_ts: i64) {
        let mut clock: Clock = self.svm.get_sysvar();
        clock.unix_timestamp = unix_ts;
        clock.slot += 1;
        self.svm.set_sysvar(&clock);
    }

    pub fn now(&self) -> i64 {
        self.svm.get_sysvar::<Clock>().unix_timestamp
    }

    pub fn account_data(&self, address: &Pubkey) -> Vec<u8> {
        self.svm.get_account(address).map(|a| a.data).unwrap_or_default()
    }

    fn create_mint(&mut self, mint: &Keypair) {
        let admin = self.admin.pubkey();
        let space = spl_token::state::Mint::LEN;
        let lamports = self.svm.minimum_balance_for_rent_exemption(space);
        let create = system_instruction::create_account(&admin, &mint.pubkey(), lamports, space as u64, &spl_token::ID);
        let init = spl_token::instruction::initialize_mint2(&spl_token::ID, &mint.pubkey(), &admin, None, COLLATERAL_DECIMALS).unwrap();
        let admin_kp = key(1);
        self.ok(&[create, init], &[&admin_kp, mint]);
    }

    pub fn create_token_account(&mut self, account: &Keypair, mint: &Pubkey, owner: &Pubkey) {
        let admin = self.admin.pubkey();
        let space = spl_token::state::Account::LEN;
        let lamports = self.svm.minimum_balance_for_rent_exemption(space);
        let create = system_instruction::create_account(&admin, &account.pubkey(), lamports, space as u64, &spl_token::ID);
        let init = spl_token::instruction::initialize_account3(&spl_token::ID, &account.pubkey(), mint, owner).unwrap();
        let admin_kp = key(1);
        self.ok(&[create, init], &[&admin_kp, account]);
    }
}

impl Default for Harness {
    fn default() -> Self {
        Self::new()
    }
}

