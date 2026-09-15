//! agari-vault on LiteSVM (S7a): both programs deployed upgradeable, the vault seat registered at program authority
//! index 0, an attested 5m Window trading, a maker with resting liquidity, funded owners, v0 sends that return the
//! vault's events, and the vault.md §1 invariants.

use agari_events::constants::LEDGER_HEADER_LEN;
use agari_events::instructions::PlaceOrderArgs;
use agari_vault::constants::{SEAT, VAULT_CONFIG};
use agari_vault::instructions::CapsArgs;
use agari_vault::state::{Grant, VaultAccount, VaultConfig};
use anchor_lang::prelude::{AnchorDeserialize, Pubkey};
use anchor_lang::solana_program::bpf_loader_upgradeable;
use anchor_lang::solana_program::instruction::Instruction;
use anchor_lang::Discriminator;
use anchor_spl::associated_token::spl_associated_token_account::instruction::create_associated_token_account_idempotent;
use anchor_spl::token::spl_token;
use solana_account::Account;
use solana_instruction_error::InstructionError;
use solana_keypair::Keypair;
use solana_message::{v0, VersionedMessage};
use solana_signer::Signer;
use solana_transaction::versioned::VersionedTransaction;
use solana_transaction_error::TransactionError;

use crate::fixtures::regular_window;
use crate::harness::{key, Harness, Sent, SOL};
use crate::ix::window_accounts;
use crate::prints::{attested_policy, print_authorities, version, World};
use crate::settlement::{Outcome, E8};
use crate::trade::{order_args, Window};
use crate::vault_ix::{account_address, custody_address, grant_address, GrantArgs};

/// One tUSDC (6 dp).
pub const ONE: u64 = 1_000_000;
/// 2026-09-12 00:00:00Z: a UTC day boundary; the default Window trades the five minutes before it.
pub const MIDNIGHT: i64 = 1_789_171_200;
pub const BUY_YES: u8 = 0;
pub const BUY_NO: u8 = 2;
pub const SESSION: u8 = 0;
pub const STRATEGY: u8 = 2;
pub const MAKER_PRICE: u16 = 600;

/// An owner key and its collateral ATA (holding 10,000 tUSDC before any deposit).
pub struct Owner {
    pub key: Keypair,
    pub ata: Pubkey,
}

impl Owner {
    pub fn pubkey(&self) -> Pubkey {
        self.key.pubkey()
    }
}

pub struct VaultWorld {
    pub w: World,
    pub win: Window,
    pub maker: (Keypair, Pubkey),
    /// The Window and kind the maker last rested.
    resting: Option<(Pubkey, u8)>,
}

/// The program deployed the way `solana program deploy` leaves it (upgrade authority = the admin, key 1).
pub fn deploy_vault(h: &mut Harness) {
    let elf = std::fs::read(format!("{}/../target/deploy/agari_vault.so", env!("CARGO_MANIFEST_DIR"))).expect("run `NO_DNA=1 anchor build --arch v0` first");
    let program_data = bpf_loader_upgradeable::get_program_data_address(&agari_vault::ID);
    let mut data = Vec::with_capacity(45 + elf.len());
    data.extend_from_slice(&3u32.to_le_bytes());
    data.extend_from_slice(&0u64.to_le_bytes());
    data.push(1);
    data.extend_from_slice(key(1).pubkey().as_ref());
    data.extend_from_slice(&elf);
    let mut program = Vec::with_capacity(36);
    program.extend_from_slice(&2u32.to_le_bytes());
    program.extend_from_slice(program_data.as_ref());
    for (address, bytes, executable) in [(program_data, data, false), (agari_vault::ID, program, true)] {
        let lamports = h.svm.minimum_balance_for_rent_exemption(bytes.len());
        h.svm.set_account(address, Account { lamports, data: bytes, owner: bpf_loader_upgradeable::ID, executable, rent_epoch: 0 }).expect("set account");
    }
}

impl VaultWorld {
    /// Registered vault, Window 0 trading `[MIDNIGHT − 300, MIDNIGHT)`, clock 10 s in.
    pub fn new() -> Self {
        Self::build(MIDNIGHT - 300, true)
    }

    /// `register = false` lists Window 0 while index 0 still holds the fixture's PROGRAM_SEAT_A, then leaves the
    /// vault unregistered (the caller registers it to reproduce a Window that predates the vault).
    pub fn build(start: i64, register: bool) -> Self {
        let mut w = World::regular(version(attested_policy(), None), 2);
        if register {
            w.h.register_vault_seat(&w.keys);
        }
        deploy_vault(&mut w.h);
        let admin = key(1);
        let init = w.h.vault_init_ix(&admin.pubkey());
        w.h.ok(&[init], &[&admin]);
        let market = w.open(regular_window(0, start, 300, 0));
        let a = window_accounts(&w.series, 0);
        let win = Window { series: w.series, book: w.books[0], market, ledger: a.ledger, mvault: a.mvault, start };
        w.h.warp_to(start + 10);
        let maker = w.h.funded_user(100_000 * ONE);
        VaultWorld { w, win, maker, resting: None }
    }

    /// Opens Window `index` on book `index` at `start` and moves the clock 10 s into it.
    pub fn open_window(&mut self, index: u64, start: i64) -> Window {
        let market = self.w.open(regular_window(index, start, 300, 0));
        let a = window_accounts(&self.w.series, index);
        self.w.h.warp_to(start + 10);
        Window { series: self.w.series, book: self.w.books[index as usize], market, ledger: a.ledger, mvault: a.mvault, start }
    }

    pub fn h(&mut self) -> &mut Harness {
        &mut self.w.h
    }

    /// A funded key with a 10,000 tUSDC ATA and no VaultAccount yet.
    pub fn wallet(&mut self) -> Owner {
        let h = &mut self.w.h;
        let owner = h.fresh_key();
        h.svm.airdrop(&owner.pubkey(), 10 * SOL).expect("airdrop");
        let ata = h.ata(&owner.pubkey());
        let create = create_associated_token_account_idempotent(&owner.pubkey(), &owner.pubkey(), &h.mint, &spl_token::ID);
        h.ok(&[create], &[&owner]);
        h.donate(&ata, 10_000 * ONE);
        Owner { key: owner, ata }
    }

    /// `wallet()` with its VaultAccount opened and `deposit` deposited.
    pub fn owner(&mut self, deposit: u64) -> Owner {
        let owner = self.wallet();
        let h = &mut self.w.h;
        let mut ixs = vec![h.vault_open_ix(&owner.pubkey())];
        if deposit > 0 {
            ixs.push(h.vault_deposit_ix(&owner.pubkey(), &owner.ata, deposit));
        }
        h.ok(&ixs, &[&owner.key]);
        owner
    }

    /// A funded key with no vault account (an actor, a cranker, a sponsor).
    pub fn key(&mut self) -> Keypair {
        let k = self.w.h.fresh_key();
        self.w.h.svm.airdrop(&k.pubkey(), 10 * SOL).expect("airdrop");
        k
    }

    /// `owner`'s Ledger seat on `win`, if it holds one.
    pub fn seat_of(&self, win: &Window, owner: &Pubkey) -> Option<u16> {
        let (_, seats) = self.w.h.ledger_state(&win.ledger);
        seats.iter().position(|s| s.owner == *owner).map(|i| i as u16)
    }

    /// The maker rests `kind` at `price` for `lots` (Normal order, its existing seat when it has one).
    pub fn maker_rest(&mut self, win: &Window, kind: u8, price: u16, lots: u64) {
        let seat_hint = self.seat_of(win, &self.maker.0.pubkey()).unwrap_or(u16::MAX);
        let args = PlaceOrderArgs { seat_hint, ..order_args(win, kind, price, lots, 0) };
        let (maker, token) = (self.maker.0.insecure_clone(), self.maker.1);
        let ix = self.w.h.place_order_ix(win, &maker.pubkey(), &token, args);
        self.w.h.ok(&[ix], &[&maker]);
    }

    pub fn maker_cancel_all(&mut self, win: &Window) {
        if let Some(seat) = self.seat_of(win, &self.maker.0.pubkey()) {
            let maker = self.maker.0.insecure_clone();
            let ix = self.w.h.cancel_all_ix(win, &maker.pubkey(), seat, 512);
            self.w.h.ok(&[ix], &[&maker]);
        }
    }

    /// Liquidity at 600 on the default Window; see `liquidity_on`.
    pub fn liquidity(&mut self, side: u8, lots: u64) {
        let win = self.win;
        self.liquidity_on(&win, side, lots);
    }

    /// Liquidity at 600: `side` 0 rests an ask (BUY_NO), which fills YES buys at 0.60; `side` 1 rests a bid
    /// (BUY_YES), which fills NO buys at 0.40 and YES sells at 0.60. The maker's other side on the same Window is
    /// cancelled first, since the maker would match itself.
    pub fn liquidity_on(&mut self, win: &Window, side: u8, lots: u64) {
        let kind = if side == 0 { BUY_NO } else { BUY_YES };
        if self.resting.is_some_and(|(m, k)| m == win.market && k != kind) {
            self.maker_cancel_all(win);
        }
        self.maker_rest(win, kind, MAKER_PRICE, lots);
        self.resting = Some((win.market, kind));
    }

    /// Masayume's `grantStrategy`: a STRATEGY grant to `actor` at the next id, live for a day, replacing the active one.
    pub fn grant_strategy(&mut self, owner: &Owner, actor: &Pubkey, budget: u64, caps: CapsArgs) -> u64 {
        let grant_id = self.config().next_grant_id;
        let expires_at_sec = self.w.h.now() + 86_400;
        let previous = Some(self.account(&owner.pubkey()).active_grants[usize::from(STRATEGY)]).filter(|id| *id != 0);
        let g = GrantArgs { grant_id, kind: STRATEGY, actor: *actor, caps, expires_at_sec, budget };
        let ix = self.w.h.vault_grant_ix(&owner.pubkey(), g, previous);
        self.w.h.ok(&[ix], &[&owner.key]);
        grant_id
    }

    pub fn account(&self, owner: &Pubkey) -> VaultAccount {
        self.w.h.read(&account_address(owner))
    }

    pub fn grant(&self, grant_id: u64) -> Grant {
        self.w.h.read(&grant_address(grant_id))
    }

    pub fn config(&self) -> VaultConfig {
        self.w.h.read(&VAULT_CONFIG)
    }

    pub fn custody_amount(&self, owner: &Pubkey) -> u64 {
        self.w.h.token_amount(&custody_address(owner))
    }

    /// Records attested prints for Up or Down and settles, or voids a missing opening print (as `Traded::resolve`).
    pub fn resolve(&mut self, win: &Window, outcome: Outcome) {
        let (m, t) = (win.market, win.start);
        if outcome == Outcome::Void {
            self.w.h.warp_to(t + 901);
            self.w.void(m).expect("void");
            return;
        }
        let close = if outcome == Outcome::Up { 100 * E8 } else { 99 * E8 };
        for (which, price, at, now) in [(0u8, 100 * E8, t, t + 60), (1, close, t + 300, t + 360)] {
            self.w.h.warp_to(now);
            let pair = self.w.attested_pair(&self.w.keys.attestor, m, which, price, at, now);
            self.w.send(&pair).expect("attested print");
        }
        self.w.settle(m).expect("settle");
    }
}

impl Default for VaultWorld {
    fn default() -> Self {
        Self::new()
    }
}

impl Harness {
    /// `admin_set_authorities` with the print fixtures and the vault seat at program authority index 0 (D-063).
    pub fn register_vault_seat(&mut self, keys: &crate::prints::PrintKeys) {
        let mut authorities = print_authorities(keys);
        authorities.program_authorities[0] = SEAT;
        let admin = key(1);
        let ix = self.set_authorities_ix(&admin.pubkey(), authorities);
        self.ok(&[ix], &[&admin]);
    }

    /// A v0 transaction (no lookup tables) paid by `payer`, returning its cost and the agari-vault events it emitted
    /// (discriminator + Borsh), or the failing custom error code.
    pub fn send_v0(&mut self, ixs: &[Instruction], payer: &Keypair, signers: &[&Keypair]) -> Result<(Sent, Vec<Vec<u8>>), u32> {
        self.svm.expire_blockhash();
        let message = v0::Message::try_compile(&payer.pubkey(), ixs, &[], self.svm.latest_blockhash()).expect("compile v0");
        let message = VersionedMessage::V0(message);
        let mut all: Vec<&Keypair> = vec![payer];
        all.extend(signers.iter().copied().filter(|k| k.pubkey() != payer.pubkey()));
        let tx = VersionedTransaction::try_new(message, &all).expect("sign v0");
        let tx_bytes = tx.message.serialize().len() + 1 + 64 * tx.signatures.len();
        match self.svm.send_transaction(tx) {
            Ok(meta) => {
                let tag = anchor_lang::event::EVENT_IX_TAG_LE;
                let events = meta.inner_instructions.iter().flatten().filter_map(|i| i.instruction.data.strip_prefix(tag).map(<[u8]>::to_vec)).collect();
                Ok((Sent { compute_units: meta.compute_units_consumed, tx_bytes }, events))
            }
            Err(failed) => match failed.err {
                TransactionError::InstructionError(_, InstructionError::Custom(code)) => Err(code),
                other => panic!("transaction failed without a custom error: {other:?}\n{}", failed.meta.pretty_logs()),
            },
        }
    }

    /// `send_v0` with `signers[0]` paying.
    pub fn vault_send(&mut self, ixs: &[Instruction], signers: &[&Keypair]) -> Result<(Sent, Vec<Vec<u8>>), u32> {
        self.send_v0(ixs, signers[0], signers)
    }
}

/// Masayume's `caps(perTrade, daily, open, maxPrice)` in base units and own-side ticks.
pub fn caps(max_stake_per_trade: u64, max_daily_spend: u64, max_open_positions: u32, max_price_ticks: u16) -> CapsArgs {
    CapsArgs { max_stake_per_trade, max_daily_spend, max_open_positions, max_price_ticks }
}

/// `SetComputeUnitLimit(units)` (ComputeBudget instruction 2).
pub fn compute_limit_ix(units: u32) -> Instruction {
    let mut data = vec![2u8];
    data.extend_from_slice(&units.to_le_bytes());
    Instruction { program_id: anchor_lang::pubkey!("ComputeBudget111111111111111111111111111111"), accounts: vec![], data }
}

/// The first event of type `E` among `events`.
pub fn event<E: Discriminator + AnchorDeserialize>(events: &[Vec<u8>]) -> Option<E> {
    events.iter().find_map(|e| e.strip_prefix(E::DISCRIMINATOR).and_then(|body| E::try_from_slice(body).ok()))
}

/// vault.md §1 invariant 1 on `win` and invariant 2 (as an equality: no donations) for every owner listed.
pub fn check_invariants(vw: &VaultWorld, win: &Window, owners: &[&Owner]) {
    let (_, seats) = vw.w.h.ledger_state(&win.ledger);
    let seat = &seats[0];
    assert_eq!(seat.owner, SEAT, "index 0 is the vault seat");
    let (mut yes, mut no) = (0u64, 0u64);
    for o in owners {
        let a = vw.account(&o.pubkey());
        if let Some(s) = a.positions.iter().find(|s| s.market == win.market) {
            (yes, no) = (yes + s.yes_lots, no + s.no_lots);
        }
        let config = vw.config();
        let budgets: u64 = (1..config.next_grant_id).map(|id| vw.grant(id)).filter(|g| g.owner == o.pubkey()).map(|g| g.budget).sum();
        assert_eq!(vw.custody_amount(&o.pubkey()), a.available + a.private_available + budgets, "invariant 2: custody == balances + budgets");
        assert_eq!(usize::from(a.slots_used), a.positions.iter().filter(|s| !s.is_free()).count(), "slots_used counts set slots");
    }
    assert_eq!((seat.yes_free, seat.no_free), (yes, no), "invariant 1: seat outcome == Σ slots");
    let idle = (seat.credit, seat.locked_cash, seat.yes_locked, seat.no_locked, seat.open_orders);
    assert_eq!(idle, (0, 0, 0, 0, 0), "invariant 1: the vault seat never rests or holds credit");
}

/// Whether a Ledger account still exists (closed Ledgers have no data).
pub fn ledger_open(vw: &VaultWorld, win: &Window) -> bool {
    vw.w.h.account_data(&win.ledger).len() > 8 + LEDGER_HEADER_LEN
}
