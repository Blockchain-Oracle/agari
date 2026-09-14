//! `Book`: a keypair account recycled per Series (events-accounts.md §3.9). Created top-level with System
//! `createAccount` and bound with `#[account(zero)]` (PDAs can't be created above 10,240 B). Fixed 32,384 B,
//! then `capacity` × 48 B order nodes. Node refs are 1-based (0 = nil), so a zeroed Book is a valid empty book.

use anchor_lang::{prelude::*, Discriminator};

use crate::constants::{BOOK_FIXED_LEN, NIL_REF, ORDER_NODE_LEN, PRICE_LEVELS};

/// One price level: FIFO list of node refs (oldest → newest) and the lots resting there. 16 B.
#[zero_copy]
#[derive(Debug, Default, PartialEq, Eq)]
pub struct Level {
    pub head: u32,
    pub tail: u32,
    pub live_lots: u64,
}

/// 32,384 B fixed part.
#[account(zero_copy)]
pub struct Book {
    /// `Pubkey::default()` = free.
    pub market: Pubkey,
    pub series: Pubkey,
    /// Never reset, so `(node, seq)` handles stay ABA-safe across recycling.
    pub next_seq: u64,
    pub generation: u32,
    pub capacity: u32,
    pub order_count: u32,
    pub free_head: u32,
    /// Nodes `≥ high_water` have never been used.
    pub high_water: u32,
    pub _pad0: u32,
    /// Bit `p` set iff bid level `p` is non-empty.
    pub bid_bits: [u64; 16],
    pub ask_bits: [u64; 16],
    pub _reserved: [u8; 32],
    /// Indexed by price ticks; index 0 unused.
    pub bids: [Level; PRICE_LEVELS],
    pub asks: [Level; PRICE_LEVELS],
}

/// A resting order. 48 B.
#[zero_copy]
#[derive(Debug, Default, PartialEq, Eq)]
pub struct OrderNode {
    /// Remaining lots.
    pub lots: u64,
    pub seq: u64,
    pub expire_ts: i64,
    /// Slot the order rested at, for the rested-age filter (PD-2).
    pub placed_slot: u64,
    pub prev: u32,
    pub next: u32,
    pub price: u16,
    pub seat: u16,
    pub kind: u8,
    pub flags: u8,
    pub _pad0: [u8; 2],
}

/// Account bytes for a Book of `capacity` nodes (discriminator included).
pub const fn book_space(capacity: usize) -> usize {
    Book::DISCRIMINATOR.len() + BOOK_FIXED_LEN + ORDER_NODE_LEN * capacity
}

/// 0-based node index → 1-based ref.
pub fn node_ref(index: usize) -> Option<u32> {
    u32::try_from(index).ok()?.checked_add(1)
}

/// 1-based ref → 0-based node index; `None` for nil.
pub fn node_index(r: u32) -> Option<usize> {
    if r == NIL_REF {
        None
    } else {
        usize::try_from(r - 1).ok()
    }
}

/// Bitmap helpers over `[u64; 16]` indexed by price ticks (0..1000).
pub fn bit_is_set(bits: &[u64; 16], price: u16) -> bool {
    let p = usize::from(price);
    p < PRICE_LEVELS && bits[p / 64] & (1u64 << (p % 64)) != 0
}

pub fn bit_set(bits: &mut [u64; 16], price: u16, on: bool) {
    let p = usize::from(price);
    if p >= PRICE_LEVELS {
        return;
    }
    if on {
        bits[p / 64] |= 1u64 << (p % 64);
    } else {
        bits[p / 64] &= !(1u64 << (p % 64));
    }
}

/// Fixed part and nodes of a Book's account data, checked for discriminator, exact length and alignment.
pub fn book_parts_mut(data: &mut [u8]) -> Result<(&mut Book, &mut [OrderNode])> {
    let disc_len = Book::DISCRIMINATOR.len();
    if data.len() < disc_len + BOOK_FIXED_LEN || &data[..disc_len] != Book::DISCRIMINATOR {
        return Err(ErrorCode::AccountDiscriminatorMismatch.into());
    }
    let (fixed, nodes) = data[disc_len..].split_at_mut(BOOK_FIXED_LEN);
    let book: &mut Book = bytemuck::try_from_bytes_mut(fixed).map_err(|_| ErrorCode::AccountDidNotDeserialize)?;
    let wanted = usize::try_from(book.capacity).map_err(|_| ErrorCode::AccountDidNotDeserialize)? * ORDER_NODE_LEN;
    if nodes.len() != wanted {
        return Err(ErrorCode::AccountDidNotDeserialize.into());
    }
    let nodes: &mut [OrderNode] = bytemuck::try_cast_slice_mut(nodes).map_err(|_| ErrorCode::AccountDidNotDeserialize)?;
    Ok((book, nodes))
}
