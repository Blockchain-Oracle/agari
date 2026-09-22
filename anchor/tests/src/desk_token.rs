//! Token-2022 fixtures for the desk suites (S21, desk.md §9): a PreStocks-shaped name with every extension the real
//! mints carry on mainnet (2026-09-22): 9 dp, TransferFee 100 bps, ScaledUiAmount, Pausable, DefaultAccountState
//! initialized, a freeze authority; plus readers for Token-2022 accounts, whose base state sits before the TLV.

use anchor_lang::prelude::Pubkey;
use anchor_lang::solana_program::program_pack::Pack;
use anchor_lang::solana_program::system_instruction;
use anchor_spl::associated_token::{get_associated_token_address_with_program_id, spl_associated_token_account::instruction::create_associated_token_account_idempotent};
use anchor_spl::token_2022::spl_token_2022;
use solana_keypair::Keypair;
use solana_signer::Signer;
use spl_token_2022::extension::{default_account_state, pausable, scaled_ui_amount, transfer_fee, ExtensionType, StateWithExtensions};
use spl_token_2022::instruction as t22;
use spl_token_2022::state::{Account as Account2022, AccountState, Mint as Mint2022};

use crate::harness::{Harness, SOL};

pub const NAME_DECIMALS: u8 = 9;
pub const TRANSFER_FEE_BPS: u16 = 100;
/// OPENAI's multiplier on mainnet (2026-09-22).
pub const NAME_MULTIPLIER: f64 = 1.4861347;

/// A name mint and the key that is its mint, freeze, fee and pause authority.
pub struct NameMint {
    pub mint: Pubkey,
    pub authority: Keypair,
}

impl NameMint {
    pub fn pubkey(&self) -> Pubkey {
        self.mint
    }
}

/// The transfer fee the mint withholds on `amount`: `ceil(amount × 100 / 10000)`, as Token-2022 computes it.
pub fn transfer_fee(amount: u64) -> u64 {
    let fee = u128::from(amount) * u128::from(TRANSFER_FEE_BPS);
    ((fee + 9_999) / 10_000) as u64
}

impl Harness {
    /// A PreStocks-shaped Token-2022 mint (one owner key for every authority), paid by that key.
    pub fn create_name_mint(&mut self, multiplier: f64) -> NameMint {
        let authority = self.fresh_key();
        let mint = self.fresh_key();
        self.svm.airdrop(&authority.pubkey(), 10 * SOL).expect("airdrop");
        let a = authority.pubkey();
        let m = mint.pubkey();
        let extensions = [ExtensionType::TransferFeeConfig, ExtensionType::ScaledUiAmount, ExtensionType::Pausable, ExtensionType::DefaultAccountState];
        let space = ExtensionType::try_calculate_account_len::<Mint2022>(&extensions).unwrap();
        let lamports = self.svm.minimum_balance_for_rent_exemption(space);
        let ixs = [
            system_instruction::create_account(&a, &m, lamports, space as u64, &spl_token_2022::ID),
            transfer_fee::instruction::initialize_transfer_fee_config(&spl_token_2022::ID, &m, Some(&a), Some(&a), TRANSFER_FEE_BPS, u64::MAX).unwrap(),
            scaled_ui_amount::instruction::initialize(&spl_token_2022::ID, &m, Some(a), multiplier).unwrap(),
            pausable::instruction::initialize(&spl_token_2022::ID, &m, &a).unwrap(),
            default_account_state::instruction::initialize_default_account_state(&spl_token_2022::ID, &m, &AccountState::Initialized).unwrap(),
            t22::initialize_mint2(&spl_token_2022::ID, &m, &a, Some(&a), NAME_DECIMALS).unwrap(),
        ];
        self.ok(&ixs, &[&authority, &mint]);
        NameMint { mint: m, authority }
    }

    /// A Token-2022 mint with no extensions and `decimals` places (to prove the desk refuses anything but 9 dp).
    pub fn create_plain_2022_mint(&mut self, decimals: u8) -> Pubkey {
        let authority = self.fresh_key();
        let mint = self.fresh_key();
        self.svm.airdrop(&authority.pubkey(), 10 * SOL).expect("airdrop");
        let space = Mint2022::LEN;
        let lamports = self.svm.minimum_balance_for_rent_exemption(space);
        let ixs = [
            system_instruction::create_account(&authority.pubkey(), &mint.pubkey(), lamports, space as u64, &spl_token_2022::ID),
            t22::initialize_mint2(&spl_token_2022::ID, &mint.pubkey(), &authority.pubkey(), None, decimals).unwrap(),
        ];
        self.ok(&ixs, &[&authority, &mint]);
        mint.pubkey()
    }

    /// `owner`'s associated Token-2022 account of `mint`, created idempotently with `payer` paying.
    pub fn ata_2022(&mut self, payer: &Keypair, owner: &Pubkey, mint: &Pubkey) -> Pubkey {
        let ix = create_associated_token_account_idempotent(&payer.pubkey(), owner, mint, &spl_token_2022::ID);
        self.ok(&[ix], &[payer]);
        get_associated_token_address_with_program_id(owner, mint, &spl_token_2022::ID)
    }

    pub fn ata_2022_address(owner: &Pubkey, mint: &Pubkey) -> Pubkey {
        get_associated_token_address_with_program_id(owner, mint, &spl_token_2022::ID)
    }

    /// Mints `amount` raw units of `name` into `account` (no fee on a mint).
    pub fn mint_name(&mut self, name: &NameMint, account: &Pubkey, amount: u64) {
        let ix = t22::mint_to_checked(&spl_token_2022::ID, &name.mint, account, &name.authority.pubkey(), &[], amount, NAME_DECIMALS).unwrap();
        self.ok(&[ix], &[&name.authority]);
    }

    /// The base `amount` of a Token-2022 account (0 when it does not exist).
    pub fn amount_2022(&self, account: &Pubkey) -> u64 {
        let data = self.account_data(account);
        if data.is_empty() {
            return 0;
        }
        StateWithExtensions::<Account2022>::unpack(&data).expect("token-2022 account").base.amount
    }

    pub fn is_frozen_2022(&self, account: &Pubkey) -> bool {
        let data = self.account_data(account);
        StateWithExtensions::<Account2022>::unpack(&data).expect("token-2022 account").base.state == AccountState::Frozen
    }

    /// The issuer freezes one account, as PreStocks' terms allow.
    pub fn freeze_name_account(&mut self, name: &NameMint, account: &Pubkey) {
        let ix = t22::freeze_account(&spl_token_2022::ID, account, &name.mint, &name.authority.pubkey(), &[]).unwrap();
        self.ok(&[ix], &[&name.authority]);
    }

    /// The issuer pauses every transfer of the mint.
    pub fn pause_name(&mut self, name: &NameMint) {
        let ix = pausable::instruction::pause(&spl_token_2022::ID, &name.mint, &name.authority.pubkey(), &[]).unwrap();
        self.ok(&[ix], &[&name.authority]);
    }
}
