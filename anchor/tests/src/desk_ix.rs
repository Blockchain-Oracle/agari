//! agari-desk instruction builders (S21): every desk instruction, and the stub router's route as the operator's
//! remaining accounts (desk.md §4.5 step 12: the desk PDA rides as a plain account; the program flags it as signer).

use agari_desk::constants::DESK_CONFIG;
use agari_desk::reference::{ref_message, RefFields};
use anchor_lang::prelude::Pubkey;
use anchor_lang::solana_program::bpf_loader_upgradeable;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::system_program;
use anchor_lang::{InstructionData, ToAccountMetas};
use anchor_spl::associated_token::{get_associated_token_address_with_program_id, ID as ASSOCIATED_TOKEN_ID};
use anchor_spl::token::spl_token;
use anchor_spl::token_2022::spl_token_2022;
use solana_keypair::Keypair;

use crate::desk::{desk_address, reference_address, DeskWorld, CLUSTER_TAG};
use crate::prints::ed25519_ix;

const INSTRUCTIONS_SYSVAR: Pubkey = anchor_lang::pubkey!("Sysvar1nstructions1111111111111111111111111");

fn ix(accounts: impl ToAccountMetas, data: impl InstructionData) -> Instruction {
    Instruction { program_id: agari_desk::ID, accounts: accounts.to_account_metas(None), data: data.data() }
}

fn event_authority() -> Pubkey {
    agari_desk::EVENT_AUTHORITY_AND_BUMP.0
}

/// The token program a mint lives under: the harness's USDC stand-in is SPL Token, every name is Token-2022.
fn program_of(world: &DeskWorld, mint: &Pubkey) -> Pubkey {
    if *mint == world.usdc {
        spl_token::ID
    } else {
        spl_token_2022::ID
    }
}

impl DeskWorld {
    pub fn init_config_ix(&self, admin: &Pubkey, cluster_tag: u8, attestors: [Pubkey; 4]) -> Instruction {
        let accounts = agari_desk::accounts::AdminInitConfig {
            admin: *admin,
            config: DESK_CONFIG,
            usdc_mint: self.usdc,
            swap_program: agari_swap_stub::ID,
            program: agari_desk::ID,
            program_data: bpf_loader_upgradeable::get_program_data_address(&agari_desk::ID),
            system_program: system_program::ID,
        };
        ix(accounts, agari_desk::instruction::AdminInitConfig { cluster_tag, attestors })
    }

    pub fn set_attestors_ix(&self, admin: &Pubkey, attestors: [Pubkey; 4]) -> Instruction {
        let accounts = agari_desk::accounts::AdminSetAttestors { admin: *admin, config: DESK_CONFIG, event_authority: event_authority(), program: agari_desk::ID };
        ix(accounts, agari_desk::instruction::AdminSetAttestors { attestors })
    }

    pub fn set_feed_ix(&self, admin: &Pubkey, mint: &Pubkey, pyth_feed_id: [u8; 32]) -> Instruction {
        let accounts = agari_desk::accounts::AdminSetReferenceFeed { admin: *admin, config: DESK_CONFIG, mint: *mint, desk_ref: reference_address(mint), event_authority: event_authority(), program: agari_desk::ID };
        ix(accounts, agari_desk::instruction::AdminSetReferenceFeed { pyth_feed_id })
    }

    pub fn init_reference_ix(&self, payer: &Pubkey, mint: &Pubkey) -> Instruction {
        let accounts = agari_desk::accounts::PublicInitReference { payer: *payer, mint: *mint, desk_ref: reference_address(mint), system_program: system_program::ID, event_authority: event_authority(), program: agari_desk::ID };
        ix(accounts, agari_desk::instruction::PublicInitReference {})
    }

    /// The 114 B message for `mint` under this world's cluster tag.
    pub fn reference_message(mint: &Pubkey, token_price_e8: u64, mark_price_e8: u64, multiplier_e12: u64, fetched_at_sec: i64) -> [u8; 114] {
        ref_message(&RefFields { program_id: agari_desk::ID, cluster_tag: CLUSTER_TAG, mint: *mint, token_price_e8, mark_price_e8, multiplier_e12, fetched_at_sec })
    }

    /// `[ed25519 over the message, public_post_reference]`, the precompile first.
    #[allow(clippy::too_many_arguments)]
    pub fn post_reference_ixs(&self, attestor: &Keypair, payer: &Pubkey, mint: &Pubkey, token_price_e8: u64, mark_price_e8: u64, multiplier_e12: u64, fetched_at_sec: i64) -> [Instruction; 2] {
        let message = Self::reference_message(mint, token_price_e8, mark_price_e8, multiplier_e12, fetched_at_sec);
        [ed25519_ix(attestor, &message, 0), self.post_reference_ix(payer, mint, token_price_e8, mark_price_e8, multiplier_e12, fetched_at_sec)]
    }

    pub fn post_reference_ix(&self, payer: &Pubkey, mint: &Pubkey, token_price_e8: u64, mark_price_e8: u64, multiplier_e12: u64, fetched_at_sec: i64) -> Instruction {
        let accounts = agari_desk::accounts::PublicPostReference { payer: *payer, config: DESK_CONFIG, mint: *mint, desk_ref: reference_address(mint), instructions: INSTRUCTIONS_SYSVAR, event_authority: event_authority(), program: agari_desk::ID };
        ix(accounts, agari_desk::instruction::PublicPostReference { token_price_e8, mark_price_e8, multiplier_e12, fetched_at_sec })
    }

    pub fn open_desk_ix(&self, owner: &Pubkey, operator: Pubkey, per_action_cap: u64, daily_cap: u64, max_premium_bps: u16, mode: u8) -> Instruction {
        let desk = desk_address(owner);
        let accounts = agari_desk::accounts::OwnerOpenDesk {
            owner: *owner,
            config: DESK_CONFIG,
            desk,
            usdc_mint: self.usdc,
            desk_usdc: get_associated_token_address_with_program_id(&desk, &self.usdc, &spl_token::ID),
            token_program: spl_token::ID,
            associated_token_program: ASSOCIATED_TOKEN_ID,
            system_program: system_program::ID,
            event_authority: event_authority(),
            program: agari_desk::ID,
        };
        ix(accounts, agari_desk::instruction::OwnerOpenDesk { operator, per_action_cap, daily_cap, max_premium_bps, mode })
    }

    /// `owner_allow_token` for `mint` under `token_program` (Token-2022 unless a test proves a refusal).
    pub fn allow_token_with_program_ix(&self, owner: &Pubkey, mint: &Pubkey, token_program: &Pubkey) -> Instruction {
        let desk = desk_address(owner);
        let accounts = agari_desk::accounts::OwnerAllowToken {
            owner: *owner,
            config: DESK_CONFIG,
            desk,
            mint: *mint,
            desk_ata: get_associated_token_address_with_program_id(&desk, mint, token_program),
            token_program: *token_program,
            associated_token_program: ASSOCIATED_TOKEN_ID,
            system_program: system_program::ID,
            event_authority: event_authority(),
            program: agari_desk::ID,
        };
        ix(accounts, agari_desk::instruction::OwnerAllowToken {})
    }

    pub fn allow_token_ix(&self, owner: &Pubkey, mint: &Pubkey) -> Instruction {
        self.allow_token_with_program_ix(owner, mint, &spl_token_2022::ID)
    }

    pub fn disallow_token_ix(&self, owner: &Pubkey, mint: &Pubkey) -> Instruction {
        let accounts = agari_desk::accounts::OwnerDisallowToken { owner: *owner, desk: desk_address(owner), mint: *mint, event_authority: event_authority(), program: agari_desk::ID };
        ix(accounts, agari_desk::instruction::OwnerDisallowToken {})
    }

    pub fn deposit_ix(&self, owner: &Pubkey, mint: &Pubkey, owner_token: &Pubkey, amount: u64) -> Instruction {
        let desk = desk_address(owner);
        let token_program = program_of(self, mint);
        let accounts = agari_desk::accounts::OwnerDeposit {
            owner: *owner,
            config: DESK_CONFIG,
            desk,
            mint: *mint,
            owner_token: *owner_token,
            desk_ata: get_associated_token_address_with_program_id(&desk, mint, &token_program),
            token_program,
            event_authority: event_authority(),
            program: agari_desk::ID,
        };
        ix(accounts, agari_desk::instruction::OwnerDeposit { amount })
    }

    /// `owner_withdraw` to `owner_ata`, which the program requires to be the owner's associated account of `mint`.
    pub fn withdraw_ix(&self, owner: &Pubkey, mint: &Pubkey, owner_ata: &Pubkey, amount: u64) -> Instruction {
        let desk = desk_address(owner);
        let token_program = program_of(self, mint);
        let accounts = agari_desk::accounts::OwnerWithdraw {
            owner: *owner,
            desk,
            mint: *mint,
            desk_ata: get_associated_token_address_with_program_id(&desk, mint, &token_program),
            owner_ata: *owner_ata,
            token_program,
            event_authority: event_authority(),
            program: agari_desk::ID,
        };
        ix(accounts, agari_desk::instruction::OwnerWithdraw { amount })
    }

    fn controls(owner: &Pubkey) -> agari_desk::accounts::OwnerControls {
        agari_desk::accounts::OwnerControls { owner: *owner, desk: desk_address(owner), event_authority: event_authority(), program: agari_desk::ID }
    }

    pub fn set_limits_ix(&self, owner: &Pubkey, per_action_cap: u64, daily_cap: u64, max_premium_bps: u16, require_pyth_index: bool) -> Instruction {
        ix(Self::controls(owner), agari_desk::instruction::OwnerSetLimits { per_action_cap, daily_cap, max_premium_bps, require_pyth_index })
    }

    pub fn set_mode_ix(&self, owner: &Pubkey, mode: u8) -> Instruction {
        ix(Self::controls(owner), agari_desk::instruction::OwnerSetMode { mode })
    }

    pub fn set_operator_ix(&self, owner: &Pubkey, operator: Pubkey) -> Instruction {
        ix(Self::controls(owner), agari_desk::instruction::OwnerSetOperator { operator })
    }

    pub fn revoke_operator_ix(&self, owner: &Pubkey) -> Instruction {
        ix(Self::controls(owner), agari_desk::instruction::OwnerRevokeOperator {})
    }

    pub fn unpause_ix(&self, owner: &Pubkey) -> Instruction {
        ix(Self::controls(owner), agari_desk::instruction::OwnerUnpause {})
    }

    pub fn pause_ix(&self, signer: &Pubkey, owner: &Pubkey) -> Instruction {
        let accounts = agari_desk::accounts::Pause { signer: *signer, owner: *owner, desk: desk_address(owner), event_authority: event_authority(), program: agari_desk::ID };
        ix(accounts, agari_desk::instruction::Pause {})
    }

    pub fn checkpoint_ix(&self, operator: &Pubkey, deadline_sec: i64, decision_hash: [u8; 32]) -> Instruction {
        let owner = self.owner.pubkey_of();
        let accounts = agari_desk::accounts::OperatorCheckpoint { operator: *operator, owner, desk: desk_address(&owner), event_authority: event_authority(), program: agari_desk::ID };
        ix(accounts, agari_desk::instruction::OperatorCheckpoint { deadline_sec, decision_hash })
    }

    /// The operator swap's named accounts, for the name this world holds.
    fn swap_accounts(&self, operator: &Pubkey) -> agari_desk::accounts::OperatorSwap {
        let owner = self.owner.pubkey_of();
        agari_desk::accounts::OperatorSwap {
            operator: *operator,
            owner,
            config: DESK_CONFIG,
            desk: desk_address(&owner),
            usdc_mint: self.usdc,
            token_mint: self.name.mint,
            desk_usdc: self.desk_usdc(),
            desk_token: self.desk_name(),
            desk_ref: reference_address(&self.name.mint),
            swap_program: agari_swap_stub::ID,
            usdc_token_program: spl_token::ID,
            token_program: spl_token_2022::ID,
            price_update: None,
            event_authority: event_authority(),
            program: agari_desk::ID,
        }
    }

    /// The stub's route as remaining accounts: nothing is a signer here; the desk program flags its PDA on the CPI.
    fn route(&self, buy: bool, extra: &[AccountMeta]) -> Vec<AccountMeta> {
        let (caller_in, pool_in, pool_out, caller_out, mint_in, mint_out, program_in, program_out) = if buy {
            (self.desk_usdc(), self.pool_usdc, self.pool_name, self.desk_name(), self.usdc, self.name.mint, spl_token::ID, spl_token_2022::ID)
        } else {
            (self.desk_name(), self.pool_name, self.pool_usdc, self.desk_usdc(), self.name.mint, self.usdc, spl_token_2022::ID, spl_token::ID)
        };
        let swap = agari_swap_stub::accounts::Swap { authority: self.desk_address(), caller_in, pool_in, pool_out, caller_out, mint_in, mint_out, pool_authority: self.pool_authority, token_program_in: program_in, token_program_out: program_out };
        let mut metas: Vec<AccountMeta> = swap.to_account_metas(None).into_iter().map(|m| AccountMeta { is_signer: false, ..m }).collect();
        metas.extend_from_slice(extra);
        metas
    }

    #[allow(clippy::too_many_arguments)]
    pub fn buy_ix(&self, operator: &Pubkey, usdc_in: u64, min_token_out: u64, deadline_sec: i64, decision_hash: [u8; 32], stub_in: u64, stub_out: u64, extra: &[AccountMeta]) -> Instruction {
        let swap_data = agari_swap_stub::instruction::Swap { amount_in: stub_in, amount_out: stub_out }.data();
        let mut instruction = ix(self.swap_accounts(operator), agari_desk::instruction::OperatorBuy { usdc_in, min_token_out, deadline_sec, decision_hash, swap_data });
        instruction.accounts.extend(self.route(true, extra));
        instruction
    }

    #[allow(clippy::too_many_arguments)]
    pub fn sell_ix(&self, operator: &Pubkey, token_in: u64, min_usdc_out: u64, deadline_sec: i64, decision_hash: [u8; 32], stub_in: u64, stub_out: u64, extra: &[AccountMeta]) -> Instruction {
        let swap_data = agari_swap_stub::instruction::Swap { amount_in: stub_in, amount_out: stub_out }.data();
        let mut instruction = ix(self.swap_accounts(operator), agari_desk::instruction::OperatorSell { token_in, min_usdc_out, deadline_sec, decision_hash, swap_data });
        instruction.accounts.extend(self.route(false, extra));
        instruction
    }
}

/// A `Keypair` read without borrowing the world mutably.
pub trait PubkeyOf {
    fn pubkey_of(&self) -> Pubkey;
}

impl PubkeyOf for Keypair {
    fn pubkey_of(&self) -> Pubkey {
        solana_signer::Signer::pubkey(self)
    }
}
