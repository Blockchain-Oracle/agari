//! agari-events: DreamDEX Event Contracts rebuilt as an Anchor CLOB (plan P§3.1).
//! Spec: `docs/plan/specs/{events-engine,events-accounts,events-instructions,prints}.md`.
//! This file is dispatch only; logic lives in `instructions/`, `matching/`, `book/` and `state/`.

use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod events;

declare_id!("cDcHZiQ1WYAHbSjxMoju86fbC8azrtQg7dzrWKynANH");

#[program]
pub mod agari_events {}
