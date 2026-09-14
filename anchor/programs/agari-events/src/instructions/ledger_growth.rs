//! `product_add_dependent` / `product_release_dependent` (events-instructions.md §5.6; PD-7) and
//! `public_grow_ledger(extra_seats)` (§4.5; PD-8, D-006).
//!
//! Dependents keep a Market (and its `MarketResult`) open while a product still has to read the result. Growth adds
//! at most 116 seats per call (`MAX_PERMITTED_DATA_INCREASE`); the payer funds the rent, which returns to the
//! Ledger's `rent_payer` at close even when a third party grew it (a documented donation).

use anchor_lang::prelude::*;
use anchor_lang::system_program::{self, Transfer};

use agari_common::seeds::CONFIG_SEED;

use super::venue_io::{bind_market, next_seq};
use crate::constants::{LEDGER_GROW_MAX, LEDGER_HEADER_LEN, LEDGER_MAX_SEATS};
use crate::errors::EventsError;
use crate::events::{DependentChanged, LedgerGrown};
use crate::state::{ledger_space, GlobalConfig, Ledger, Market, Mode};

#[event_cpi]
#[derive(Accounts)]
pub struct ProductDependent<'info> {
    /// A product's seat PDA listed in `config.program_authorities`.
    pub program_authority: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.load()?.bump)]
    pub config: AccountLoader<'info, GlobalConfig>,
    #[account(mut)]
    pub market: AccountLoader<'info, Market>,
}

pub fn product_add_dependent(ctx: Context<ProductDependent>) -> Result<()> {
    change_dependents(ctx, true)
}

pub fn product_release_dependent(ctx: Context<ProductDependent>) -> Result<()> {
    change_dependents(ctx, false)
}

fn change_dependents(ctx: Context<ProductDependent>, added: bool) -> Result<()> {
    let a = &ctx.accounts;
    let authority = a.program_authority.key();
    require!(a.config.load()?.program_authority_index(&authority).is_some(), EventsError::NotProgramAuthority);
    let mut market = a.market.load_mut()?;
    // Releasing a dependent that was never registered is a product bug, not a no-op.
    market.dependents = if added { market.dependents.checked_add(1) } else { market.dependents.checked_sub(1) }.ok_or(error!(EventsError::MathOverflow))?;
    let (dependents, seq) = (market.dependents, next_seq(&mut market)?);
    drop(market);
    emit_cpi!(DependentChanged { market: a.market.key(), seq, program_authority: authority, added, dependents });
    Ok(())
}

#[event_cpi]
#[derive(Accounts)]
pub struct PublicGrowLedger<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.load()?.bump)]
    pub config: AccountLoader<'info, GlobalConfig>,
    #[account(mut)]
    pub market: AccountLoader<'info, Market>,
    #[account(mut)]
    pub ledger: AccountLoader<'info, Ledger>,
    pub system_program: Program<'info, System>,
}

pub fn public_grow_ledger(ctx: Context<PublicGrowLedger>, extra_seats: u16) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let a = &ctx.accounts;
    let market_key = a.market.key();
    // 1. Normal mode only.
    require!(a.config.load()?.mode == u8::from(Mode::Normal), EventsError::InvalidMode);
    let mut market = a.market.load_mut()?;
    let capacity = {
        let ledger = a.ledger.load()?;
        // 2. B.
        bind_market(&market_key, &market, None, None, Some((&a.ledger.key(), &*ledger)), None)?;
        ledger.capacity
    };
    // 3. Still trading time: a Ledger stops mattering once the Window locks.
    require!(!market.is_terminal() && now < market.lock_at, EventsError::MarketNotTrading);
    // 4. 1..=116 more, never past 1,024.
    let new_capacity = capacity.checked_add(extra_seats).filter(|c| (1..=LEDGER_GROW_MAX).contains(&extra_seats) && *c <= LEDGER_MAX_SEATS);
    let new_capacity = new_capacity.ok_or(error!(EventsError::BadGrowAmount))?;
    let seq = next_seq(&mut market)?;
    drop(market);

    let info = a.ledger.to_account_info();
    let new_len = ledger_space(usize::from(new_capacity));
    let rent = Rent::get()?.minimum_balance(new_len).saturating_sub(info.lamports());
    if rent > 0 {
        let accounts = Transfer { from: a.payer.to_account_info(), to: info.clone() };
        system_program::transfer(CpiContext::new(a.system_program.key(), accounts), rent)?;
    }
    // New bytes are zero, which is an empty seat. The header is rewritten directly: the seat slice no longer matches
    // `capacity` until it is.
    info.resize(new_len)?;
    {
        let mut data = info.try_borrow_mut_data()?;
        let header: &mut Ledger = bytemuck::try_from_bytes_mut(&mut data[8..8 + LEDGER_HEADER_LEN]).map_err(|_| error!(ErrorCode::AccountDidNotDeserialize))?;
        header.capacity = new_capacity;
    }
    emit_cpi!(LedgerGrown { market: market_key, seq, payer: a.payer.key(), capacity: new_capacity });
    Ok(())
}
