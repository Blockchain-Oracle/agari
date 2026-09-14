//! Cancel, reduce, cancel-all and sweep (events-engine.md §5.2; events-instructions.md §3.2–§3.5). They work in
//! every status and mode (D-009), so redeem is never stuck behind resting orders.

use super::evict::{handle_is_live, reduce_node, remove_node};
use super::Venue;
use crate::errors::EventsError;
use crate::events::{OrderHandle, RemovedRecord};
use crate::state::{node_ref, RemoveReason, NODE_FLAG_LIVE};

/// Most orders one cancel-all or sweep call reports (and removes).
pub const MAX_REMOVED_PER_CALL: usize = 32;

fn live_ref(v: &Venue, node: u32, seq: u64) -> Option<u32> {
    handle_is_live(v, node, seq).then(|| node_ref(node as usize)).flatten()
}

/// Cancels the seat's live handles; stale handles are skipped, a live handle of another seat is `NotOrderOwner`.
pub fn cancel_handles(v: &mut Venue, seat: u16, handles: &[OrderHandle]) -> Result<(Vec<RemovedRecord>, u8), EventsError> {
    let mut removed = Vec::with_capacity(handles.len());
    let mut skipped = 0u8;
    for h in handles {
        let Some(r) = live_ref(v, h.node, h.seq) else {
            skipped = skipped.saturating_add(1);
            continue;
        };
        if v.nodes[h.node as usize].seat != seat {
            return Err(EventsError::NotOrderOwner);
        }
        removed.push(remove_node(v, r, RemoveReason::UserCancel)?);
    }
    Ok((removed, skipped))
}

/// Shrinks a live order in place, keeping its queue position. Returns `(old_lots, kind, price)`.
pub fn reduce_order(v: &mut Venue, seat: u16, h: OrderHandle, new_lots: u64, min_lots: u64) -> Result<(u64, u8, u16), EventsError> {
    let r = live_ref(v, h.node, h.seq).ok_or(EventsError::UnknownOrder)?;
    let node = v.nodes[h.node as usize];
    if node.seat != seat {
        return Err(EventsError::NotOrderOwner);
    }
    if new_lots >= node.lots {
        return Err(EventsError::ReduceNotSmaller);
    }
    if new_lots < min_lots {
        return Err(EventsError::BelowMinLots);
    }
    let old = reduce_node(v, r, new_lots)?;
    Ok((old, node.kind, node.price))
}

/// Cancels the seat's live orders scanning nodes `0..min(high_water, max_scan)`, at most 32, stopping once the
/// seat has no open orders.
pub fn cancel_all(v: &mut Venue, seat: u16, max_scan: u16) -> Result<Vec<RemovedRecord>, EventsError> {
    let mut removed = Vec::new();
    let end = (v.book.high_water as usize).min(v.nodes.len()).min(usize::from(max_scan));
    for i in 0..end {
        if removed.len() == MAX_REMOVED_PER_CALL || v.seats.get(usize::from(seat)).is_none_or(|s| s.open_orders == 0) {
            break;
        }
        let node = v.nodes[i];
        if node.flags & NODE_FLAG_LIVE != 0 && node.seat == seat {
            let r = node_ref(i).ok_or(EventsError::UnknownOrder)?;
            removed.push(remove_node(v, r, RemoveReason::CancelAll)?);
        }
    }
    Ok(removed)
}

/// Evicts up to `max` orders by node index: the expired ones, or every one once `drain_all` (at or after `lock_at`,
/// or terminal). Nothing to do is a success.
pub fn sweep_expired(v: &mut Venue, max: u8, drain_all: bool) -> Result<Vec<RemovedRecord>, EventsError> {
    let mut removed = Vec::new();
    let end = (v.book.high_water as usize).min(v.nodes.len());
    for i in 0..end {
        if removed.len() >= usize::from(max) {
            break;
        }
        let node = v.nodes[i];
        if node.flags & NODE_FLAG_LIVE != 0 && (drain_all || node.expire_ts <= v.now) {
            let r = node_ref(i).ok_or(EventsError::UnknownOrder)?;
            removed.push(remove_node(v, r, RemoveReason::Sweep)?);
        }
    }
    Ok(removed)
}
