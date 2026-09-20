use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use agari_common::view::load_checked;
use agari_events::state::GlobalConfig;

use crate::constants::{CUSTODY_SEED, EVENTS_CONFIG, MAX_OPEN, RESERVE_SEED, SEAT_SEED};
use crate::errors::LeverageError;
use crate::events::{ParamsUpdated, ReserveInitialized};
use crate::program::AgariLeverage;
use crate::state::{LeverageParams, LeverageReserve, OpenSlot};

#[derive(Accounts)]
pub struct AdminInitReserve<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(init, payer = admin, space = 8 + LeverageReserve::INIT_SPACE, seeds = [RESERVE_SEED], bump)]
    pub reserve: Box<Account<'info, LeverageReserve>>,
    /// CHECK: the reserve's engine seat. It signs every CPI, so custody is held in its name and nobody else's.
    #[account(seeds = [SEAT_SEED], bump)]
    pub seat: UncheckedAccount<'info>,
    /// Every unit the reserve holds. Its authority is the seat, because the engine moves it as the seat.
    #[account(init, payer = admin, seeds = [CUSTODY_SEED], bump, token::mint = collateral_mint, token::authority = seat)]
    pub custody: InterfaceAccount<'info, TokenAccount>,
    /// CHECK: the venue's config, at its own address; its collateral has to be this reserve's.
    #[account(address = EVENTS_CONFIG @ LeverageError::UnknownMarket)]
    pub events_config: UncheckedAccount<'info>,
    pub collateral_mint: InterfaceAccount<'info, Mint>,
    pub program: Program<'info, AgariLeverage>,
    /// CHECK: this program's ProgramData, matched against `program` below.
    pub program_data: UncheckedAccount<'info>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

fn upgrade_authority(program: &Program<AgariLeverage>, program_data: &UncheckedAccount) -> Option<Pubkey> {
    if program.programdata_address().ok()?? != program_data.key() || *program_data.owner != anchor_lang::solana_program::bpf_loader_upgradeable::ID {
        return None;
    }
    let data = program_data.try_borrow_data().ok()?;
    ProgramData::try_deserialize(&mut &data[..]).ok()?.upgrade_authority_address
}

/// Only the program's upgrade authority can initialise it. Without that, whoever saw the deploy first could make
/// themselves admin of the reserve with parameters of their choosing.
pub fn admin_init_reserve(ctx: Context<AdminInitReserve>, params: LeverageParams) -> Result<()> {
    let a = &ctx.accounts;
    require!(upgrade_authority(&a.program, &a.program_data) == Some(a.admin.key()), LeverageError::NotAdmin);
    params.validate()?;
    {
        let venue = load_checked::<GlobalConfig>(&a.events_config, &agari_events::ID)?;
        require_keys_eq!(a.collateral_mint.key(), venue.collateral_mint, LeverageError::WrongCollateral);
    }

    let (admin, mint, seat) = (a.admin.key(), a.collateral_mint.key(), a.seat.key());
    let reserve = &mut ctx.accounts.reserve;
    reserve.admin = admin;
    reserve.collateral_mint = mint;
    reserve.params = params;
    reserve.outstanding_base = 0;
    reserve.user_owed_base = 0;
    reserve.supply_shares = 0;
    // 1-based, as the reference counts them: 0 means "none", and is a free slot in the open table.
    reserve.next_position_id = 1;
    reserve.paused = false;
    reserve.bump = ctx.bumps.reserve;
    reserve.seat_bump = ctx.bumps.seat;
    reserve.custody_bump = ctx.bumps.custody;
    reserve.open = [OpenSlot::default(); MAX_OPEN];

    emit!(ReserveInitialized { reserve: reserve.key(), admin, collateral_mint: mint, seat });
    Ok(())
}

#[derive(Accounts)]
pub struct AdminSetParams<'info> {
    pub admin: Signer<'info>,
    #[account(mut, seeds = [RESERVE_SEED], bump = reserve.bump, has_one = admin @ LeverageError::NotAdmin)]
    pub reserve: Box<Account<'info, LeverageReserve>>,
}

/// Tunables only, and the pause. Open positions keep the terms they were opened on. The pause stops new positions
/// and new supply; every exit, settlement, claim and withdrawal stays open.
pub fn admin_set_params(ctx: Context<AdminSetParams>, params: LeverageParams, paused: bool) -> Result<()> {
    params.validate()?;
    let reserve = &mut ctx.accounts.reserve;
    reserve.params = params;
    reserve.paused = paused;
    emit!(ParamsUpdated { reserve: reserve.key(), paused });
    Ok(())
}
