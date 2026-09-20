//! One card, one side, one IOC. `stake_base` is the most this card may spend; the arena walks the live book for what
//! it buys, places the order and sends the unspent part straight back where the stake came from. Zero fill is refused,
//! so a card is never recorded as played without a position behind it.

use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use agari_common::stake_walk::{walk_budget, walk_quantity};

use crate::constants::{AGENT_SEED, ARENA_SEED, CUSTODY_SEED, EVENTS_CONFIG, EVENTS_EVENT_AUTHORITY, IOC_LIFE_SEC, MATCH_SEED, SEAT_SEED};
use crate::engine::{ioc_buy_args, place, read_entry_levels, resolve, yes_ticks, Engine};
use crate::errors::ArenaError;
use crate::events::{PickFilled, PicksLocked};
use crate::instructions::entry::collect;
use crate::instructions::payout::Payer;
use crate::state::{Agent, Arena, GameMatch, MatchStatus};

#[derive(Accounts)]
#[instruction(match_id: [u8; 32], card_index: u8)]
pub struct PlayerPlacePick<'info> {
    pub player: Signer<'info>,
    #[account(mut, seeds = [ARENA_SEED], bump = arena.bump)]
    pub arena: Box<Account<'info, Arena>>,
    #[account(mut, seeds = [MATCH_SEED, match_id.as_ref()], bump = game.bump)]
    pub game: Box<Account<'info, GameMatch>>,
    #[account(mut, seeds = [CUSTODY_SEED], bump = arena.custody_bump)]
    pub custody: Box<InterfaceAccount<'info, TokenAccount>>,
    /// CHECK: the arena's engine seat.
    #[account(seeds = [SEAT_SEED], bump = arena.seat_bump)]
    pub seat: UncheckedAccount<'info>,
    #[account(mut, token::mint = collateral_mint, token::authority = player)]
    pub player_token: Box<InterfaceAccount<'info, TokenAccount>>,
    /// CHECK: agari-events itself.
    #[account(address = agari_events::ID @ ArenaError::UnknownMarket)]
    pub events_program: UncheckedAccount<'info>,
    /// CHECK: the venue's config, at its own address.
    #[account(address = EVENTS_CONFIG @ ArenaError::UnknownMarket)]
    pub events_config: UncheckedAccount<'info>,
    /// CHECK: bound to the market by `resolve`.
    pub series: UncheckedAccount<'info>,
    /// CHECK: the card's own Window.
    #[account(mut, address = game.cards[usize::from(card_index.min(7))] @ ArenaError::BadCard)]
    pub market: UncheckedAccount<'info>,
    /// CHECK: bound to the market both ways.
    #[account(mut)]
    pub book: UncheckedAccount<'info>,
    /// CHECK: bound to the market both ways.
    #[account(mut)]
    pub ledger: UncheckedAccount<'info>,
    /// CHECK: must be `market.mvault`.
    #[account(mut)]
    pub mvault: UncheckedAccount<'info>,
    #[account(address = arena.collateral_mint @ ArenaError::WrongCollateral)]
    pub collateral_mint: Box<InterfaceAccount<'info, Mint>>,
    pub token_program: Interface<'info, TokenInterface>,
    /// CHECK: agari-events' event authority.
    #[account(address = EVENTS_EVENT_AUTHORITY @ ArenaError::UnknownMarket)]
    pub events_event_authority: UncheckedAccount<'info>,
}

#[derive(Accounts)]
#[instruction(match_id: [u8; 32], card_index: u8)]
pub struct AgentPlacePick<'info> {
    /// The seat's key. It only signs: the stake and the refund are the player's.
    pub agent: Signer<'info>,
    /// CHECK: the seat's player, whose escrow pays and whose record this is.
    pub player: UncheckedAccount<'info>,
    #[account(mut, seeds = [AGENT_SEED, match_id.as_ref(), player.key().as_ref()], bump = agent_account.bump)]
    pub agent_account: Box<Account<'info, Agent>>,
    #[account(mut, seeds = [ARENA_SEED], bump = arena.bump)]
    pub arena: Box<Account<'info, Arena>>,
    #[account(mut, seeds = [MATCH_SEED, match_id.as_ref()], bump = game.bump)]
    pub game: Box<Account<'info, GameMatch>>,
    #[account(mut, seeds = [CUSTODY_SEED], bump = arena.custody_bump)]
    pub custody: Box<InterfaceAccount<'info, TokenAccount>>,
    /// CHECK: the arena's engine seat.
    #[account(seeds = [SEAT_SEED], bump = arena.seat_bump)]
    pub seat: UncheckedAccount<'info>,
    /// CHECK: agari-events itself.
    #[account(address = agari_events::ID @ ArenaError::UnknownMarket)]
    pub events_program: UncheckedAccount<'info>,
    /// CHECK: the venue's config, at its own address.
    #[account(address = EVENTS_CONFIG @ ArenaError::UnknownMarket)]
    pub events_config: UncheckedAccount<'info>,
    /// CHECK: bound to the market by `resolve`.
    pub series: UncheckedAccount<'info>,
    /// CHECK: the card's own Window.
    #[account(mut, address = game.cards[usize::from(card_index.min(7))] @ ArenaError::BadCard)]
    pub market: UncheckedAccount<'info>,
    /// CHECK: bound to the market both ways.
    #[account(mut)]
    pub book: UncheckedAccount<'info>,
    /// CHECK: bound to the market both ways.
    #[account(mut)]
    pub ledger: UncheckedAccount<'info>,
    /// CHECK: must be `market.mvault`.
    #[account(mut)]
    pub mvault: UncheckedAccount<'info>,
    #[account(address = arena.collateral_mint @ ArenaError::WrongCollateral)]
    pub collateral_mint: Box<InterfaceAccount<'info, Mint>>,
    pub token_program: Interface<'info, TokenInterface>,
    /// CHECK: agari-events' event authority.
    #[account(address = EVENTS_EVENT_AUTHORITY @ ArenaError::UnknownMarket)]
    pub events_event_authority: UncheckedAccount<'info>,
}

pub struct Fill {
    pub lots: u64,
    pub lot_base: u64,
    pub cost_base: u64,
}

/// Sizes the stake off the live book, buys it as the arena's seat, and checks the engine's report against the money.
/// By the time this runs the stake is already in custody, whichever way it arrived.
#[allow(clippy::too_many_arguments)]
fn buy<'info>(e: &Engine<'info>, arena: &Arena, custody: &mut InterfaceAccount<'info, TokenAccount>, match_id: &[u8; 32], outcome: u8, stake_base: u64, min_lots: u64) -> Result<Fill> {
    let clock = Clock::get()?;
    let (now, slot) = (clock.unix_timestamp, clock.slot);
    require!(outcome <= 1, ArenaError::BadOutcome);
    let w = resolve(e, &arena.collateral_mint)?;
    require!(w.is_trading(now), ArenaError::WindowNotTrading);

    let (one, invert, lot_base) = (w.one(), outcome == 1, u128::from(w.lot_base));
    let entry = read_entry_levels(e, &w, outcome, now, slot)?;
    let quantity_raw = walk_budget(&entry, invert, one, u128::from(stake_base), lot_base);
    let least_lots = w.min_lots.max(min_lots).max(1);
    require!(quantity_raw >= u128::from(least_lots) * lot_base, ArenaError::BelowMinQuantity);
    let walk = walk_quantity(&entry, invert, one, quantity_raw);

    let lots = u64::try_from(quantity_raw / lot_base).map_err(|_| ArenaError::MathOverflow)?;
    let expire_ts = w.lock_at.min(now.saturating_add(IOC_LIFE_SEC));
    let before = custody.amount;
    // The match id's first eight bytes ride along as the order's client id: a label for the logs.
    let client_id = u64::from_le_bytes(match_id[..8].try_into().map_err(|_| ArenaError::MathOverflow)?);
    let filled = place(e, arena.seat_bump, ioc_buy_args(&w, outcome, yes_ticks(walk.limit_yes_raw, &w)?, lots, expire_ts, client_id))?;
    require!(filled.filled_lots > 0, ArenaError::NothingFilled);
    require!(filled.filled_lots >= least_lots, ArenaError::BelowMinQuantity);
    let cost_base = filled.cash_spent;
    custody.reload()?;
    require!(filled.transferred_in == cost_base && filled.withdrawn == 0 && before.checked_sub(custody.amount) == Some(cost_base), ArenaError::EngineAccountingMismatch);
    Ok(Fill { lots: filled.filled_lots, lot_base: w.lot_base, cost_base })
}

fn announce(m: &GameMatch, match_id: [u8; 32], player: Pubkey, card_index: u8, outcome: u8, fill: &Fill, refund_base: u64, locked: bool) {
    emit!(PickFilled { match_id, player, market: m.cards[usize::from(card_index)], card_index, outcome, quantity_raw: fill.lots.saturating_mul(fill.lot_base), cost_base: fill.cost_base, refund_base });
    if locked {
        emit!(PicksLocked { match_id, status: MatchStatus::Settling, forfeited_by: Pubkey::default() });
    }
}

/// The player's own pick: the stake comes out of their wallet and the unspent part goes straight back to it.
pub fn player_place_pick(ctx: Context<PlayerPlacePick>, match_id: [u8; 32], card_index: u8, outcome: u8, stake_base: u64, min_lots: u64) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let a = &mut *ctx.accounts;
    let player = a.player.key();
    let seat = a.arena.pick_guard(&a.game, &player, card_index, stake_base, now)?;
    collect(&a.player_token, &a.custody, &a.collateral_mint, &a.player, &a.token_program, stake_base)?;
    a.custody.reload()?;
    let e = Engine {
        program: a.events_program.to_account_info(), config: a.events_config.to_account_info(), series: a.series.to_account_info(), market: a.market.to_account_info(),
        book: Some(a.book.to_account_info()), ledger: a.ledger.to_account_info(), mvault: a.mvault.to_account_info(), mint: a.collateral_mint.to_account_info(),
        token_program: a.token_program.to_account_info(), event_authority: a.events_event_authority.to_account_info(), seat: a.seat.to_account_info(), custody: a.custody.to_account_info(),
    };
    let fill = buy(&e, &a.arena, &mut a.custody, &match_id, outcome, stake_base, min_lots)?;
    let locked = a.arena.book_pick(&mut a.game, seat, card_index, outcome, fill.lots, fill.lot_base, fill.cost_base, stake_base)?;
    let refund_base = stake_base - fill.cost_base;
    let payer = Payer { custody: &a.custody, seat: &a.seat.to_account_info(), mint: &a.collateral_mint, token_program: &a.token_program.to_account_info(), seat_bump: a.arena.seat_bump };
    payer.pay(&a.player_token.to_account_info(), refund_base)?;
    announce(&a.game, match_id, player, card_index, outcome, &fill, refund_base, locked);
    Ok(())
}

/// The same pick, placed by the seat's key. The stake comes out of what the player set aside for it, the unspent part
/// goes back beside the rest, and `PickFilled` names the player: the key only signs.
pub fn agent_place_pick(ctx: Context<AgentPlacePick>, match_id: [u8; 32], card_index: u8, outcome: u8, stake_base: u64, min_lots: u64) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let a = &mut *ctx.accounts;
    let (player, signer) = (a.player.key(), a.agent.key());
    let seat = a.arena.pick_guard(&a.game, &player, card_index, stake_base, now)?;
    a.arena.book_agent_stake(&mut a.agent_account, &signer, stake_base, now)?;
    let e = Engine {
        program: a.events_program.to_account_info(), config: a.events_config.to_account_info(), series: a.series.to_account_info(), market: a.market.to_account_info(),
        book: Some(a.book.to_account_info()), ledger: a.ledger.to_account_info(), mvault: a.mvault.to_account_info(), mint: a.collateral_mint.to_account_info(),
        token_program: a.token_program.to_account_info(), event_authority: a.events_event_authority.to_account_info(), seat: a.seat.to_account_info(), custody: a.custody.to_account_info(),
    };
    let fill = buy(&e, &a.arena, &mut a.custody, &match_id, outcome, stake_base, min_lots)?;
    let locked = a.arena.book_pick(&mut a.game, seat, card_index, outcome, fill.lots, fill.lot_base, fill.cost_base, stake_base)?;
    let refund_base = stake_base - fill.cost_base;
    a.arena.book_agent_refund(&mut a.agent_account, refund_base)?;
    announce(&a.game, match_id, player, card_index, outcome, &fill, refund_base, locked);
    Ok(())
}
