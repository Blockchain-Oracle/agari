//! Instruction builders and the multi-instruction flows tests reuse (admin setup, books, windows).

use agari_common::seeds::{config_address, event_authority_address, ledger_address, market_address, mvault_address, series_address};
use agari_events::instructions::{OpenWindowArgs, PolicyVersionArgs, RegisterSeriesArgs, SetAuthoritiesArgs};
use agari_events::state::book_space;
use anchor_lang::prelude::Pubkey;
use anchor_lang::solana_program::bpf_loader_upgradeable;
use anchor_lang::solana_program::instruction::Instruction;
use anchor_lang::solana_program::system_instruction;
use anchor_lang::solana_program::system_program;
use anchor_lang::{InstructionData, ToAccountMetas};
use anchor_spl::token::spl_token;
use solana_keypair::Keypair;
use solana_signer::Signer;

use crate::harness::{key, Harness, Sent};

fn ix(accounts: impl ToAccountMetas, data: impl InstructionData) -> Instruction {
    Instruction { program_id: agari_events::ID, accounts: accounts.to_account_metas(None), data: data.data() }
}

pub fn config() -> Pubkey {
    config_address(&agari_events::ID).0
}

/// The accounts one Window owns.
#[derive(Debug, Clone, Copy)]
pub struct WindowAccounts {
    pub market: Pubkey,
    pub ledger: Pubkey,
    pub mvault: Pubkey,
}

pub fn window_accounts(series: &Pubkey, index: u64) -> WindowAccounts {
    let market = market_address(&agari_events::ID, series, index).0;
    WindowAccounts { market, ledger: ledger_address(&agari_events::ID, &market).0, mvault: mvault_address(&agari_events::ID, &market).0 }
}

impl Harness {
    pub fn init_config_ix(&self, admin: &Pubkey, cluster_tag: u8) -> Instruction {
        ix(
            agari_events::accounts::AdminInitConfig {
                admin: *admin,
                config: config(),
                collateral_mint: self.mint,
                treasury: self.treasury,
                token_program: spl_token::ID,
                program: agari_events::ID,
                program_data: bpf_loader_upgradeable::get_program_data_address(&agari_events::ID),
                system_program: system_program::ID,
            },
            agari_events::instruction::AdminInitConfig { cluster_tag, result_retention_sec: 21_600 },
        )
    }

    pub fn set_authorities_ix(&self, admin: &Pubkey, args: SetAuthoritiesArgs) -> Instruction {
        self.set_authorities_queue_ix(admin, args, None)
    }

    /// With the Switchboard queue account, which the handler requires whenever `args.switchboard_queue` is set.
    pub fn set_authorities_queue_ix(&self, admin: &Pubkey, args: SetAuthoritiesArgs, queue: Option<Pubkey>) -> Instruction {
        ix(
            agari_events::accounts::AdminSetAuthorities { admin: *admin, config: config(), treasury: self.treasury, queue },
            agari_events::instruction::AdminSetAuthorities { args },
        )
    }

    pub fn set_mode_ix(&self, admin: &Pubkey, mode: u8) -> Instruction {
        ix(agari_events::accounts::AdminSetMode { admin: *admin, config: config() }, agari_events::instruction::AdminSetMode { mode })
    }

    pub fn register_series_ix(&self, admin: &Pubkey, args: RegisterSeriesArgs) -> (Instruction, Pubkey) {
        let series = series_address(&agari_events::ID, args.ticker, args.cadence_sec, args.basis).0;
        let accounts = agari_events::accounts::AdminRegisterSeries { admin: *admin, config: config(), series, system_program: system_program::ID };
        (ix(accounts, agari_events::instruction::AdminRegisterSeries { args }), series)
    }

    pub fn add_policy_ix(&self, admin: &Pubkey, series: &Pubkey, index: u8, version: PolicyVersionArgs) -> Instruction {
        ix(
            agari_events::accounts::AdminAddPolicyVersion { admin: *admin, config: config(), series: *series },
            agari_events::instruction::AdminAddPolicyVersion { index, version },
        )
    }

    pub fn open_window_ix(&self, roller: &Pubkey, payer: &Pubkey, series: &Pubkey, book: &Pubkey, args: OpenWindowArgs) -> Instruction {
        let w = window_accounts(series, args.index);
        ix(
            agari_events::accounts::RollerOpenWindow {
                roller: *roller,
                payer: *payer,
                config: config(),
                series: *series,
                market: w.market,
                ledger: w.ledger,
                mvault: w.mvault,
                book: *book,
                collateral_mint: self.mint,
                token_program: spl_token::ID,
                system_program: system_program::ID,
                event_authority: event_authority_address(&agari_events::ID).0,
                program: agari_events::ID,
            },
            agari_events::instruction::RollerOpenWindow { args },
        )
    }

    /// `admin_init_config` (devnet tag) then `admin_set_authorities` with `authorities`.
    pub fn setup_config(&mut self, authorities: SetAuthoritiesArgs) {
        let admin = key(1);
        let init = self.init_config_ix(&admin.pubkey(), 103);
        let auth = self.set_authorities_ix(&admin.pubkey(), authorities);
        self.ok(&[init, auth], &[&admin]);
    }

    pub fn register_series(&mut self, args: RegisterSeriesArgs) -> Pubkey {
        let admin = key(1);
        let (ix, series) = self.register_series_ix(&admin.pubkey(), args);
        self.ok(&[ix], &[&admin]);
        series
    }

    pub fn add_policy(&mut self, series: &Pubkey, index: u8, version: PolicyVersionArgs) -> Result<Sent, u32> {
        let admin = key(1);
        let ix = self.add_policy_ix(&admin.pubkey(), series, index, version);
        self.send(&[ix], &[&admin])
    }

    /// System `createAccount` for a fresh Book keypair and `admin_add_book` in the same transaction.
    pub fn add_book(&mut self, series: &Pubkey, capacity: u16) -> Pubkey {
        let admin = key(1);
        let book = self.fresh_key();
        let space = book_space(usize::from(capacity));
        let lamports = self.svm.minimum_balance_for_rent_exemption(space);
        let create = system_instruction::create_account(&admin.pubkey(), &book.pubkey(), lamports, space as u64, &agari_events::ID);
        let add = ix(
            agari_events::accounts::AdminAddBook { admin: admin.pubkey(), config: config(), series: *series, book: book.pubkey() },
            agari_events::instruction::AdminAddBook { capacity },
        );
        self.ok(&[create, add], &[&admin, &book]);
        book.pubkey()
    }

    /// `roller_open_window` signed by `roller`, rent paid by the admin.
    pub fn open_window_as(&mut self, roller: &Keypair, series: &Pubkey, book: &Pubkey, args: OpenWindowArgs) -> Result<Sent, u32> {
        let payer = key(1);
        let ix = self.open_window_ix(&roller.pubkey(), &payer.pubkey(), series, book, args);
        self.send(&[ix], &[&payer, roller])
    }

    pub fn open_window(&mut self, series: &Pubkey, book: &Pubkey, args: OpenWindowArgs) -> Result<Sent, u32> {
        let roller = key(2);
        self.open_window_as(&roller, series, book, args)
    }
}
