//! `load_checked` (events-accounts.md §6): products read engine accounts as `UncheckedAccount` by cast, never
//! by deserializing. Checks run in order: owner, length, discriminator, alignment. The market↔book↔ledger
//! bindings are pure key comparisons so this crate needs no engine types.

use anchor_lang::{error::ErrorCode, prelude::*, Discriminator};
use core::cell::Ref;
use core::mem::size_of;

/// The zero-copy header `T` of an engine account (discriminator, then `T`).
pub fn load_checked<'a, T: bytemuck::Pod + Discriminator>(account: &'a AccountInfo, engine: &Pubkey) -> Result<Ref<'a, T>> {
    if account.owner != engine {
        return Err(ErrorCode::AccountOwnedByWrongProgram.into());
    }
    let data = account.try_borrow_data()?;
    let disc = T::DISCRIMINATOR;
    let end = disc.len().checked_add(size_of::<T>()).ok_or(ErrorCode::AccountDidNotDeserialize)?;
    if data.len() < end {
        return Err(ErrorCode::AccountDidNotDeserialize.into());
    }
    if &data[..disc.len()] != disc {
        return Err(ErrorCode::AccountDiscriminatorMismatch.into());
    }
    if bytemuck::try_from_bytes::<T>(&data[disc.len()..end]).is_err() {
        return Err(ErrorCode::AccountDidNotDeserialize.into());
    }
    Ok(Ref::map(data, |d| bytemuck::from_bytes::<T>(&d[disc.len()..end])))
}

/// The trailing slice of an engine account (Book nodes, Ledger seats): `count` items of `U` starting
/// `offset` bytes into the data. Call only after `load_checked` has validated the header.
pub fn load_slice_checked<'a, U: bytemuck::Pod>(account: &'a AccountInfo, offset: usize, count: usize) -> Result<Ref<'a, [U]>> {
    let data = account.try_borrow_data()?;
    let len = count.checked_mul(size_of::<U>()).ok_or(ErrorCode::AccountDidNotDeserialize)?;
    let end = offset.checked_add(len).ok_or(ErrorCode::AccountDidNotDeserialize)?;
    if data.len() < end || bytemuck::try_cast_slice::<u8, U>(&data[offset..end]).is_err() {
        return Err(ErrorCode::AccountDidNotDeserialize.into());
    }
    Ok(Ref::map(data, |d| bytemuck::cast_slice::<u8, U>(&d[offset..end])))
}

/// Two accounts that must point at each other (Book ⇄ Market, Ledger ⇄ Market).
pub fn bound_both_ways(a_key: &Pubkey, a_points_to: &Pubkey, b_key: &Pubkey, b_points_to: &Pubkey) -> bool {
    a_points_to == b_key && b_points_to == a_key
}

/// A `MarketResult` is only trusted at its canonical PDA, so a look-alike account can't stand in for it.
pub fn is_result_of(engine: &Pubkey, market: &Pubkey, result: &Pubkey) -> bool {
    crate::seeds::result_address(engine, market).0 == *result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bindings_require_both_directions() {
        let (m, b) = (Pubkey::new_from_array([1; 32]), Pubkey::new_from_array([2; 32]));
        assert!(bound_both_ways(&m, &b, &b, &m));
        assert!(!bound_both_ways(&m, &b, &b, &Pubkey::default()));
        let engine = Pubkey::new_from_array([3; 32]);
        assert!(is_result_of(&engine, &m, &crate::seeds::result_address(&engine, &m).0));
        assert!(!is_result_of(&engine, &m, &b));
    }
}
