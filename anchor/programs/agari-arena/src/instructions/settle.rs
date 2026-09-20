//! Card settlement is deliberately independent of the pot. A match whose pot was forfeited or refunded still holds
//! two players' real positions, so `public_settle_card` keeps working in every status past the reveal: losing a pot
//! must never cost a player the market position they paid for.

use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::constants::{ARENA_SEED, CREDIT_SEED, CUSTODY_SEED, EVENTS_CONFIG, EVENTS_EVENT_AUTHORITY, MATCH_SEED, SEAT_SEED};
use crate::engine::{redeem, resolve, Engine};
use crate::errors::ArenaError;
use crate::events::{CardSettled, MatchFinalized};
use crate::instructions::exits::MatchAndCredits;
use crate::state::{Arena, Credit, GameMatch};

#[derive(Accounts)]
#[instruction(match_id: [u8; 32], card_index: u8)]
pub struct PublicSettleCard<'info> {
    #[account(mut)]
    pub caller: Signer<'info>,
    #[account(mut, seeds = [ARENA_SEED], bump = arena.bump)]
    pub arena: Box<Account<'info, Arena>>,
    #[account(mut, seeds = [MATCH_SEED, match_id.as_ref()], bump = game.bump)]
    pub game: Box<Account<'info, GameMatch>>,
    #[account(init_if_needed, payer = caller, space = 8 + Credit::INIT_SPACE, seeds = [CREDIT_SEED, game.creator.as_ref()], bump)]
    pub creator_credit: Box<Account<'info, Credit>>,
    #[account(init_if_needed, payer = caller, space = 8 + Credit::INIT_SPACE, seeds = [CREDIT_SEED, game.challenger.as_ref()], bump)]
    pub challenger_credit: Box<Account<'info, Credit>>,
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
    pub system_program: Program<'info, System>,
}

/// Redeems both seats' picks on one card through the engine and credits what the venue paid. Permissionless, and
/// idempotent by card: a second call is refused and never double-credits. Each seat's pick is its own partial redeem
/// out of the arena's pooled holdings, and its payout is custody's own delta around it.
pub fn public_settle_card(ctx: Context<PublicSettleCard>, match_id: [u8; 32], card_index: u8) -> Result<()> {
    ctx.accounts.arena.settle_guard(&ctx.accounts.game, card_index)?;
    let a = &ctx.accounts;
    let e = Engine {
        program: a.events_program.to_account_info(), config: a.events_config.to_account_info(), series: a.series.to_account_info(), market: a.market.to_account_info(),
        book: None, ledger: a.ledger.to_account_info(), mvault: a.mvault.to_account_info(), mint: a.collateral_mint.to_account_info(),
        token_program: a.token_program.to_account_info(), event_authority: a.events_event_authority.to_account_info(), seat: a.seat.to_account_info(), custody: a.custody.to_account_info(),
    };
    let w = resolve(&e, &a.arena.collateral_mint)?;
    require!(w.is_settled(), ArenaError::MarketNotSettled);
    let (seat_bump, market) = (a.arena.seat_bump, a.market.key());

    ctx.accounts.creator_credit.player = ctx.accounts.game.creator;
    ctx.accounts.creator_credit.bump = ctx.bumps.creator_credit;
    ctx.accounts.challenger_credit.player = ctx.accounts.game.challenger;
    ctx.accounts.challenger_credit.bump = ctx.bumps.challenger_credit;
    ctx.accounts.game.settled_mask |= 1u8 << card_index;

    for seat in 0..2usize {
        let rec = *ctx.accounts.game.pick(card_index, seat);
        if !rec.placed || rec.settled {
            continue;
        }
        let before = ctx.accounts.custody.amount;
        redeem(&e, seat_bump, w.seat_index, rec.outcome, rec.lots)?;
        ctx.accounts.custody.reload()?;
        let payout_base = ctx.accounts.custody.amount.saturating_sub(before);
        let a = &mut *ctx.accounts;
        let credit = if seat == 0 { &mut a.creator_credit } else { &mut a.challenger_credit };
        let pnl_base = a.arena.book_settle_pick(&mut a.game, card_index, seat, payout_base, credit)?;
        emit!(CardSettled { match_id, player: a.game.player(seat), market, card_index, payout_base, pnl_base });
    }
    Ok(())
}

/// Awards the pot once every played card is settled. Permissionless.
pub fn public_finalize(ctx: Context<MatchAndCredits>, match_id: [u8; 32]) -> Result<()> {
    ctx.accounts.claim_credits(&ctx.bumps);
    let a = &mut *ctx.accounts;
    let done = a.arena.book_finalize(&mut a.game, &mut a.creator_credit, &mut a.challenger_credit)?;
    emit!(MatchFinalized { match_id, winner: done.winner.unwrap_or_default(), creator_pnl_base: a.game.pnl_base[0], challenger_pnl_base: a.game.pnl_base[1], pot_awarded_base: done.pot_base });
    Ok(())
}
