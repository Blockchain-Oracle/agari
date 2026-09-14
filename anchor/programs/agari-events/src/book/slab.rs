//! Order-node allocation (events-accounts.md §3.9): a free list threaded through `OrderNode.next`, then a
//! high-water mark over never-used nodes. Refs are 1-based (0 = nil), so a zeroed Book is a valid empty book.

use crate::constants::NIL_REF;
use crate::errors::EventsError;
use crate::state::{node_index, node_ref, Book, OrderNode};

/// The node a 1-based ref names; a nil or out-of-range ref is `UnknownOrder` (a Book only this program writes
/// never produces one, but a bad ref must not index out of bounds).
pub fn node_at(nodes: &[OrderNode], r: u32) -> Result<&OrderNode, EventsError> {
    node_index(r).and_then(|i| nodes.get(i)).ok_or(EventsError::UnknownOrder)
}

pub fn node_at_mut(nodes: &mut [OrderNode], r: u32) -> Result<&mut OrderNode, EventsError> {
    node_index(r).and_then(|i| nodes.get_mut(i)).ok_or(EventsError::UnknownOrder)
}

/// A zeroed node's ref: pop the free list, else take the next never-used node, else `BookFull`.
pub fn alloc(book: &mut Book, nodes: &mut [OrderNode]) -> Result<u32, EventsError> {
    if book.free_head != NIL_REF {
        let r = book.free_head;
        let node = node_at_mut(nodes, r)?;
        book.free_head = node.next;
        *node = OrderNode::default();
        return Ok(r);
    }
    let high_water = usize::try_from(book.high_water).map_err(|_| EventsError::BookFull)?;
    if book.high_water >= book.capacity || high_water >= nodes.len() {
        return Err(EventsError::BookFull);
    }
    book.high_water += 1;
    let r = node_ref(high_water).ok_or(EventsError::BookFull)?;
    *node_at_mut(nodes, r)? = OrderNode::default();
    Ok(r)
}

/// Returns an unlinked node to the free list (flags cleared, so it is no longer `LIVE`).
pub fn release(book: &mut Book, nodes: &mut [OrderNode], r: u32) -> Result<(), EventsError> {
    let free_head = book.free_head;
    let node = node_at_mut(nodes, r)?;
    *node = OrderNode::default();
    node.next = free_head;
    book.free_head = r;
    Ok(())
}
