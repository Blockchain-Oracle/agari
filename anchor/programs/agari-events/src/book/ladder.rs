//! Price levels and their bitmaps (events-accounts.md §3.9). Each level is a FIFO doubly linked list of node
//! refs (oldest → newest); a level's bitmap bit is set iff it holds at least one node.

use super::slab::{node_at, node_at_mut};
use crate::constants::{NIL_REF, PRICE_LEVELS};
use crate::errors::EventsError;
use crate::state::{bit_set, Book, Level, OrderNode};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum BookSide {
    Bid,
    Ask,
}

pub fn side_parts(book: &mut Book, side: BookSide) -> (&mut [u64; 16], &mut [Level; PRICE_LEVELS]) {
    match side {
        BookSide::Bid => (&mut book.bid_bits, &mut book.bids),
        BookSide::Ask => (&mut book.ask_bits, &mut book.asks),
    }
}

fn level_mut(levels: &mut [Level; PRICE_LEVELS], price: u16) -> Result<&mut Level, EventsError> {
    levels.get_mut(usize::from(price)).ok_or(EventsError::InvalidPrice)
}

/// Lowest non-empty price `≥ at` (asks walk up from the best ask).
pub fn lowest_at_or_above(bits: &[u64; 16], at: u16) -> Option<u16> {
    let at = usize::from(at);
    if at >= PRICE_LEVELS {
        return None;
    }
    let mut w = at / 64;
    let mut word = bits[w] & (!0u64 << (at % 64));
    loop {
        if word != 0 {
            let p = w * 64 + word.trailing_zeros() as usize;
            return (p < PRICE_LEVELS).then_some(p as u16);
        }
        w += 1;
        if w == bits.len() {
            return None;
        }
        word = bits[w];
    }
}

/// Highest non-empty price `≤ at` (bids walk down from the best bid).
pub fn highest_at_or_below(bits: &[u64; 16], at: u16) -> Option<u16> {
    let at = usize::from(at).min(PRICE_LEVELS - 1);
    let mut w = at / 64;
    let b = at % 64;
    let mut word = bits[w] & if b == 63 { !0u64 } else { (1u64 << (b + 1)) - 1 };
    loop {
        if word != 0 {
            return Some((w * 64 + 63 - word.leading_zeros() as usize) as u16);
        }
        if w == 0 {
            return None;
        }
        w -= 1;
        word = bits[w];
    }
}

/// Appends node `r` (already holding its `lots`) at the tail of `price`, so it queues behind every older order.
pub fn push_back(book: &mut Book, nodes: &mut [OrderNode], side: BookSide, price: u16, r: u32) -> Result<(), EventsError> {
    let lots = node_at(nodes, r)?.lots;
    let (bits, levels) = side_parts(book, side);
    let level = level_mut(levels, price)?;
    let tail = level.tail;
    if tail == NIL_REF {
        level.head = r;
    } else {
        node_at_mut(nodes, tail)?.next = r;
    }
    level.tail = r;
    level.live_lots = level.live_lots.checked_add(lots).ok_or(EventsError::MathOverflow)?;
    bit_set(bits, price, true);
    let node = node_at_mut(nodes, r)?;
    node.prev = tail;
    node.next = NIL_REF;
    Ok(())
}

/// Unlinks node `r` from `price`, subtracting its remaining lots from the level and clearing the bit when the
/// level empties. The node keeps its fields; the caller frees or reuses it.
pub fn unlink(book: &mut Book, nodes: &mut [OrderNode], side: BookSide, price: u16, r: u32) -> Result<(), EventsError> {
    let (prev, next, lots) = {
        let node = node_at(nodes, r)?;
        (node.prev, node.next, node.lots)
    };
    let (bits, levels) = side_parts(book, side);
    let level = level_mut(levels, price)?;
    if prev == NIL_REF {
        level.head = next;
    } else {
        node_at_mut(nodes, prev)?.next = next;
    }
    if next == NIL_REF {
        level.tail = prev;
    } else {
        node_at_mut(nodes, next)?.prev = prev;
    }
    level.live_lots = level.live_lots.checked_sub(lots).ok_or(EventsError::MathOverflow)?;
    if level.head == NIL_REF {
        bit_set(bits, price, false);
    }
    let node = node_at_mut(nodes, r)?;
    node.prev = NIL_REF;
    node.next = NIL_REF;
    Ok(())
}

/// Reduces a linked node's lots in place (queue position kept), keeping the level total in step.
pub fn shrink(book: &mut Book, nodes: &mut [OrderNode], side: BookSide, price: u16, r: u32, by: u64) -> Result<(), EventsError> {
    let node = node_at_mut(nodes, r)?;
    node.lots = node.lots.checked_sub(by).ok_or(EventsError::MathOverflow)?;
    let (_, levels) = side_parts(book, side);
    let level = level_mut(levels, price)?;
    level.live_lots = level.live_lots.checked_sub(by).ok_or(EventsError::MathOverflow)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bitmap_scans_find_the_nearest_set_price_in_each_direction() {
        let mut bits = [0u64; 16];
        for p in [1u16, 63, 64, 500, 999] {
            bit_set(&mut bits, p, true);
        }
        assert_eq!(lowest_at_or_above(&bits, 0), Some(1));
        assert_eq!(lowest_at_or_above(&bits, 2), Some(63));
        assert_eq!(lowest_at_or_above(&bits, 65), Some(500));
        assert_eq!(lowest_at_or_above(&bits, 1000), None);
        assert_eq!(highest_at_or_below(&bits, 999), Some(999));
        assert_eq!(highest_at_or_below(&bits, 998), Some(500));
        assert_eq!(highest_at_or_below(&bits, 63), Some(63));
        assert_eq!(highest_at_or_below(&bits, 62), Some(1));
        assert_eq!(highest_at_or_below(&bits, 0), None);
    }
}
