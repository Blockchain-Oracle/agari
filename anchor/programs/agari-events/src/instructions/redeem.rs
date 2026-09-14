//! `user_redeem(seat_idx, outcome, lots)` and `public_redeem_for(seat_idx)` (events-instructions.md §5.3–5.4;
//! events-engine.md §8.4). Both read `series` for the cash unit (D-022). Payouts leave the mvault signed by the
//! Market PDA and reach only the redeeming authority's own token account, or the seat owner's associated token
//! account when a crank redeems for them (AD-5).

use anchor_lang::prelude::*;
use anchor_spl::associated_token::get_associated_token_address_with_program_id;
use anchor_spl::token::{Mint, Token, TokenAccount};

use agari_common::seeds::CONFIG_SEED;

use super::venue_io::{bind_market, bind_tokens, next_seq, MarketSigner, TokenMove};
use crate::errors::EventsError;
use crate::events::Redeemed;
use crate::matching::redeem::{redeem, Redemption};
use crate::matching::seats::owned_seat;
use crate::state::{ledger_parts_mut, GlobalConfig, Ledger, Market, Series};

#[event_cpi]
#[derive(Accounts)]
pub struct UserRedeem<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.load()?.bump)]
    pub config: AccountLoader<'info, GlobalConfig>,
    pub series: AccountLoader<'info, Series>,
    #[account(mut)]
    pub market: AccountLoader<'info, Market>,
    #[account(mut)]
    pub ledger: AccountLoader<'info, Ledger>,
    #[account(mut)]
    pub mvault: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub authority_token: Box<Account<'info, TokenAccount>>,
    pub collateral_mint: Box<Account<'info, Mint>>,
    pub token_program: Program<'info, Token>,
}

pub fn user_redeem(ctx: Context<UserRedeem>, seat_idx: u16, outcome: Option<u8>, lots: Option<u64>) -> Result<()> {
    let a = &ctx.accounts;
    let authority = a.authority.key();
    let market_key = a.market.key();
    let cash_unit = a.series.load()?.cash_unit;
    let mut market = a.market.load_mut()?;
    let ledger_info = a.ledger.to_account_info();
    let mut ledger_data = ledger_info.try_borrow_mut_data()?;
    let (ledger, seats) = ledger_parts_mut(&mut ledger_data)?;
    // 1. B; SI.
    bind_market(&market_key, &market, Some(&a.series.key()), None, Some((&a.ledger.key(), ledger)), Some(&a.mvault.key()))?;
    bind_tokens(&*a.config.load()?, &a.collateral_mint.key(), &a.token_program.key(), &a.authority_token, &authority)?;
    let si = owned_seat(ledger, seats, &authority, seat_idx)?;
    // 2–4. Terminal, no open orders, argument shape; then the effects on the seat.
    let bond = ledger.seat_bond;
    let r = redeem(&mut seats[si], &market, cash_unit, bond, outcome, lots)?;
    let seq = next_seq(&mut market)?;
    let signer = MarketSigner::of(&market);
    drop(market);
    drop(ledger_data);

    let (program, mint, mvault, token) = (a.token_program.to_account_info(), a.collateral_mint.to_account_info(), a.mvault.to_account_info(), a.authority_token.to_account_info());
    let io = TokenMove { token_program: &program, mint: &mint, mvault: &mvault, authority_token: &token, decimals: a.collateral_mint.decimals };
    io.pay(&a.market.to_account_info(), &signer.series, signer.index, signer.bump, r.total)?;
    emit_cpi!(redeemed(market_key, seq, seat_idx, &r, false));
    Ok(())
}

#[event_cpi]
#[derive(Accounts)]
pub struct PublicRedeemFor<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.load()?.bump)]
    pub config: AccountLoader<'info, GlobalConfig>,
    pub series: AccountLoader<'info, Series>,
    #[account(mut)]
    pub market: AccountLoader<'info, Market>,
    #[account(mut)]
    pub ledger: AccountLoader<'info, Ledger>,
    #[account(mut)]
    pub mvault: Box<Account<'info, TokenAccount>>,
    /// CHECK: only compared with the seat's owner and used to derive the payout's associated token account.
    pub owner: UncheckedAccount<'info>,
    #[account(mut)]
    pub owner_ata: Box<Account<'info, TokenAccount>>,
    pub collateral_mint: Box<Account<'info, Mint>>,
    pub token_program: Program<'info, Token>,
}

pub fn public_redeem_for(ctx: Context<PublicRedeemFor>, seat_idx: u16) -> Result<()> {
    let a = &ctx.accounts;
    let owner = a.owner.key();
    let market_key = a.market.key();
    let cash_unit = a.series.load()?.cash_unit;
    let mut market = a.market.load_mut()?;
    let ledger_info = a.ledger.to_account_info();
    let mut ledger_data = ledger_info.try_borrow_mut_data()?;
    let (ledger, seats) = ledger_parts_mut(&mut ledger_data)?;
    // 1. B (the owner does not sign, so the token checks are spelled out rather than `bind_tokens`).
    bind_market(&market_key, &market, Some(&a.series.key()), None, Some((&a.ledger.key(), ledger)), Some(&a.mvault.key()))?;
    {
        let config = a.config.load()?;
        require_keys_eq!(a.collateral_mint.key(), config.collateral_mint, EventsError::WrongMint);
        require_keys_eq!(a.token_program.key(), config.token_program, EventsError::WrongTokenProgram);
        require_keys_eq!(a.owner_ata.mint, config.collateral_mint, EventsError::WrongMint);
    }
    // 2. The seat is the owner's (never the empty key).
    require!(owner != Pubkey::default(), EventsError::SeatMismatch);
    let si = owned_seat(ledger, seats, &owner, seat_idx)?;
    // 3. PROGRAM seats redeem through their product, never a crank.
    require!(!seats[si].is_program(), EventsError::ProgramSeatNotPublic);
    // 4. Only the owner's associated token account of the collateral.
    let ata = get_associated_token_address_with_program_id(&owner, &a.collateral_mint.key(), &a.token_program.key());
    require!(a.owner_ata.key() == ata && a.owner_ata.owner == owner, EventsError::WrongTokenOwner);
    // 5. Terminal, no open orders; a full redeem (zero-amount seats still clear).
    let bond = ledger.seat_bond;
    let r = redeem(&mut seats[si], &market, cash_unit, bond, None, None)?;
    let seq = next_seq(&mut market)?;
    let signer = MarketSigner::of(&market);
    drop(market);
    drop(ledger_data);

    let (program, mint, mvault, token) = (a.token_program.to_account_info(), a.collateral_mint.to_account_info(), a.mvault.to_account_info(), a.owner_ata.to_account_info());
    let io = TokenMove { token_program: &program, mint: &mint, mvault: &mvault, authority_token: &token, decimals: a.collateral_mint.decimals };
    io.pay(&a.market.to_account_info(), &signer.series, signer.index, signer.bump, r.total)?;
    emit_cpi!(redeemed(market_key, seq, seat_idx, &r, true));
    Ok(())
}

fn redeemed(market: Pubkey, seq: u64, seat: u16, r: &Redemption, by_crank: bool) -> Redeemed {
    Redeemed {
        market,
        seq,
        owner: r.owner,
        seat,
        yes_lots: r.yes_lots,
        no_lots: r.no_lots,
        payout: r.payout,
        credit: r.credit,
        bond: r.bond,
        total: r.total,
        partial: r.partial,
        by_crank,
    }
}
