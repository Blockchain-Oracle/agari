//! Trading helpers for the vault suites: place, place-for and crank sends that decode the vault's event and check the
//! vault.md §1 invariants after every step that lands.

use agari_vault::events::{Executed, Settled};
use agari_vault::state::PositionSlot;
use solana_keypair::Keypair;
use solana_signer::Signer;

use crate::harness::Sent;
use crate::trade::Window;
use crate::vault::{check_invariants, event, Owner, VaultWorld, ONE};
use crate::vault_ix::VaultOrder;

/// Masayume's `DEPOSIT`.
pub const DEPOSIT: u64 = 1_000 * ONE;

impl VaultWorld {
    /// `owner_place` signed and paid by the owner.
    pub fn place(&mut self, owner: &Owner, win: &Window, o: VaultOrder) -> Result<(Executed, Sent), u32> {
        let ix = self.w.h.vault_place_ix(&owner.pubkey(), win, o);
        let (sent, events) = self.w.h.vault_send(&[ix], &[&owner.key])?;
        check_invariants(self, win, &[owner]);
        Ok((event(&events).expect("Executed"), sent))
    }

    /// `actor_place_for` signed by the actor, paid by `payer` (the actor itself or a sponsor).
    pub fn place_for_paid(&mut self, payer: &Keypair, actor: &Keypair, owner: &Owner, grant_id: u64, win: &Window, o: VaultOrder) -> Result<(Executed, Sent), u32> {
        let ix = self.w.h.vault_place_for_ix(&actor.pubkey(), &owner.pubkey(), grant_id, win, o);
        let (sent, events) = self.w.h.send_v0(&[ix], payer, &[actor])?;
        check_invariants(self, win, &[owner]);
        Ok((event(&events).expect("Executed"), sent))
    }

    pub fn place_for(&mut self, actor: &Keypair, owner: &Owner, grant_id: u64, win: &Window, o: VaultOrder) -> Result<(Executed, Sent), u32> {
        self.place_for_paid(actor, actor, owner, grant_id, win, o)
    }

    /// `public_crank_settle` for `owner`, signed and paid by `cranker`.
    pub fn crank(&mut self, cranker: &Keypair, owner: &Owner, win: &Window, yes_grant: Option<u64>, no_grant: Option<u64>) -> Result<(Settled, Sent), u32> {
        let ix = self.w.h.vault_crank_ix(&cranker.pubkey(), &owner.pubkey(), win, yes_grant, no_grant);
        let (sent, events) = self.w.h.vault_send(&[ix], &[cranker])?;
        check_invariants(self, win, &[owner]);
        Ok((event(&events).expect("Settled"), sent))
    }

    /// The owner's slot for `win` (a zeroed slot when none).
    pub fn slot(&self, owner: &Owner, win: &Window) -> PositionSlot {
        self.account(&owner.pubkey()).positions.iter().copied().find(|s| s.market == win.market).unwrap_or_default()
    }
}

/// The error code of a refused send (events carry no `Debug`, so `unwrap_err` can't be used on them).
pub trait Refused {
    fn refused(self) -> u32;
}

impl<T> Refused for Result<T, u32> {
    fn refused(self) -> u32 {
        match self {
            Ok(_) => panic!("expected a refusal, but the transaction landed"),
            Err(code) => code,
        }
    }
}

/// Prints one measured row for vault.md §9.
pub fn report(label: &str, sent: Sent) {
    println!("{label}: {} CU / {} B (v0)", sent.compute_units, sent.tx_bytes);
}
