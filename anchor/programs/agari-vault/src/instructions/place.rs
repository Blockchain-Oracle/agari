//! `owner_place` and `actor_place_for` (vault.md §3.4; Masayume `EventVault.sol:138-187`, `VenueGateway.sol:85-104`):
//! one IOC through the vault's PROGRAM seat. Every vault write happens after the engine returns, from its
//! `PlaceResult` and the custody delta; any refusal reverts the fill with it.

use anchor_lang::prelude::*;
use anchor_spl::token::{accessor, Token, TokenAccount};

use agari_events::program::AgariEvents;

use crate::caps::{count_opened, require_escrow, require_live, require_price_cap, side_ticks, spend};
use crate::constants::{ACCOUNT_SEED, ATTENDED, CUSTODY_SEED, EVENTS_CONFIG, EVENTS_EVENT_AUTHORITY, SEAT, VAULT_CONFIG};
use crate::engine::{self, Engine};
use crate::errors::VaultError;
use crate::events::Executed;
use crate::positions::{book_buy, book_sell, buy_slot, held};
use crate::state::{Grant, VaultAccount, VaultConfig};

#[event_cpi]
#[derive(Accounts)]
pub struct OwnerPlace<'info> {
    pub owner: Signer<'info>,
    #[account(address = VAULT_CONFIG)]
    pub vault_config: AccountLoader<'info, VaultConfig>,
    #[account(mut, seeds = [ACCOUNT_SEED, owner.key().as_ref()], bump = account.load()?.bump)]
    pub account: AccountLoader<'info, VaultAccount>,
    #[account(mut, seeds = [CUSTODY_SEED, owner.key().as_ref()], bump = account.load()?.custody_bump)]
    pub custody: Box<Account<'info, TokenAccount>>,
    /// CHECK: the vault's seat PDA; it signs the engine call.
    #[account(address = SEAT)]
    pub seat: UncheckedAccount<'info>,
    pub events_program: Program<'info, AgariEvents>,
    /// CHECK: agari-events GlobalConfig, read with `load_checked`.
    #[account(address = EVENTS_CONFIG)]
    pub events_config: UncheckedAccount<'info>,
    /// CHECK: bound to the market with `load_checked` (UnknownMarket).
    pub series: UncheckedAccount<'info>,
    /// CHECK: an agari-events Market, read with `load_checked`.
    #[account(mut)]
    pub market: UncheckedAccount<'info>,
    /// CHECK: bound to the market both ways.
    #[account(mut)]
    pub book: UncheckedAccount<'info>,
    /// CHECK: bound to the market both ways; the vault's seat is checked in it.
    #[account(mut)]
    pub ledger: UncheckedAccount<'info>,
    /// CHECK: must be `market.mvault`.
    #[account(mut)]
    pub mvault: UncheckedAccount<'info>,
    /// CHECK: the vault's collateral mint.
    #[account(address = vault_config.load()?.collateral_mint @ VaultError::WrongCollateral)]
    pub collateral_mint: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
    /// CHECK: agari-events' event authority.
    #[account(address = EVENTS_EVENT_AUTHORITY)]
    pub events_event_authority: UncheckedAccount<'info>,
}

#[event_cpi]
#[derive(Accounts)]
pub struct ActorPlaceFor<'info> {
    pub actor: Signer<'info>,
    #[account(address = VAULT_CONFIG)]
    pub vault_config: AccountLoader<'info, VaultConfig>,
    #[account(mut)]
    pub grant: AccountLoader<'info, Grant>,
    /// CHECK: must be `grant.owner` (NotGrantOwner); derives the account and custody seeds.
    pub owner: UncheckedAccount<'info>,
    #[account(mut, seeds = [ACCOUNT_SEED, owner.key().as_ref()], bump = account.load()?.bump)]
    pub account: AccountLoader<'info, VaultAccount>,
    #[account(mut, seeds = [CUSTODY_SEED, owner.key().as_ref()], bump = account.load()?.custody_bump)]
    pub custody: Box<Account<'info, TokenAccount>>,
    /// CHECK: the vault's seat PDA; it signs the engine call.
    #[account(address = SEAT)]
    pub seat: UncheckedAccount<'info>,
    pub events_program: Program<'info, AgariEvents>,
    /// CHECK: agari-events GlobalConfig, read with `load_checked`.
    #[account(address = EVENTS_CONFIG)]
    pub events_config: UncheckedAccount<'info>,
    /// CHECK: bound to the market with `load_checked` (UnknownMarket).
    pub series: UncheckedAccount<'info>,
    /// CHECK: an agari-events Market, read with `load_checked`.
    #[account(mut)]
    pub market: UncheckedAccount<'info>,
    /// CHECK: bound to the market both ways.
    #[account(mut)]
    pub book: UncheckedAccount<'info>,
    /// CHECK: bound to the market both ways; the vault's seat is checked in it.
    #[account(mut)]
    pub ledger: UncheckedAccount<'info>,
    /// CHECK: must be `market.mvault`.
    #[account(mut)]
    pub mvault: UncheckedAccount<'info>,
    /// CHECK: the vault's collateral mint.
    #[account(address = vault_config.load()?.collateral_mint @ VaultError::WrongCollateral)]
    pub collateral_mint: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
    /// CHECK: agari-events' event authority.
    #[account(address = EVENTS_EVENT_AUTHORITY)]
    pub events_event_authority: UncheckedAccount<'info>,
}

/// An order as the caller sent it (YES-terms price).
#[derive(Clone, Copy)]
struct Order {
    outcome: u8,
    is_buy: bool,
    price_ticks: u16,
    lots: u64,
    expire_ts: i64,
}

/// Who pays: the owner's `available`, or a grant's budget under its caps.
enum Route<'a, 'info> {
    Attended,
    Grant { grant: &'a AccountLoader<'info, Grant>, id: u64 },
}

/// What moved: `(cash_delta, lots_delta, fills)`.
type Fill = (u64, u64, u8);

macro_rules! engine_of {
    ($a:expr) => {
        Engine {
            program: $a.events_program.to_account_info(),
            config: $a.events_config.to_account_info(),
            series: $a.series.to_account_info(),
            market: $a.market.to_account_info(),
            book: Some($a.book.to_account_info()),
            ledger: $a.ledger.to_account_info(),
            mvault: $a.mvault.to_account_info(),
            mint: $a.collateral_mint.to_account_info(),
            token_program: $a.token_program.to_account_info(),
            event_authority: $a.events_event_authority.to_account_info(),
            seat: $a.seat.to_account_info(),
            custody: $a.custody.to_account_info(),
        }
    };
}

/// Steps 2–7, the CPI and the booking, shared by both routes (step 1 is the caller's).
fn execute(route: Route, vault_config: &AccountLoader<VaultConfig>, account: &AccountLoader<VaultAccount>, e: &Engine, o: Order, now: i64) -> Result<Fill> {
    let (collateral_mint, seat_bump) = {
        let c = vault_config.load()?;
        (c.collateral_mint, c.seat_bump)
    };
    // 2. R.
    let window = engine::resolve(e, &collateral_mint, Some((o.outcome, o.price_ticks)))?;
    let side = side_ticks(o.outcome, o.price_ticks);
    let market = e.market.key();
    let slot = {
        let a = account.load()?;
        if o.is_buy {
            // 3–4. The price cap (grant route), then the escrow at the limit from the paying bucket.
            let bucket = match &route {
                Route::Grant { grant, .. } => {
                    let g = grant.load()?;
                    require_price_cap(&g, side)?;
                    g.budget
                }
                Route::Attended => a.available,
            };
            require_escrow(bucket, o.lots, side, window.cash_unit)?;
        } else {
            // 5. Sells skip every cap but must be held.
            require!(o.lots != 0, VaultError::ZeroAmount);
            require!(held(&a, &market, o.outcome) >= o.lots, VaultError::Insufficient);
        }
        // 6. Status.
        require!(window.is_trading(now), VaultError::MarketNotTrading);
        // 7. Slot.
        if o.is_buy {
            buy_slot(&a, &market)?
        } else {
            a.slot_of(&market).ok_or(VaultError::Insufficient)?
        }
    };

    let client_id = match &route {
        Route::Grant { id, .. } => *id,
        Route::Attended => ATTENDED,
    };
    let before = accessor::amount(&e.custody)?;
    let r = engine::place(e, seat_bump, engine::ioc_args(&window, o.outcome, o.is_buy, o.price_ticks, o.lots, o.expire_ts, client_id))?;
    let after = accessor::amount(&e.custody)?;
    require!(r.rested_lots == 0, VaultError::EngineAccountingMismatch);

    let mut a = account.load_mut()?;
    if o.is_buy {
        let pulled = before.checked_sub(after);
        require!(r.transferred_in == r.cash_spent && r.withdrawn == 0 && pulled == Some(r.cash_spent), VaultError::EngineAccountingMismatch);
        match route {
            Route::Grant { grant, id } => {
                let mut g = grant.load_mut()?;
                spend(&mut g, r.cash_spent, now)?;
                if book_buy(&mut a, slot, &market, o.outcome, r.filled_lots, id)? {
                    count_opened(&mut g)?;
                }
            }
            Route::Attended => {
                a.available = a.available.checked_sub(r.cash_spent).ok_or(VaultError::Insufficient)?;
                book_buy(&mut a, slot, &market, o.outcome, r.filled_lots, ATTENDED)?;
            }
        }
        Ok((r.cash_spent, r.filled_lots, r.fills))
    } else {
        let paid = after.checked_sub(before);
        require!(r.transferred_in == 0 && r.withdrawn == r.cash_received && paid == Some(r.cash_received), VaultError::EngineAccountingMismatch);
        book_sell(&mut a, slot, o.outcome, r.filled_lots, r.cash_received)?;
        Ok((r.cash_received, r.filled_lots, r.fills))
    }
}

pub fn owner_place(ctx: Context<OwnerPlace>, outcome: u8, is_buy: bool, price_ticks: u16, lots: u64, expire_ts: i64) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let a = &ctx.accounts;
    let order = Order { outcome, is_buy, price_ticks, lots, expire_ts };
    let (cash_delta, lots_delta, fills) = execute(Route::Attended, &a.vault_config, &a.account, &engine_of!(a), order, now)?;
    let owner = a.owner.key();
    emit_cpi!(Executed { owner, market: a.market.key(), grant_id: ATTENDED, outcome, is_buy, cash_delta, lots_delta, actor: owner, at_sec: now, fills });
    Ok(())
}

pub fn actor_place_for(ctx: Context<ActorPlaceFor>, grant_id: u64, outcome: u8, is_buy: bool, price_ticks: u16, lots: u64, expire_ts: i64) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let a = &ctx.accounts;
    // 1. The grant, its actor and owner, and liveness.
    {
        let g = a.grant.load()?;
        require!(g.grant_id == grant_id, VaultError::NoSuchGrant);
        require_keys_eq!(g.actor, a.actor.key(), VaultError::NotGrantActor);
        require_keys_eq!(g.owner, a.owner.key(), VaultError::NotGrantOwner);
        require_live(&g, now)?;
    }
    let order = Order { outcome, is_buy, price_ticks, lots, expire_ts };
    let route = Route::Grant { grant: &a.grant, id: grant_id };
    let (cash_delta, lots_delta, fills) = execute(route, &a.vault_config, &a.account, &engine_of!(a), order, now)?;
    emit_cpi!(Executed { owner: a.owner.key(), market: a.market.key(), grant_id, outcome, is_buy, cash_delta, lots_delta, actor: a.actor.key(), at_sec: now, fills });
    Ok(())
}
