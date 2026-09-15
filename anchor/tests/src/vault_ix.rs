//! agari-vault instruction builders (S7a): every vault instruction, with the engine block filled from a `Window`.

use agari_vault::constants::{ACCOUNT_SEED, CUSTODY_SEED, EVENTS_CONFIG, EVENTS_EVENT_AUTHORITY, GRANT_SEED, SEAT, VAULT_CONFIG};
use agari_vault::instructions::CapsArgs;
use anchor_lang::prelude::Pubkey;
use anchor_lang::solana_program::bpf_loader_upgradeable;
use anchor_lang::solana_program::instruction::Instruction;
use anchor_lang::solana_program::system_program;
use anchor_lang::{InstructionData, ToAccountMetas};
use anchor_spl::associated_token::get_associated_token_address;
use anchor_spl::token::spl_token;

use crate::harness::Harness;
use crate::ix::config;
use crate::trade::Window;

fn ix(accounts: impl ToAccountMetas, data: impl InstructionData) -> Instruction {
    Instruction { program_id: agari_vault::ID, accounts: accounts.to_account_metas(None), data: data.data() }
}

fn event_authority() -> Pubkey {
    agari_vault::EVENT_AUTHORITY_AND_BUMP.0
}

pub fn account_address(owner: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[ACCOUNT_SEED, owner.as_ref()], &agari_vault::ID).0
}

pub fn custody_address(owner: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[CUSTODY_SEED, owner.as_ref()], &agari_vault::ID).0
}

pub fn grant_address(grant_id: u64) -> Pubkey {
    Pubkey::find_program_address(&[GRANT_SEED, &grant_id.to_le_bytes()], &agari_vault::ID).0
}

/// A grant's terms as the instruction takes them.
#[derive(Clone, Copy, Debug)]
pub struct GrantArgs {
    pub grant_id: u64,
    pub kind: u8,
    pub actor: Pubkey,
    pub caps: CapsArgs,
    pub expires_at_sec: i64,
    pub budget: u64,
}

/// An order through the vault: outcome 0 YES / 1 NO, YES-terms price, expiring at the Window's lock.
#[derive(Clone, Copy, Debug)]
pub struct VaultOrder {
    pub outcome: u8,
    pub is_buy: bool,
    pub price_ticks: u16,
    pub lots: u64,
}

pub fn buy(outcome: u8, price_ticks: u16, lots: u64) -> VaultOrder {
    VaultOrder { outcome, is_buy: true, price_ticks, lots }
}

pub fn sell(outcome: u8, price_ticks: u16, lots: u64) -> VaultOrder {
    VaultOrder { outcome, is_buy: false, price_ticks, lots }
}

impl Harness {
    pub fn vault_init_ix(&self, admin: &Pubkey) -> Instruction {
        let accounts = agari_vault::accounts::AdminInitVault {
            admin: *admin,
            vault_config: VAULT_CONFIG,
            seat: SEAT,
            events_config: EVENTS_CONFIG,
            collateral_mint: self.mint,
            program: agari_vault::ID,
            program_data: bpf_loader_upgradeable::get_program_data_address(&agari_vault::ID),
            system_program: system_program::ID,
        };
        ix(accounts, agari_vault::instruction::AdminInitVault {})
    }

    pub fn vault_open_ix(&self, owner: &Pubkey) -> Instruction {
        let accounts = agari_vault::accounts::OwnerOpenAccount {
            owner: *owner,
            vault_config: VAULT_CONFIG,
            account: account_address(owner),
            custody: custody_address(owner),
            seat: SEAT,
            collateral_mint: self.mint,
            token_program: spl_token::ID,
            system_program: system_program::ID,
            event_authority: event_authority(),
            program: agari_vault::ID,
        };
        ix(accounts, agari_vault::instruction::OwnerOpenAccount {})
    }

    pub fn vault_deposit_ix(&self, owner: &Pubkey, owner_token: &Pubkey, amount: u64) -> Instruction {
        let accounts = agari_vault::accounts::OwnerDeposit {
            owner: *owner,
            vault_config: VAULT_CONFIG,
            account: account_address(owner),
            custody: custody_address(owner),
            owner_ata: *owner_token,
            collateral_mint: self.mint,
            token_program: spl_token::ID,
            event_authority: event_authority(),
            program: agari_vault::ID,
        };
        ix(accounts, agari_vault::instruction::OwnerDeposit { amount })
    }

    /// `owner_withdraw` (or `_private`) to `destination`, which the program requires to be the owner's ATA.
    pub fn vault_withdraw_ix(&self, owner: &Pubkey, destination: &Pubkey, amount: u64, private: bool) -> Instruction {
        let accounts = agari_vault::accounts::OwnerWithdraw {
            owner: *owner,
            vault_config: VAULT_CONFIG,
            account: account_address(owner),
            custody: custody_address(owner),
            owner_ata: *destination,
            seat: SEAT,
            collateral_mint: self.mint,
            token_program: spl_token::ID,
            event_authority: event_authority(),
            program: agari_vault::ID,
        };
        if private {
            ix(accounts, agari_vault::instruction::OwnerWithdrawPrivate { amount })
        } else {
            ix(accounts, agari_vault::instruction::OwnerWithdraw { amount })
        }
    }

    pub fn vault_move_private_ix(&self, owner: &Pubkey, amount: u64) -> Instruction {
        let accounts = agari_vault::accounts::OwnerMoveToPrivate { owner: *owner, account: account_address(owner), event_authority: event_authority(), program: agari_vault::ID };
        ix(accounts, agari_vault::instruction::OwnerMoveToPrivate { amount })
    }

    pub fn vault_grant_ix(&self, owner: &Pubkey, g: GrantArgs, previous: Option<u64>) -> Instruction {
        let accounts = agari_vault::accounts::OwnerGrant {
            owner: *owner,
            vault_config: VAULT_CONFIG,
            account: account_address(owner),
            grant: grant_address(g.grant_id),
            previous_grant: previous.map(grant_address),
            system_program: system_program::ID,
            event_authority: event_authority(),
            program: agari_vault::ID,
        };
        let data = agari_vault::instruction::OwnerGrant { grant_id: g.grant_id, kind: g.kind, actor: g.actor, caps: g.caps, expires_at_sec: g.expires_at_sec, budget: g.budget };
        ix(accounts, data)
    }

    pub fn vault_deposit_and_grant_ix(&self, owner: &Pubkey, owner_token: &Pubkey, amount: u64, g: GrantArgs, previous: Option<u64>) -> Instruction {
        let accounts = agari_vault::accounts::OwnerDepositAndGrant {
            owner: *owner,
            vault_config: VAULT_CONFIG,
            account: account_address(owner),
            custody: custody_address(owner),
            owner_ata: *owner_token,
            collateral_mint: self.mint,
            token_program: spl_token::ID,
            grant: grant_address(g.grant_id),
            previous_grant: previous.map(grant_address),
            system_program: system_program::ID,
            event_authority: event_authority(),
            program: agari_vault::ID,
        };
        let data = agari_vault::instruction::OwnerDepositAndGrant {
            amount,
            grant_id: g.grant_id,
            kind: g.kind,
            actor: g.actor,
            caps: g.caps,
            expires_at_sec: g.expires_at_sec,
            budget: g.budget,
        };
        ix(accounts, data)
    }

    fn manage_accounts(owner: &Pubkey, grant_id: u64) -> agari_vault::accounts::OwnerManageGrant {
        agari_vault::accounts::OwnerManageGrant { owner: *owner, account: account_address(owner), grant: grant_address(grant_id), event_authority: event_authority(), program: agari_vault::ID }
    }

    pub fn vault_fund_grant_ix(&self, owner: &Pubkey, grant_id: u64, amount: u64) -> Instruction {
        ix(Self::manage_accounts(owner, grant_id), agari_vault::instruction::OwnerFundGrant { amount })
    }

    pub fn vault_revoke_ix(&self, owner: &Pubkey, grant_id: u64) -> Instruction {
        ix(Self::manage_accounts(owner, grant_id), agari_vault::instruction::OwnerRevoke {})
    }

    pub fn vault_place_ix(&self, owner: &Pubkey, w: &Window, o: VaultOrder) -> Instruction {
        let accounts = agari_vault::accounts::OwnerPlace {
            owner: *owner,
            vault_config: VAULT_CONFIG,
            account: account_address(owner),
            custody: custody_address(owner),
            seat: SEAT,
            events_program: agari_events::ID,
            events_config: config(),
            series: w.series,
            market: w.market,
            book: w.book,
            ledger: w.ledger,
            mvault: w.mvault,
            collateral_mint: self.mint,
            token_program: spl_token::ID,
            events_event_authority: EVENTS_EVENT_AUTHORITY,
            event_authority: event_authority(),
            program: agari_vault::ID,
        };
        let data = agari_vault::instruction::OwnerPlace { outcome: o.outcome, is_buy: o.is_buy, price_ticks: o.price_ticks, lots: o.lots, expire_ts: w.start + 300 };
        ix(accounts, data)
    }

    pub fn vault_place_for_ix(&self, actor: &Pubkey, owner: &Pubkey, grant_id: u64, w: &Window, o: VaultOrder) -> Instruction {
        let accounts = agari_vault::accounts::ActorPlaceFor {
            actor: *actor,
            vault_config: VAULT_CONFIG,
            grant: grant_address(grant_id),
            owner: *owner,
            account: account_address(owner),
            custody: custody_address(owner),
            seat: SEAT,
            events_program: agari_events::ID,
            events_config: config(),
            series: w.series,
            market: w.market,
            book: w.book,
            ledger: w.ledger,
            mvault: w.mvault,
            collateral_mint: self.mint,
            token_program: spl_token::ID,
            events_event_authority: EVENTS_EVENT_AUTHORITY,
            event_authority: event_authority(),
            program: agari_vault::ID,
        };
        let data =
            agari_vault::instruction::ActorPlaceFor { grant_id, outcome: o.outcome, is_buy: o.is_buy, price_ticks: o.price_ticks, lots: o.lots, expire_ts: w.start + 300 };
        ix(accounts, data)
    }

    pub fn vault_crank_ix(&self, cranker: &Pubkey, owner: &Pubkey, w: &Window, yes_grant: Option<u64>, no_grant: Option<u64>) -> Instruction {
        let accounts = agari_vault::accounts::PublicCrankSettle {
            cranker: *cranker,
            vault_config: VAULT_CONFIG,
            owner: *owner,
            account: account_address(owner),
            custody: custody_address(owner),
            yes_grant: yes_grant.map(grant_address),
            no_grant: no_grant.map(grant_address),
            seat: SEAT,
            events_program: agari_events::ID,
            events_config: config(),
            series: w.series,
            market: w.market,
            ledger: w.ledger,
            mvault: w.mvault,
            collateral_mint: self.mint,
            token_program: spl_token::ID,
            events_event_authority: EVENTS_EVENT_AUTHORITY,
            event_authority: event_authority(),
            program: agari_vault::ID,
        };
        ix(accounts, agari_vault::instruction::PublicCrankSettle {})
    }

    pub fn ata(&self, owner: &Pubkey) -> Pubkey {
        get_associated_token_address(owner, &self.mint)
    }
}
