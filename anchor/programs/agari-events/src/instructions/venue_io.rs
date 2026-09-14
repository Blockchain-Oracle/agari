//! What every trading instruction shares: the binding checks `B` (events-instructions.md notation), token moves
//! into and out of the Window's mvault, and the Market PDA signer. Payouts only ever reach a token account owned by
//! the authority that signed (AD-5).

use anchor_lang::prelude::*;
use anchor_spl::token::{self, TokenAccount, TransferChecked};

use agari_common::seeds::MARKET_SEED;

use crate::errors::EventsError;
use crate::state::{Book, GlobalConfig, Ledger, Market};

/// Market ⇄ series ⇄ book ⇄ ledger ⇄ mvault bindings, in the notation's order; absent accounts are skipped.
pub fn bind_market(
    market_key: &Pubkey,
    market: &Market,
    series: Option<&Pubkey>,
    book: Option<(&Pubkey, &Book)>,
    ledger: Option<(&Pubkey, &Ledger)>,
    mvault: Option<&Pubkey>,
) -> Result<()> {
    if let Some(series) = series {
        require_keys_eq!(market.series, *series, EventsError::SeriesMarketMismatch);
    }
    if let Some((key, book)) = book {
        require!(market.book == *key && book.market == *market_key, EventsError::BookMarketMismatch);
    }
    if let Some((key, ledger)) = ledger {
        require!(market.ledger == *key && ledger.market == *market_key, EventsError::LedgerMarketMismatch);
    }
    if let Some(mvault) = mvault {
        require_keys_eq!(market.mvault, *mvault, EventsError::MvaultMarketMismatch);
    }
    Ok(())
}

/// Collateral mint, token program and the authority's token account (mint, then owner == authority).
pub fn bind_tokens(config: &GlobalConfig, mint: &Pubkey, token_program: &Pubkey, authority_token: &TokenAccount, authority: &Pubkey) -> Result<()> {
    require_keys_eq!(*mint, config.collateral_mint, EventsError::WrongMint);
    require_keys_eq!(*token_program, config.token_program, EventsError::WrongTokenProgram);
    require_keys_eq!(authority_token.mint, config.collateral_mint, EventsError::WrongMint);
    require_keys_eq!(authority_token.owner, *authority, EventsError::WrongTokenOwner);
    Ok(())
}

/// The accounts a token move touches.
pub struct TokenMove<'a, 'info> {
    pub token_program: &'a AccountInfo<'info>,
    pub mint: &'a AccountInfo<'info>,
    pub mvault: &'a AccountInfo<'info>,
    pub authority_token: &'a AccountInfo<'info>,
    pub decimals: u8,
}

impl<'info> TokenMove<'_, 'info> {
    /// `transfer_checked(authority_token → mvault)`, signed by the authority; nothing when `amount == 0`.
    pub fn pull(&self, authority: &AccountInfo<'info>, amount: u64) -> Result<()> {
        if amount == 0 {
            return Ok(());
        }
        let accounts = TransferChecked { from: self.authority_token.clone(), mint: self.mint.clone(), to: self.mvault.clone(), authority: authority.clone() };
        token::transfer_checked(CpiContext::new(self.token_program.key(), accounts), amount, self.decimals)
    }

    /// `transfer_checked(mvault → authority_token)`, signed by the Market PDA; nothing when `amount == 0`.
    pub fn pay(&self, market: &AccountInfo<'info>, series: &Pubkey, index: u64, bump: u8, amount: u64) -> Result<()> {
        if amount == 0 {
            return Ok(());
        }
        let index = index.to_le_bytes();
        let bump = [bump];
        let seeds: &[&[u8]] = &[MARKET_SEED, series.as_ref(), &index, &bump];
        let signer = &[seeds];
        let accounts = TransferChecked { from: self.mvault.clone(), mint: self.mint.clone(), to: self.authority_token.clone(), authority: market.clone() };
        token::transfer_checked(CpiContext::new_with_signer(self.token_program.key(), accounts, signer), amount, self.decimals)
    }
}

/// The Market PDA fields a payout signs with.
#[derive(Clone, Copy)]
pub struct MarketSigner {
    pub series: Pubkey,
    pub index: u64,
    pub bump: u8,
}

impl MarketSigner {
    pub fn of(market: &Market) -> Self {
        MarketSigner { series: market.series, index: market.index, bump: market.bump }
    }
}

/// `seq = ++event_seq` or MathOverflow.
pub fn next_seq(market: &mut Market) -> Result<u64> {
    market.next_seq().ok_or_else(|| error!(EventsError::MathOverflow))
}

/// The Series parameters trading reads, copied out so the Series borrow ends before the Book and Ledger borrows.
#[derive(Clone, Copy)]
pub struct SeriesView {
    pub cash_unit: u64,
    pub min_lots: u64,
    pub fills_cap: u8,
    pub evictions_cap: u8,
}

impl SeriesView {
    pub fn of(series: &crate::state::Series) -> Self {
        SeriesView { cash_unit: series.cash_unit, min_lots: series.min_lots, fills_cap: series.fills_cap, evictions_cap: series.evictions_cap }
    }
}
