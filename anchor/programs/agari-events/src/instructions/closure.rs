//! Closure (events-instructions.md §5.2, §5.5, §5.7; events-engine.md §8.5; PD-7), in the order it can happen:
//! `public_release_book` (Locked or terminal, no orders) → `public_close_ledger` (terminal, every seat redeemed,
//! donation-safe) → `public_close_market` (both flags, no dependents, retention elapsed). All permissionless.

use anchor_lang::prelude::*;
use anchor_spl::token::{self, CloseAccount, Mint, Token, TokenAccount};

use agari_common::seeds::{CONFIG_SEED, MARKET_SEED, RESULT_SEED};

use super::venue_io::{bind_market, next_seq, MarketSigner, TokenMove};
use crate::constants::MAX_FREE_BOOKS;
use crate::errors::EventsError;
use crate::events::{BookReleased, LedgerClosed, MarketClosed};
use crate::matching::redeem::ledger_is_empty;
use crate::state::{
    ledger_parts_mut, Book, GlobalConfig, Ledger, Market, MarketResult, MarketStatus, Series, MARKET_FLAG_BOOK_RELEASED, MARKET_FLAG_LEDGER_CLOSED,
};

#[event_cpi]
#[derive(Accounts)]
pub struct PublicReleaseBook<'info> {
    #[account(mut)]
    pub series: AccountLoader<'info, Series>,
    #[account(mut)]
    pub market: AccountLoader<'info, Market>,
    #[account(mut)]
    pub book: AccountLoader<'info, Book>,
}

pub fn public_release_book(ctx: Context<PublicReleaseBook>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let a = &ctx.accounts;
    let (series_key, market_key, book_key) = (a.series.key(), a.market.key(), a.book.key());
    let mut series = a.series.load_mut()?;
    let mut market = a.market.load_mut()?;
    let mut book = a.book.load_mut()?;
    // 1. B.
    bind_market(&market_key, &market, Some(&series_key), Some((&book_key, &*book)), None, None)?;
    // 2. Locked or terminal (a void can land before `lock_at`).
    require!(matches!(market.status(now), MarketStatus::Locked | MarketStatus::Resolved | MarketStatus::Voided), EventsError::MarketNotLocked);
    // 3–5. No resting order, not already released, room on the free list.
    require!(book.order_count == 0, EventsError::OpenOrdersRemain);
    require!(market.flags & MARKET_FLAG_BOOK_RELEASED == 0, EventsError::BookMarketMismatch);
    require!(usize::from(series.free_book_count) < MAX_FREE_BOOKS, EventsError::TooManyBooks);

    // With no order the ladders and bitmaps are already empty (§8.3 book invariant); `next_seq` is never reset, so
    // every handle into this generation stays stale after the next bind.
    book.market = Pubkey::default();
    let count = usize::from(series.free_book_count);
    series.free_books[count] = book_key;
    series.free_book_count += 1;
    market.flags |= MARKET_FLAG_BOOK_RELEASED;
    let seq = next_seq(&mut market)?;
    emit_cpi!(BookReleased { market: market_key, seq, book: book_key, series: series_key });
    Ok(())
}

#[event_cpi]
#[derive(Accounts)]
pub struct PublicCloseLedger<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.load()?.bump)]
    pub config: AccountLoader<'info, GlobalConfig>,
    #[account(mut)]
    pub market: AccountLoader<'info, Market>,
    #[account(mut, close = rent_payer)]
    pub ledger: AccountLoader<'info, Ledger>,
    #[account(mut)]
    pub mvault: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub treasury: Box<Account<'info, TokenAccount>>,
    /// CHECK: must be `ledger.rent_payer` (step 3); receives the Ledger and mvault rent.
    #[account(mut)]
    pub rent_payer: UncheckedAccount<'info>,
    pub collateral_mint: Box<Account<'info, Mint>>,
    pub token_program: Program<'info, Token>,
}

pub fn public_close_ledger(ctx: Context<PublicCloseLedger>) -> Result<()> {
    let a = &ctx.accounts;
    let market_key = a.market.key();
    let mut market = a.market.load_mut()?;
    let ledger_info = a.ledger.to_account_info();
    let mut ledger_data = ledger_info.try_borrow_mut_data()?;
    let (ledger, seats) = ledger_parts_mut(&mut ledger_data)?;
    // 1. B.
    bind_market(&market_key, &market, None, None, Some((&a.ledger.key(), ledger)), Some(&a.mvault.key()))?;
    {
        let config = a.config.load()?;
        require_keys_eq!(a.collateral_mint.key(), config.collateral_mint, EventsError::WrongMint);
        require_keys_eq!(a.token_program.key(), config.token_program, EventsError::WrongTokenProgram);
        // 2. The configured treasury.
        require_keys_eq!(a.treasury.key(), config.treasury, EventsError::WrongTokenOwner);
    }
    // 3. The rent goes back to whoever paid for the Ledger (and every grow of it).
    require_keys_eq!(a.rent_payer.key(), ledger.rent_payer, EventsError::LedgerMarketMismatch);
    // 4–5. Terminal, every seat redeemed and its bond returned.
    require!(market.is_terminal(), EventsError::MarketNotTerminal);
    require!(ledger_is_empty(ledger, seats), EventsError::LedgerNotEmpty);

    // Donation-safe: nothing is owed any more, so whatever the mvault still holds was sent to it, not earned in it.
    let residue = a.mvault.amount;
    market.flags |= MARKET_FLAG_LEDGER_CLOSED;
    let seq = next_seq(&mut market)?;
    let signer = MarketSigner::of(&market);
    drop(market);
    drop(ledger_data);

    let (program, mint, mvault, treasury) = (a.token_program.to_account_info(), a.collateral_mint.to_account_info(), a.mvault.to_account_info(), a.treasury.to_account_info());
    let io = TokenMove { token_program: &program, mint: &mint, mvault: &mvault, authority_token: &treasury, decimals: a.collateral_mint.decimals };
    io.pay(&a.market.to_account_info(), &signer.series, signer.index, signer.bump, residue)?;
    emit_cpi!(LedgerClosed { market: market_key, seq, residue });

    let index = signer.index.to_le_bytes();
    let bump = [signer.bump];
    let seeds: &[&[u8]] = &[MARKET_SEED, signer.series.as_ref(), &index, &bump];
    let accounts = CloseAccount { account: mvault, destination: a.rent_payer.to_account_info(), authority: a.market.to_account_info() };
    token::close_account(CpiContext::new_with_signer(program.key(), accounts, &[seeds]))
    // The Ledger itself closes to `rent_payer` on exit (`close = rent_payer`).
}

#[event_cpi]
#[derive(Accounts)]
pub struct PublicCloseMarket<'info> {
    #[account(mut, close = market_rent_payer)]
    pub market: AccountLoader<'info, Market>,
    #[account(mut, seeds = [RESULT_SEED, market.key().as_ref()], bump = result.load()?.bump, close = result_rent_payer)]
    pub result: AccountLoader<'info, MarketResult>,
    /// CHECK: must be `market.rent_payer` (step 2).
    #[account(mut)]
    pub market_rent_payer: UncheckedAccount<'info>,
    /// CHECK: must be `result.rent_payer` (step 2).
    #[account(mut)]
    pub result_rent_payer: UncheckedAccount<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.load()?.bump)]
    pub config: AccountLoader<'info, GlobalConfig>,
}

pub fn public_close_market(ctx: Context<PublicCloseMarket>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let a = &ctx.accounts;
    let market_key = a.market.key();
    let retention = i64::from(a.config.load()?.result_retention_sec);
    let mut market = a.market.load_mut()?;
    let result = a.result.load()?;
    // 1. The canonical `["result", market]` PDA exists (Anchor's seeds and owner checks), written for this Market.
    require_keys_eq!(result.market, market_key, EventsError::MarketNotTerminal);
    // 2. Rent goes back to the accounts' own payers.
    require_keys_eq!(a.market_rent_payer.key(), market.rent_payer, EventsError::LedgerMarketMismatch);
    require_keys_eq!(a.result_rent_payer.key(), result.rent_payer, EventsError::LedgerMarketMismatch);
    // 3–5. Book back on its Series, Ledger closed, no product still reading, retention elapsed.
    require!(market.flags & MARKET_FLAG_BOOK_RELEASED != 0, EventsError::BookNotReleased);
    require!(market.flags & MARKET_FLAG_LEDGER_CLOSED != 0, EventsError::LedgerNotClosed);
    require!(market.dependents == 0, EventsError::DependentsRemain);
    let closes_at = result.resolved_ts.checked_add(retention).ok_or(error!(EventsError::MathOverflow))?;
    require!(now >= closes_at, EventsError::RetentionNotElapsed);

    let seq = next_seq(&mut market)?;
    drop(result);
    drop(market);
    emit_cpi!(MarketClosed { market: market_key, seq, result: a.result.key() });
    // Both accounts close on exit (`close = market_rent_payer`, `close = result_rent_payer`).
    Ok(())
}
