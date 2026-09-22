//! agari-desk on LiteSVM (S21, desk.md §9): the desk and the stub router deployed upgradeable, a USDC stand-in (the
//! harness's 6-dp mint), a PreStocks-shaped Token-2022 name, the router's pool funded on both sides, a config with
//! one attestor, a posted reference, and an owner's desk with the name allowed.

use agari_desk::constants::{DESK_CONFIG, DESK_REF_SEED, DESK_SEED};
use agari_desk::state::{Desk, DeskConfig, DeskRef};
use agari_swap_stub::POOL_SEED;
use anchor_lang::prelude::Pubkey;
use anchor_lang::solana_program::bpf_loader_upgradeable;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_spl::associated_token::{get_associated_token_address, spl_associated_token_account::instruction::create_associated_token_account_idempotent};
use anchor_spl::token::spl_token;
use solana_account::Account;
use solana_keypair::Keypair;
use solana_signer::Signer;

use crate::desk_token::{NameMint, NAME_MULTIPLIER};
use crate::harness::{key, Harness, Sent, SOL};

pub const ONE_USDC: u64 = 1_000_000;
pub const ONE_TOKEN: u64 = 1_000_000_000;
/// 2026-09-21 00:26:40Z.
pub const T0: i64 = 1_790_000_000;
/// Core `CLUSTER_ID` localnet.
pub const CLUSTER_TAG: u8 = 104;
/// OPENAI on 2026-09-22: multiplier 1.4861347, token price $1,155.19; a fair mark at $1,100 (5.0 % premium).
pub const MULTIPLIER_E12: u64 = 1_486_134_700_000;
pub const TOKEN_PRICE_E8: u64 = 115_518_656_774;
pub const MARK_PRICE_E8: u64 = 110_000_000_000;
/// The real mark that day ($1,003): 15.2 % above, past a 10 % ceiling.
pub const RICH_MARK_E8: u64 = 100_300_000_000;
pub const PER_ACTION: u64 = 50 * ONE_USDC;
pub const DAILY: u64 = 150 * ONE_USDC;
pub const MAX_PREMIUM_BPS: u16 = 1000;
pub const MODE_ON_ITS_OWN: u8 = 2;
pub const HASH_A: [u8; 32] = [0xA1; 32];

pub struct DeskWorld {
    pub h: Harness,
    pub attestor: Keypair,
    pub operator: Keypair,
    pub owner: Keypair,
    pub usdc: Pubkey,
    pub name: NameMint,
    pub pool_authority: Pubkey,
    pub pool_usdc: Pubkey,
    pub pool_name: Pubkey,
    pub owner_usdc: Pubkey,
    pub owner_name: Pubkey,
}

/// A program deployed the way `solana program deploy` leaves it (upgrade authority = the admin, key 1).
pub fn deploy_program(h: &mut Harness, program_id: Pubkey, so_name: &str) {
    let elf = std::fs::read(format!("{}/../target/deploy/{so_name}.so", env!("CARGO_MANIFEST_DIR"))).expect("run `NO_DNA=1 anchor build --arch v0` first");
    let program_data = bpf_loader_upgradeable::get_program_data_address(&program_id);
    let mut data = Vec::with_capacity(45 + elf.len());
    data.extend_from_slice(&3u32.to_le_bytes());
    data.extend_from_slice(&0u64.to_le_bytes());
    data.push(1);
    data.extend_from_slice(key(1).pubkey().as_ref());
    data.extend_from_slice(&elf);
    let mut program = Vec::with_capacity(36);
    program.extend_from_slice(&2u32.to_le_bytes());
    program.extend_from_slice(program_data.as_ref());
    for (address, bytes, executable) in [(program_data, data, false), (program_id, program, true)] {
        let lamports = h.svm.minimum_balance_for_rent_exemption(bytes.len());
        h.svm.set_account(address, Account { lamports, data: bytes, owner: bpf_loader_upgradeable::ID, executable, rent_epoch: 0 }).expect("set account");
    }
}

pub fn desk_address(owner: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[DESK_SEED, owner.as_ref()], &agari_desk::ID).0
}

pub fn reference_address(mint: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[DESK_REF_SEED, mint.as_ref()], &agari_desk::ID).0
}

impl DeskWorld {
    /// Everything up to and including a reference posted at `T0`; the desk itself is opened by `open`.
    pub fn new() -> Self {
        let mut h = Harness::new();
        deploy_program(&mut h, agari_desk::ID, "agari_desk");
        deploy_program(&mut h, agari_swap_stub::ID, "agari_swap_stub");
        h.warp_to(T0);
        let attestor = key(9);
        let operator = h.fresh_key();
        let owner = h.fresh_key();
        for k in [&attestor, &operator, &owner] {
            h.svm.airdrop(&k.pubkey(), 100 * SOL).expect("airdrop");
        }
        let usdc = h.mint;
        let name = h.create_name_mint(NAME_MULTIPLIER);
        let pool_authority = Pubkey::find_program_address(&[POOL_SEED], &agari_swap_stub::ID).0;
        let pool_usdc = get_associated_token_address(&pool_authority, &usdc);
        let admin = key(1);
        let create = create_associated_token_account_idempotent(&admin.pubkey(), &pool_authority, &usdc, &spl_token::ID);
        h.ok(&[create], &[&admin]);
        h.donate(&pool_usdc, 1_000_000 * ONE_USDC);
        let pool_name = h.ata_2022(&admin, &pool_authority, &name.mint);
        h.mint_name(&name, &pool_name, 1_000 * ONE_TOKEN);
        let owner_usdc = get_associated_token_address(&owner.pubkey(), &usdc);
        let create = create_associated_token_account_idempotent(&owner.pubkey(), &owner.pubkey(), &usdc, &spl_token::ID);
        h.ok(&[create], &[&owner]);
        h.donate(&owner_usdc, 10_000 * ONE_USDC);
        let owner_name = h.ata_2022(&owner, &owner.pubkey(), &name.mint);
        h.mint_name(&name, &owner_name, 10 * ONE_TOKEN);

        let mut w = DeskWorld { h, attestor, operator, owner, usdc, name, pool_authority, pool_usdc, pool_name, owner_usdc, owner_name };
        let init = w.init_config_ix(&admin.pubkey(), CLUSTER_TAG, [w.attestor.pubkey(), Pubkey::default(), Pubkey::default(), Pubkey::default()]);
        w.h.ok(&[init], &[&admin]);
        let mint = w.name.mint;
        let init_ref = w.init_reference_ix(&admin.pubkey(), &mint);
        w.h.ok(&[init_ref], &[&admin]);
        w.post_reference(TOKEN_PRICE_E8, MARK_PRICE_E8, MULTIPLIER_E12, T0).expect("first reference");
        w
    }

    /// Opens the owner's desk with `operator`, the caps, the ceiling and `mode`, and allows the name. Returns the desk.
    pub fn open(&mut self, per_action_cap: u64, daily_cap: u64, max_premium_bps: u16, mode: u8) -> Pubkey {
        let owner = self.owner.pubkey();
        let operator = self.operator.pubkey();
        let open = self.open_desk_ix(&owner, operator, per_action_cap, daily_cap, max_premium_bps, mode);
        let allow = self.allow_token_ix(&owner, &self.name.mint);
        let owner_key = self.owner.insecure_clone();
        self.h.ok(&[open, allow], &[&owner_key]);
        desk_address(&owner)
    }

    /// The default desk: $50 an action, $150 a day, a 10 % ceiling, on its own.
    pub fn open_default(&mut self) -> Pubkey {
        self.open(PER_ACTION, DAILY, MAX_PREMIUM_BPS, MODE_ON_ITS_OWN)
    }

    pub fn desk_address(&self) -> Pubkey {
        desk_address(&self.owner.pubkey())
    }

    pub fn desk_usdc(&self) -> Pubkey {
        get_associated_token_address(&self.desk_address(), &self.usdc)
    }

    pub fn desk_name(&self) -> Pubkey {
        Harness::ata_2022_address(&self.desk_address(), &self.name.mint)
    }

    pub fn desk(&self) -> Desk {
        self.h.read(&self.desk_address())
    }

    pub fn config(&self) -> DeskConfig {
        self.h.read(&DESK_CONFIG)
    }

    pub fn reference(&self) -> DeskRef {
        self.h.read(&reference_address(&self.name.mint))
    }

    pub fn now(&self) -> i64 {
        self.h.now()
    }

    /// `[ed25519, public_post_reference]` signed by the configured attestor.
    pub fn post_reference(&mut self, token_price_e8: u64, mark_price_e8: u64, multiplier_e12: u64, fetched_at_sec: i64) -> Result<Sent, u32> {
        let attestor = self.attestor.insecure_clone();
        let payer = key(1);
        let ixs = self.post_reference_ixs(&attestor, &payer.pubkey(), &self.name.mint, token_price_e8, mark_price_e8, multiplier_e12, fetched_at_sec);
        self.h.send(&ixs, &[&payer])
    }

    /// Owner funding: `amount` USDC and `raw` of the name into the desk (the name arrives net of the 1 % fee).
    pub fn fund(&mut self, usdc: u64, raw: u64) {
        let owner = self.owner.insecure_clone();
        let mut ixs = vec![];
        if usdc > 0 {
            ixs.push(self.deposit_ix(&owner.pubkey(), &self.usdc, &self.owner_usdc, usdc));
        }
        if raw > 0 {
            ixs.push(self.deposit_ix(&owner.pubkey(), &self.name.mint, &self.owner_name, raw));
        }
        self.h.ok(&ixs, &[&owner]);
    }

    /// The operator's buy through the stub: `usdc_in` and `min_out` as the desk sees them; `stub_in` / `stub_out` are
    /// what the stub actually moves (equal to `usdc_in` and an honest fill unless a test says otherwise).
    pub fn buy(&mut self, usdc_in: u64, min_out: u64, hash: [u8; 32], stub_in: u64, stub_out: u64, extra: &[AccountMeta]) -> Result<(Sent, Vec<Vec<u8>>), u32> {
        let operator = self.operator.insecure_clone();
        let deadline = self.now() + 60;
        let ix = self.buy_ix(&operator.pubkey(), usdc_in, min_out, deadline, hash, stub_in, stub_out, extra);
        self.h.send_v0(&[ix], &operator, &[&operator])
    }

    pub fn sell(&mut self, token_in: u64, min_out: u64, hash: [u8; 32], stub_in: u64, stub_out: u64, extra: &[AccountMeta]) -> Result<(Sent, Vec<Vec<u8>>), u32> {
        let operator = self.operator.insecure_clone();
        let deadline = self.now() + 60;
        let ix = self.sell_ix(&operator.pubkey(), token_in, min_out, deadline, hash, stub_in, stub_out, extra);
        self.h.send_v0(&[ix], &operator, &[&operator])
    }

    pub fn checkpoint(&mut self, hash: [u8; 32]) -> Result<(Sent, Vec<Vec<u8>>), u32> {
        let operator = self.operator.insecure_clone();
        let deadline = self.now() + 60;
        let ix = self.checkpoint_ix(&operator.pubkey(), deadline, hash);
        self.h.send_v0(&[ix], &operator, &[&operator])
    }

    /// Sends `ixs` signed by `signer` (also paying), returning the desk's events or the custom error code.
    pub fn send_as(&mut self, signer: &Keypair, ixs: &[Instruction]) -> Result<(Sent, Vec<Vec<u8>>), u32> {
        self.h.send_v0(ixs, signer, &[signer])
    }

    /// The honest fill for `usdc_in`: what the stub must send so the desk receives 1 % more than the band floor.
    pub fn honest_fill(&self, usdc_in: u64) -> u64 {
        let floor = agari_desk::guard::buy_floor(usdc_in, MULTIPLIER_E12, TOKEN_PRICE_E8).unwrap();
        // The fee is withheld from what the stub sends, so send enough that the net still clears the floor with room.
        floor * 10_300 / 10_000
    }
}

impl Default for DeskWorld {
    fn default() -> Self {
        Self::new()
    }
}
