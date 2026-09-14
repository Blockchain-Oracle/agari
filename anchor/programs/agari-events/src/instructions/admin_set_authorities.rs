//! `admin_set_authorities(args)` and `admin_set_mode(mode)` (events-instructions.md §1.2–1.3).

use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

use agari_common::seeds::CONFIG_SEED;

use super::args::SetAuthoritiesArgs;
use crate::errors::EventsError;
use crate::events::{AuthoritiesSet, ModeSet};
use crate::state::{GlobalConfig, Mode};

#[derive(Accounts)]
pub struct AdminSetAuthorities<'info> {
    pub admin: Signer<'info>,
    #[account(mut, seeds = [CONFIG_SEED], bump = config.load()?.bump)]
    pub config: AccountLoader<'info, GlobalConfig>,
    /// CHECK: a token account of the collateral mint, checked in the handler.
    pub treasury: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct AdminSetMode<'info> {
    pub admin: Signer<'info>,
    #[account(mut, seeds = [CONFIG_SEED], bump = config.load()?.bump)]
    pub config: AccountLoader<'info, GlobalConfig>,
}

/// Non-zero entries are unique.
fn unique_nonzero(keys: &[Pubkey]) -> bool {
    keys.iter().enumerate().all(|(i, k)| *k == Pubkey::default() || !keys[i + 1..].contains(k))
}

/// events-instructions.md §1.2 item 2.
pub fn authorities_valid(args: &SetAuthoritiesArgs) -> bool {
    let count = usize::from(args.redstone_signer_count);
    let signers_ok = count <= args.redstone_signers.len()
        && args.redstone_signers[..count].iter().enumerate().all(|(i, s)| *s != [0u8; 20] && !args.redstone_signers[i + 1..count].contains(s))
        && args.redstone_signers[count..].iter().all(|s| *s == [0u8; 20]);
    unique_nonzero(&args.rollers)
        && unique_nonzero(&args.attestors)
        && unique_nonzero(&args.program_authorities)
        && args.redstone_threshold >= 1
        && args.redstone_threshold <= args.redstone_signer_count
        && signers_ok
        && (args.switchboard_queue == Pubkey::default() || args.switchboard_min_oracles >= 1)
}

pub fn admin_set_authorities(ctx: Context<AdminSetAuthorities>, args: SetAuthoritiesArgs) -> Result<()> {
    let a = &ctx.accounts;
    let mut config = a.config.load_mut()?;
    require_keys_eq!(a.admin.key(), config.admin, EventsError::NotAdmin);
    require!(authorities_valid(&args), EventsError::BadAuthorities);
    require_keys_eq!(*a.treasury.owner, config.token_program, EventsError::WrongMint);
    let treasury = TokenAccount::try_deserialize(&mut &a.treasury.try_borrow_data()?[..]).map_err(|_| error!(EventsError::WrongMint))?;
    require_keys_eq!(treasury.mint, config.collateral_mint, EventsError::WrongMint);

    config.rollers = args.rollers;
    config.attestors = args.attestors;
    config.redstone_signers = args.redstone_signers;
    config.redstone_signer_count = args.redstone_signer_count;
    config.redstone_threshold = args.redstone_threshold;
    config.switchboard_queue = args.switchboard_queue;
    config.switchboard_min_oracles = args.switchboard_min_oracles;
    config.program_authorities = args.program_authorities;
    config.result_retention_sec = args.result_retention_sec;
    config.treasury = a.treasury.key();
    drop(config);

    emit!(AuthoritiesSet { config: a.config.key() });
    Ok(())
}

pub fn admin_set_mode(ctx: Context<AdminSetMode>, mode: u8) -> Result<()> {
    let mut config = ctx.accounts.config.load_mut()?;
    require_keys_eq!(ctx.accounts.admin.key(), config.admin, EventsError::NotAdmin);
    require!(Mode::try_from(mode).is_ok(), EventsError::InvalidMode);
    config.mode = mode;
    drop(config);
    emit!(ModeSet { mode });
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn args() -> SetAuthoritiesArgs {
        let k = |n: u8| Pubkey::new_from_array([n; 32]);
        SetAuthoritiesArgs {
            rollers: [k(1), Pubkey::default(), Pubkey::default(), Pubkey::default()],
            attestors: [Pubkey::default(); 4],
            redstone_signers: [[1; 20], [2; 20], [3; 20], [4; 20], [5; 20]],
            redstone_signer_count: 5,
            redstone_threshold: 3,
            switchboard_queue: Pubkey::default(),
            switchboard_min_oracles: 0,
            program_authorities: [k(9), Pubkey::default(), Pubkey::default(), k(10), Pubkey::default(), Pubkey::default(), Pubkey::default(), Pubkey::default()],
            result_retention_sec: 21_600,
        }
    }

    #[test]
    fn authority_rules() {
        assert!(authorities_valid(&args()));
        let mut a = args();
        a.rollers[1] = a.rollers[0];
        assert!(!authorities_valid(&a), "duplicate roller");
        let mut a = args();
        a.redstone_signers[4] = a.redstone_signers[0];
        assert!(!authorities_valid(&a), "duplicate signer");
        let mut a = args();
        a.redstone_signer_count = 4;
        assert!(!authorities_valid(&a), "entries past count must be zero");
        let mut a = args();
        a.redstone_threshold = 6;
        assert!(!authorities_valid(&a));
        let mut a = args();
        a.switchboard_queue = Pubkey::new_from_array([7; 32]);
        assert!(!authorities_valid(&a), "a queue needs min oracles");
    }
}
