//! `roller_open_window(args)` (events-instructions.md §1.7, amended by D-013): lists one Window on a free Book,
//! with its Ledger (96 seats, PROGRAM seats pre-allocated) and its per-Window mvault.

use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};
use core::mem::size_of;

use agari_common::seeds::{CONFIG_SEED, LEDGER_SEED, MARKET_SEED, MVAULT_SEED};

use super::args::OpenWindowArgs;
use super::window_rules::{check_window, deadlines};
use crate::constants::{LEDGER_HEADER_LEN, LEDGER_INITIAL_SEATS, MAX_PROGRAM_AUTHORITIES};
use crate::errors::EventsError;
use crate::events::WindowOpened;
use crate::state::{ledger_space, Book, GlobalConfig, Ledger, Market, MarketState, Mode, Seat, Series, SEAT_FLAG_PROGRAM};

#[event_cpi]
#[derive(Accounts)]
#[instruction(args: OpenWindowArgs)]
pub struct RollerOpenWindow<'info> {
    pub roller: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.load()?.bump)]
    pub config: AccountLoader<'info, GlobalConfig>,
    #[account(mut)]
    pub series: AccountLoader<'info, Series>,
    #[account(
        init,
        payer = payer,
        space = 8 + size_of::<Market>(),
        seeds = [MARKET_SEED, series.key().as_ref(), &args.index.to_le_bytes()],
        bump
    )]
    pub market: AccountLoader<'info, Market>,
    #[account(
        init,
        payer = payer,
        space = ledger_space(usize::from(LEDGER_INITIAL_SEATS)),
        seeds = [LEDGER_SEED, market.key().as_ref()],
        bump
    )]
    pub ledger: AccountLoader<'info, Ledger>,
    #[account(
        init,
        payer = payer,
        seeds = [MVAULT_SEED, market.key().as_ref()],
        bump,
        token::mint = collateral_mint,
        token::authority = market,
        token::token_program = token_program
    )]
    pub mvault: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub book: AccountLoader<'info, Book>,
    pub collateral_mint: Box<Account<'info, Mint>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn roller_open_window(ctx: Context<RollerOpenWindow>, args: OpenWindowArgs) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let a = &ctx.accounts;
    let config = a.config.load()?;
    // 1–3. Roller, mode, collateral bindings.
    require!(config.is_roller(&a.roller.key()), EventsError::NotRoller);
    require!(config.mode == u8::from(Mode::Normal), EventsError::InvalidMode);
    require_keys_eq!(a.collateral_mint.key(), config.collateral_mint, EventsError::WrongMint);
    require_keys_eq!(a.token_program.key(), config.token_program, EventsError::WrongTokenProgram);
    let program_authorities = config.program_authorities;
    drop(config);

    // 4–10. Index, horizon, overlap, alignment, kinds, version coverage.
    let mut series = a.series.load_mut()?;
    check_window(&series, &args, now)?;
    let deadlines = deadlines(&series, &args)?;

    // 11. A free, empty Book of this Series.
    let book_key = a.book.key();
    let slot = series.free_books().iter().position(|k| *k == book_key).ok_or(error!(EventsError::NoFreeBook))?;
    let mut book = a.book.load_mut()?;
    require!(book.order_count == 0 && book.market == Pubkey::default(), EventsError::BookMarketMismatch);

    // Effects: bind the Book (swap-remove from the free list).
    let last = usize::from(series.free_book_count) - 1;
    series.free_books[slot] = series.free_books[last];
    series.free_books[last] = Pubkey::default();
    series.free_book_count -= 1;
    book.market = a.market.key();
    book.generation = book.generation.checked_add(1).ok_or(error!(EventsError::MathOverflow))?;
    let generation = book.generation;
    drop(book);

    let basis = series.basis;
    let seat_bond = series.seat_bond;
    series.next_index = series.next_index.checked_add(1).ok_or(error!(EventsError::MathOverflow))?;
    series.last_expiry = args.expiry;
    drop(series);

    let mut market = a.market.load_init()?;
    market.series = a.series.key();
    market.book = book_key;
    market.ledger = a.ledger.key();
    market.mvault = a.mvault.key();
    market.rent_payer = a.payer.key();
    market.index = args.index;
    market.trading_start = args.trading_start;
    market.lock_at = args.lock_at;
    market.expiry = args.expiry;
    market.open_deadline = deadlines.open_deadline;
    market.close_deadline = deadlines.close_deadline;
    market.policy_version = args.policy_version;
    market.open_kind = args.open_kind;
    market.close_kind = args.close_kind;
    market.basis = basis;
    market.state = u8::from(MarketState::Open);
    market.bump = ctx.bumps.market;
    market.ledger_bump = ctx.bumps.ledger;
    market.mvault_bump = ctx.bumps.mvault;
    let seq = market.next_seq().ok_or(error!(EventsError::MathOverflow))?;
    drop(market);

    init_ledger(&a.ledger, a.market.key(), a.payer.key(), seat_bond, &program_authorities, ctx.bumps.ledger)?;

    emit_cpi!(WindowOpened {
        market: a.market.key(),
        series: a.series.key(),
        seq,
        index: args.index,
        trading_start: args.trading_start,
        lock_at: args.lock_at,
        expiry: args.expiry,
        open_deadline: deadlines.open_deadline,
        close_deadline: deadlines.close_deadline,
        policy_version: args.policy_version,
        open_kind: args.open_kind,
        close_kind: args.close_kind,
        basis,
        book: book_key,
        ledger: a.ledger.key(),
        mvault: a.mvault.key(),
        generation,
    });
    Ok(())
}

/// Ledger header, then the PROGRAM seats. The discriminator is still zero here (Anchor writes it on exit), so the
/// seats are cast straight from the bytes after the header instead of through `ledger_parts_mut`.
fn init_ledger(
    ledger: &AccountLoader<Ledger>,
    market: Pubkey,
    payer: Pubkey,
    seat_bond: u64,
    program_authorities: &[Pubkey; MAX_PROGRAM_AUTHORITIES],
    bump: u8,
) -> Result<()> {
    let mut header = ledger.load_init()?;
    header.market = market;
    header.rent_payer = payer;
    header.seat_bond = seat_bond;
    header.capacity = LEDGER_INITIAL_SEATS;
    header.seats_used = MAX_PROGRAM_AUTHORITIES as u16;
    header.bump = bump;
    drop(header);

    let info = ledger.to_account_info();
    let mut data = info.try_borrow_mut_data()?;
    let seats: &mut [Seat] = bytemuck::try_cast_slice_mut(&mut data[8 + LEDGER_HEADER_LEN..]).map_err(|_| error!(ErrorCode::AccountDidNotDeserialize))?;
    for (seat, owner) in seats.iter_mut().zip(program_authorities.iter()) {
        if *owner != Pubkey::default() {
            seat.owner = *owner;
            seat.flags = SEAT_FLAG_PROGRAM;
        }
    }
    Ok(())
}
