//! Engine events (events-accounts.md §5), emitted with `emit_cpi!`. Every Market-scoped event carries
//! `seq = ++market.event_seq`. Event structs are added with the instruction step that first emits them.
