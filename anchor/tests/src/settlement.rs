//! Redeem and closure (S2.12–S2.13): builders for every instruction, and a world that trades example 3 on an
//! attested 5m Window (plus a product minting on PROGRAM seat 5), then settles it Up, Down or void.

use agari_common::seeds::{event_authority_address, result_address};
use agari_events::constants::LEDGER_HEADER_LEN;
use anchor_lang::prelude::Pubkey;
use anchor_lang::solana_program::instruction::Instruction;
use anchor_lang::solana_program::system_program;
use anchor_lang::{InstructionData, ToAccountMetas};
use anchor_spl::associated_token::{get_associated_token_address, spl_associated_token_account::instruction::create_associated_token_account_idempotent};
use anchor_spl::token::spl_token;
use solana_keypair::Keypair;
use solana_signer::Signer;

use crate::fixtures::regular_window;
use crate::harness::{key, Harness, SOL};
use crate::ix::{config, window_accounts};
use crate::prints::{attested_policy, print_authorities, version, World, T_PYTH};
use crate::trade::{order_args, Window};

pub const T: i64 = T_PYTH;
pub const E8: i64 = 100_000_000;
pub const BOND: u64 = 250_000;
pub const PRODUCT_SEAT: u16 = 5;
pub const BUY_YES: u8 = 0;
pub const BUY_NO: u8 = 2;
pub const NORMAL: u8 = 0;
pub const IOC: u8 = 2;

/// How a Window resolves in these tests.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Outcome {
    Up,
    Down,
    Void,
}

fn ix(accounts: impl ToAccountMetas, data: impl InstructionData) -> Instruction {
    Instruction { program_id: agari_events::ID, accounts: accounts.to_account_metas(None), data: data.data() }
}

fn event_authority() -> Pubkey {
    event_authority_address(&agari_events::ID).0
}

/// The product authority owning Ledger seat 5 in every Window (a keypair standing in for a product's seat PDA).
pub fn product() -> Keypair {
    key(40)
}

/// Example 3 traded on Window 0: A rests BUY_YES 10,000 @ 620, D mints 4,000 pairs against it, and the product
/// mints 2,000 complete sets on its PROGRAM seat. The mvault then holds 7,720,000 + 2 bonds + 2,000,000.
pub struct Traded {
    pub w: World,
    pub win: Window,
    pub a: (Keypair, Pubkey),
    pub d: (Keypair, Pubkey),
    pub product_token: Pubkey,
    /// A's resting bid, stale once the Book is recycled.
    pub a_handle: agari_events::events::OrderHandle,
    /// A funded key with no role that sends every permissionless call, so the rent payers' balances stay exact.
    pub crank: Keypair,
}

impl Harness {
    /// A token account for an existing key, holding `tusdc`.
    pub fn fund_key(&mut self, owner: &Keypair, tusdc: u64) -> Pubkey {
        self.svm.airdrop(&owner.pubkey(), 10 * SOL).expect("airdrop");
        let token = self.fresh_key();
        let mint = self.mint;
        self.create_token_account(&token, &mint, &owner.pubkey());
        let admin = key(1);
        let mint_to = spl_token::instruction::mint_to(&spl_token::ID, &mint, &token.pubkey(), &admin.pubkey(), &[], tusdc).unwrap();
        self.ok(&[mint_to], &[&admin]);
        token.pubkey()
    }

    /// Mints `tusdc` straight into `token` (a donation when `token` is an mvault).
    pub fn donate(&mut self, token: &Pubkey, tusdc: u64) {
        let admin = key(1);
        let mint_to = spl_token::instruction::mint_to(&spl_token::ID, &self.mint, token, &admin.pubkey(), &[], tusdc).unwrap();
        self.ok(&[mint_to], &[&admin]);
    }

    pub fn lamports(&self, address: &Pubkey) -> u64 {
        self.svm.get_account(address).map(|a| a.lamports).unwrap_or(0)
    }

    pub fn redeem_ix(&self, win: &Window, authority: &Pubkey, token: &Pubkey, seat_idx: u16, outcome: Option<u8>, lots: Option<u64>) -> Instruction {
        let accounts = agari_events::accounts::UserRedeem {
            authority: *authority,
            config: config(),
            series: win.series,
            market: win.market,
            ledger: win.ledger,
            mvault: win.mvault,
            authority_token: *token,
            collateral_mint: self.mint,
            token_program: spl_token::ID,
            event_authority: event_authority(),
            program: agari_events::ID,
        };
        ix(accounts, agari_events::instruction::UserRedeem { seat_idx, outcome, lots })
    }

    pub fn redeem_for_ix(&self, win: &Window, owner: &Pubkey, owner_ata: &Pubkey, seat_idx: u16) -> Instruction {
        let accounts = agari_events::accounts::PublicRedeemFor {
            config: config(),
            series: win.series,
            market: win.market,
            ledger: win.ledger,
            mvault: win.mvault,
            owner: *owner,
            owner_ata: *owner_ata,
            collateral_mint: self.mint,
            token_program: spl_token::ID,
            event_authority: event_authority(),
            program: agari_events::ID,
        };
        ix(accounts, agari_events::instruction::PublicRedeemFor { seat_idx })
    }

    /// `[create the owner's ATA idempotently, public_redeem_for]`, the crank paying for the ATA.
    pub fn crank_redeem_ixs(&self, win: &Window, crank: &Pubkey, owner: &Pubkey, seat_idx: u16) -> (Vec<Instruction>, Pubkey) {
        let ata = get_associated_token_address(owner, &self.mint);
        let create = create_associated_token_account_idempotent(crank, owner, &self.mint, &spl_token::ID);
        (vec![create, self.redeem_for_ix(win, owner, &ata, seat_idx)], ata)
    }

    pub fn release_book_ix(&self, win: &Window) -> Instruction {
        let accounts = agari_events::accounts::PublicReleaseBook { series: win.series, market: win.market, book: win.book, event_authority: event_authority(), program: agari_events::ID };
        ix(accounts, agari_events::instruction::PublicReleaseBook {})
    }

    pub fn close_ledger_ix(&self, win: &Window, treasury: &Pubkey, rent_payer: &Pubkey) -> Instruction {
        let accounts = agari_events::accounts::PublicCloseLedger {
            config: config(),
            market: win.market,
            ledger: win.ledger,
            mvault: win.mvault,
            treasury: *treasury,
            rent_payer: *rent_payer,
            collateral_mint: self.mint,
            token_program: spl_token::ID,
            event_authority: event_authority(),
            program: agari_events::ID,
        };
        ix(accounts, agari_events::instruction::PublicCloseLedger {})
    }

    pub fn close_market_ix(&self, market: &Pubkey, market_rent_payer: &Pubkey, result_rent_payer: &Pubkey) -> Instruction {
        let accounts = agari_events::accounts::PublicCloseMarket {
            market: *market,
            result: result_address(&agari_events::ID, market).0,
            market_rent_payer: *market_rent_payer,
            result_rent_payer: *result_rent_payer,
            config: config(),
            event_authority: event_authority(),
            program: agari_events::ID,
        };
        ix(accounts, agari_events::instruction::PublicCloseMarket {})
    }

    pub fn dependent_ix(&self, authority: &Pubkey, market: &Pubkey, added: bool) -> Instruction {
        let accounts = agari_events::accounts::ProductDependent { program_authority: *authority, config: config(), market: *market, event_authority: event_authority(), program: agari_events::ID };
        if added {
            ix(accounts, agari_events::instruction::ProductAddDependent {})
        } else {
            ix(accounts, agari_events::instruction::ProductReleaseDependent {})
        }
    }

    pub fn grow_ledger_ix(&self, win: &Window, payer: &Pubkey, extra_seats: u16) -> Instruction {
        let accounts = agari_events::accounts::PublicGrowLedger {
            payer: *payer,
            config: config(),
            market: win.market,
            ledger: win.ledger,
            system_program: system_program::ID,
            event_authority: event_authority(),
            program: agari_events::ID,
        };
        ix(accounts, agari_events::instruction::PublicGrowLedger { extra_seats })
    }

    /// Seats a Ledger's account bytes hold (0 once it is closed).
    pub fn ledger_seat_bytes(&self, ledger: &Pubkey) -> usize {
        self.account_data(ledger).len().saturating_sub(8 + LEDGER_HEADER_LEN)
    }
}

impl Traded {
    /// An attested 5m World (two books), seat 5 given to the product, Window 0 at `T` traded as example 3 at `T + 10`.
    pub fn new() -> Self {
        let mut w = World::regular(version(attested_policy(), None), 2);
        let mut authorities = print_authorities(&w.keys);
        authorities.program_authorities[usize::from(PRODUCT_SEAT)] = product().pubkey();
        let admin = key(1);
        let set = w.h.set_authorities_ix(&admin.pubkey(), authorities);
        w.h.ok(&[set], &[&admin]);

        let market = w.open(regular_window(0, T, 300, 0));
        let accounts = window_accounts(&w.series, 0);
        assert_eq!(accounts.market, market);
        let win = Window { series: w.series, book: w.books[0], market, ledger: accounts.ledger, mvault: accounts.mvault, start: T };
        w.h.warp_to(T + 10);

        let a = w.h.funded_user(20_000_000);
        let d = w.h.funded_user(20_000_000);
        let (rest, _) = w.h.place(&win, &a.0, &a.1, order_args(&win, BUY_YES, 620, 10_000, NORMAL)).expect("A rests");
        w.h.place(&win, &d.0, &d.1, order_args(&win, BUY_NO, 600, 4_000, IOC)).expect("D mints against A");
        let p = product();
        let product_token = w.h.fund_key(&p, 5_000_000);
        let mint = w.h.mint_set_ix(&win, &p.pubkey(), &product_token, 2_000, PRODUCT_SEAT, false);
        w.h.ok(&[mint], &[&p]);
        let crank = w.h.fresh_key();
        w.h.svm.airdrop(&crank.pubkey(), 10 * SOL).expect("airdrop");
        let a_handle = agari_events::events::OrderHandle { node: rest.rested.node, seq: rest.rested.seq };
        Traded { w, win, a, d, product_token, a_handle, crank }
    }

    /// Records the prints for `outcome` (attested, open at `T + 60`, close at `T + 360`) and settles, or voids a
    /// missing opening print after its deadline. The World's stranger (key 3) resolves, so `result.rent_payer` is key 3.
    pub fn resolve(&mut self, outcome: Outcome) {
        let m = self.win.market;
        match outcome {
            Outcome::Void => {
                self.w.h.warp_to(T + 901);
                self.w.void(m).expect("void");
            }
            Outcome::Up | Outcome::Down => {
                let close = if outcome == Outcome::Up { 100 * E8 } else { 99 * E8 };
                for (which, price, t, now) in [(0u8, 100 * E8, T, T + 60), (1, close, T + 300, T + 360)] {
                    self.w.h.warp_to(now);
                    let pair = self.w.attested_pair(&self.w.keys.attestor, m, which, price, t, now);
                    self.w.send(&pair).expect("attested print");
                }
                self.w.settle(m).expect("settle");
            }
        }
    }

    /// The permissionless sweep that drains every order once the Window is terminal or past `lock_at`.
    pub fn sweep(&mut self) {
        let sweep = self.w.h.sweep_ix(&self.win, 32);
        let crank = self.crank.insecure_clone();
        self.w.h.ok(&[sweep], &[&crank]);
    }

    /// Sends `ixs` with the crank as fee payer.
    pub fn crank_send(&mut self, ixs: &[Instruction]) -> Result<crate::Sent, u32> {
        let crank = self.crank.insecure_clone();
        self.w.h.send(ixs, &[&crank])
    }
}

impl Default for Traded {
    fn default() -> Self {
        Self::new()
    }
}
