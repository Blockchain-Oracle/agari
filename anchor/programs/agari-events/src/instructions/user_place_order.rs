//! `user_place_order(args)` (events-instructions.md §3.1). Checks run in the listed order; the matching and ledger
//! work is `matching::place`. Funding is exact and pulled after matching; `withdraw_proceeds` pays the whole seat
//! credit out; `set_return_data(PlaceResult)` is the last action, after the event and every token CPI.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::set_return_data;
use anchor_spl::token::{Mint, Token, TokenAccount};

use agari_common::seeds::CONFIG_SEED;

use super::args::PlaceOrderArgs;
use super::venue_io::{bind_market, bind_tokens, next_seq, MarketSigner, SeriesView, TokenMove};
use crate::events::{OrderExecuted, OrderHandle};
use crate::matching::place::{check_mode, check_order, place, SeriesRules};
use crate::matching::Venue;
use crate::state::{book_parts_mut, ledger_parts_mut, Book, GlobalConfig, Ledger, Market, Series};

#[event_cpi]
#[derive(Accounts)]
pub struct UserPlaceOrder<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.load()?.bump)]
    pub config: AccountLoader<'info, GlobalConfig>,
    pub series: AccountLoader<'info, Series>,
    #[account(mut)]
    pub market: AccountLoader<'info, Market>,
    #[account(mut)]
    pub book: AccountLoader<'info, Book>,
    #[account(mut)]
    pub ledger: AccountLoader<'info, Ledger>,
    #[account(mut)]
    pub mvault: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub authority_token: Box<Account<'info, TokenAccount>>,
    pub collateral_mint: Box<Account<'info, Mint>>,
    pub token_program: Program<'info, Token>,
}

pub fn user_place_order(ctx: Context<UserPlaceOrder>, args: PlaceOrderArgs) -> Result<()> {
    let clock = Clock::get()?;
    let a = &ctx.accounts;
    let authority = a.authority.key();
    let market_key = a.market.key();

    // 1. Mode.
    let config = a.config.load()?;
    check_mode(config.mode, args.kind)?;

    // 2. Bindings.
    let series = SeriesView::of(&*a.series.load()?);
    let mut market = a.market.load_mut()?;
    let book_info = a.book.to_account_info();
    let mut book_data = book_info.try_borrow_mut_data()?;
    let (book, nodes) = book_parts_mut(&mut book_data)?;
    let ledger_info = a.ledger.to_account_info();
    let mut ledger_data = ledger_info.try_borrow_mut_data()?;
    let (ledger, seats) = ledger_parts_mut(&mut ledger_data)?;
    bind_market(&market_key, &market, Some(&a.series.key()), Some((&a.book.key(), book)), Some((&a.ledger.key(), ledger)), Some(&a.mvault.key()))?;
    bind_tokens(&config, &a.collateral_mint.key(), &a.token_program.key(), &a.authority_token, &authority)?;
    drop(config);

    // 3–7. Status, arguments, price, size, expiry.
    let rules = SeriesRules { min_lots: series.min_lots, fills_cap: series.fills_cap, evictions_cap: series.evictions_cap };
    let order = check_order(&market, clock.unix_timestamp, &args, rules)?;

    // 8–13. Seat, sell balance, PostOnly walk or match, remainder, funding, proceeds.
    let placement = {
        let mut venue = Venue { book, nodes, ledger, seats, market: &mut market, cu: series.cash_unit, now: clock.unix_timestamp, slot: clock.slot };
        place(&mut venue, &authority, &order)?
    };
    let backing_lots = market.backing_lots;
    let seq = next_seq(&mut market)?;
    let signer = MarketSigner::of(&market);
    drop(market);
    drop(book_data);
    drop(ledger_data);

    let r = placement.result;
    let token_program = a.token_program.to_account_info();
    let mint = a.collateral_mint.to_account_info();
    let mvault = a.mvault.to_account_info();
    let authority_token = a.authority_token.to_account_info();
    let io = TokenMove { token_program: &token_program, mint: &mint, mvault: &mvault, authority_token: &authority_token, decimals: a.collateral_mint.decimals };
    io.pull(&a.authority.to_account_info(), r.transferred_in)?;
    io.pay(&a.market.to_account_info(), &signer.series, signer.index, signer.bump, r.withdrawn)?;

    emit_cpi!(OrderExecuted {
        market: market_key,
        seq,
        taker: authority,
        taker_seat: r.seat,
        kind: args.kind,
        order_type: args.order_type,
        self_match: args.self_match,
        limit_price: args.price_ticks,
        lots: args.lots,
        expire_ts: args.expire_ts,
        client_id: args.client_id,
        filled_lots: r.filled_lots,
        cash_spent: r.cash_spent,
        cash_received: r.cash_received,
        credit_used: r.credit_used,
        transferred_in: r.transferred_in,
        withdrawn: r.withdrawn,
        rested: OrderHandle { node: r.rested.node, seq: r.rested.seq },
        rested_lots: r.rested_lots,
        cancelled_lots: r.cancelled_lots,
        stop_reason: r.stop_reason,
        backing_lots,
        fills: placement.fills,
        removed: placement.removed,
        ts: clock.unix_timestamp,
        slot: clock.slot,
    });
    set_return_data(&anchor_lang::prelude::borsh::to_vec(&r)?);
    Ok(())
}
