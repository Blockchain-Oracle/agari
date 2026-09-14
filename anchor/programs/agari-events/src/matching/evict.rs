//! Removing and shrinking resting orders (events-engine.md §5.1–§5.2). Eviction, self-match cancel, user cancel,
//! cancel-all and sweep all go through `remove_node`, so the refund rule exists once.

use super::paths::refund_escrow;
use super::Venue;
use crate::book::{node_at, release, shrink, unlink, BookSide};
use crate::errors::EventsError;
use crate::events::RemovedRecord;
use crate::state::{node_index, Kind, RemoveReason, NODE_FLAG_LIVE};

pub const fn side_of(kind: Kind) -> BookSide {
    if kind.is_bid() {
        BookSide::Bid
    } else {
        BookSide::Ask
    }
}

/// Unlinks node `r`, refunds its escrow to the owner's seat, frees it and updates the counters.
pub fn remove_node(v: &mut Venue, r: u32, reason: RemoveReason) -> Result<RemovedRecord, EventsError> {
    let node = *node_at(v.nodes, r)?;
    let kind = Kind::try_from(node.kind).map_err(|_| EventsError::UnknownOrder)?;
    unlink(v.book, v.nodes, side_of(kind), node.price, r)?;
    let seat = v.seats.get_mut(usize::from(node.seat)).ok_or(EventsError::SeatMismatch)?;
    refund_escrow(seat, kind, node.price, node.lots, v.cu)?;
    seat.open_orders = seat.open_orders.checked_sub(1).ok_or(EventsError::MathOverflow)?;
    let owner = seat.owner;
    release(v.book, v.nodes, r)?;
    v.book.order_count = v.book.order_count.checked_sub(1).ok_or(EventsError::MathOverflow)?;
    Ok(RemovedRecord {
        owner,
        seat: node.seat,
        node: node_index(r).and_then(|i| u32::try_from(i).ok()).ok_or(EventsError::UnknownOrder)?,
        seq: node.seq,
        kind: node.kind,
        price: node.price,
        lots: node.lots,
        reason: u8::from(reason),
    })
}

/// Reduces a live node to `new_lots` in place (queue priority kept) and refunds the difference.
pub fn reduce_node(v: &mut Venue, r: u32, new_lots: u64) -> Result<u64, EventsError> {
    let node = *node_at(v.nodes, r)?;
    let kind = Kind::try_from(node.kind).map_err(|_| EventsError::UnknownOrder)?;
    let by = node.lots.checked_sub(new_lots).ok_or(EventsError::ReduceNotSmaller)?;
    shrink(v.book, v.nodes, side_of(kind), node.price, r, by)?;
    let seat = v.seats.get_mut(usize::from(node.seat)).ok_or(EventsError::SeatMismatch)?;
    refund_escrow(seat, kind, node.price, by, v.cu)?;
    Ok(node.lots)
}

/// True when node index `i` is a live order whose sequence is `seq` (a stale handle is simply not live).
pub fn handle_is_live(v: &Venue, node: u32, seq: u64) -> bool {
    let within = node < v.book.high_water && (node as usize) < v.nodes.len();
    within && v.nodes[node as usize].flags & NODE_FLAG_LIVE != 0 && v.nodes[node as usize].seq == seq
}
