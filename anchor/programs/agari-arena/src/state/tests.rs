//! Targeted cases: a whole duel, every way a pot can end, each refusal in the order the chain checks it, and a key
//! that can spend the deck's ceiling and not a unit more.

use super::*;
use crate::errors::ArenaError;
use anchor_lang::prelude::Pubkey;

pub(super) const UNIT: u64 = 1_000_000;

pub(super) fn arena() -> Arena {
    let mut a = Arena { params: ArenaParams { join_window_sec: 180, reveal_window_sec: 120, pick_window_sec: 180, min_deck_size: 3, max_deck_size: 5, min_card_life_sec: 240 }, ..Arena::default() };
    a.tiers = [
        Tier { pot_base: 0, per_card_cap_base: UNIT, enabled: true },
        Tier { pot_base: UNIT, per_card_cap_base: UNIT, enabled: true },
        Tier { pot_base: 5 * UNIT, per_card_cap_base: UNIT, enabled: true },
        Tier { pot_base: 10 * UNIT, per_card_cap_base: UNIT, enabled: false },
    ];
    a
}

pub(super) struct Table {
    pub m: GameMatch,
    pub creator: Pubkey,
    pub challenger: Pubkey,
    pub credits: [Credit; 2],
}

/// A match created, joined and revealed at t = 1,000, with `deck` distinct cards.
pub(super) fn picking(a: &mut Arena, tier: u8, deck: u8) -> Table {
    let (creator, challenger) = (Pubkey::new_unique(), Pubkey::new_unique());
    let mut m = GameMatch::default();
    a.book_create(&mut m, [7; 32], creator, challenger, tier, [9; 32], deck, 1, 1_000).unwrap();
    a.book_join(&mut m, &challenger, 1_010).unwrap();
    let cards: Vec<Pubkey> = (0..deck).map(|_| Pubkey::new_unique()).collect();
    a.book_reveal(&mut m, &cards, 1_020).unwrap();
    Table { m, creator, challenger, credits: [Credit::default(), Credit::default()] }
}

fn play(a: &Arena, t: &mut Table, seat: usize, card: u8, cost: u64) -> bool {
    let who = if seat == 0 { t.creator } else { t.challenger };
    assert_eq!(a.pick_guard(&t.m, &who, card, UNIT, 1_030), Ok(seat));
    a.book_pick(&mut t.m, seat, card, (card % 2) as u8, cost / 500, 1_000, cost, UNIT).unwrap()
}

#[test]
fn a_whole_duel_the_better_reader_takes_both_pots_and_every_unit_is_accounted_for() {
    let mut a = arena();
    let mut t = picking(&mut a, 2, 3);
    assert_eq!((a.escrowed_base, t.m.status, t.m.pick_deadline_sec), (10 * UNIT, MatchStatus::Picking, 1_200));
    for card in 0..3 {
        assert!(!play(&a, &mut t, 0, card, 900_000));
        let last = play(&a, &mut t, 1, card, 800_000);
        // The last pick locks the match by itself.
        assert_eq!(last, card == 2);
    }
    assert_eq!(t.m.status, MatchStatus::Settling);

    // The creator is right on two cards, the challenger on one. Each payout is what the venue paid.
    let [c0, c1] = &mut t.credits;
    for (card, (p0, p1)) in [(1_800_000u64, 0u64), (1_800_000, 0), (0, 1_600_000)].into_iter().enumerate() {
        a.settle_guard(&t.m, card as u8).unwrap();
        a.book_settle_pick(&mut t.m, card as u8, 0, p0, c0).unwrap();
        a.book_settle_pick(&mut t.m, card as u8, 1, p1, c1).unwrap();
        t.m.settled_mask |= 1 << card;
        assert_eq!(a.settle_guard(&t.m, card as u8), Err(ArenaError::AlreadySettled));
    }
    assert_eq!(t.m.pnl_base, [3_600_000 - 2_700_000, 1_600_000 - 2_400_000]);

    let done = a.book_finalize(&mut t.m, c0, c1).unwrap();
    assert_eq!(done, Finalized { winner: Some(t.creator), creator_base: 10 * UNIT, challenger_base: 0, pot_base: 10 * UNIT });
    assert_eq!((a.escrowed_base, c0.amount_base, c1.amount_base), (0, 3_600_000 + 10 * UNIT, 1_600_000));
    assert_eq!(a.total_owed_base(), u128::from(c0.amount_base + c1.amount_base));
    assert_eq!(a.book_finalize(&mut t.m, c0, c1), Err(ArenaError::WrongStatus));
    assert_eq!(a.book_claim(c0), Ok(13_600_000));
    assert_eq!(a.book_claim(c0), Err(ArenaError::NoCredit));
}

#[test]
fn one_absent_player_forfeits_the_pot_alone_and_still_owns_their_cards() {
    let mut a = arena();
    let mut t = picking(&mut a, 1, 3);
    for card in 0..3 {
        play(&a, &mut t, 0, card, 900_000);
    }
    play(&a, &mut t, 1, 0, 900_000);
    let [c0, c1] = &mut t.credits;
    assert_eq!(a.book_lock(&mut t.m, c0, c1, 1_200), Err(ArenaError::DeadlineNotPassed));
    assert_eq!(a.book_lock(&mut t.m, c0, c1, 1_201), Ok(Locked::Forfeited(t.challenger)));
    // The pot cannot be awarded while a played card is unsettled, the absent player's one card included.
    assert_eq!(a.book_finalize(&mut t.m, c0, c1), Err(ArenaError::CardsOutstanding));
    for card in 0..3u8 {
        a.settle_guard(&t.m, card).unwrap();
        a.book_settle_pick(&mut t.m, card, 0, 0, c0).unwrap();
        if card == 0 {
            // The challenger lost the pot and still gets what their one card paid.
            a.book_settle_pick(&mut t.m, card, 1, 1_800_000, c1).unwrap();
        }
        t.m.settled_mask |= 1 << card;
    }
    // The creator finished the deck and lost every card; the pot is theirs all the same.
    let done = a.book_finalize(&mut t.m, c0, c1).unwrap();
    assert_eq!((done.winner, c0.amount_base, c1.amount_base), (Some(t.creator), 2 * UNIT, 1_800_000));
}

#[test]
fn both_absent_is_nobodys_win_and_a_tie_splits() {
    let mut a = arena();
    let mut t = picking(&mut a, 2, 3);
    play(&a, &mut t, 0, 0, 900_000);
    let [c0, c1] = &mut t.credits;
    assert_eq!(a.book_lock(&mut t.m, c0, c1, 1_201), Ok(Locked::Refunded));
    assert_eq!((t.m.status, c0.amount_base, c1.amount_base, a.escrowed_base), (MatchStatus::Refunded, 5 * UNIT, 5 * UNIT, 0));
    // A refunded match still settles the card that was played.
    a.settle_guard(&t.m, 0).unwrap();

    let mut t = picking(&mut a, 2, 3);
    for card in 0..3 {
        play(&a, &mut t, 0, card, 900_000);
        play(&a, &mut t, 1, card, 900_000);
    }
    let [c0, c1] = &mut t.credits;
    for card in 0..3u8 {
        a.book_settle_pick(&mut t.m, card, 0, 0, c0).unwrap();
        a.book_settle_pick(&mut t.m, card, 1, 0, c1).unwrap();
        t.m.settled_mask |= 1 << card;
    }
    let done = a.book_finalize(&mut t.m, c0, c1).unwrap();
    assert_eq!((done.winner, done.creator_base, done.challenger_base), (None, 5 * UNIT, 5 * UNIT));
}

#[test]
fn entry_and_the_ways_out_are_refused_in_the_chains_order() {
    let mut a = arena();
    let (creator, challenger, stranger) = (Pubkey::new_unique(), Pubkey::new_unique(), Pubkey::new_unique());
    let mut m = GameMatch::default();
    a.paused = true;
    assert_eq!(a.book_create(&mut m, [1; 32], creator, challenger, 1, [9; 32], 3, 1, 0), Err(ArenaError::Paused));
    a.paused = false;
    assert_eq!(a.book_create(&mut m, [1; 32], creator, creator, 1, [9; 32], 3, 1, 0), Err(ArenaError::SelfJoin));
    assert_eq!(a.book_create(&mut m, [1; 32], creator, challenger, 1, [0; 32], 3, 1, 0), Err(ArenaError::DeckMismatch));
    assert_eq!(a.book_create(&mut m, [1; 32], creator, challenger, 1, [9; 32], 2, 1, 0), Err(ArenaError::BadDeckSize));
    assert_eq!(a.book_create(&mut m, [1; 32], creator, challenger, 3, [9; 32], 3, 1, 0), Err(ArenaError::UnknownTier));
    assert_eq!(a.book_create(&mut m, [1; 32], creator, challenger, 1, [9; 32], 3, 1, 1_000), Ok(UNIT));
    assert_eq!(a.book_create(&mut m, [1; 32], creator, challenger, 1, [9; 32], 3, 1, 1_000), Err(ArenaError::MatchExists));

    assert_eq!(a.book_join(&mut m, &stranger, 1_001), Err(ArenaError::NotAPlayer));
    assert_eq!(a.book_join(&mut m, &challenger, 1_181), Err(ArenaError::DeadlinePassed));
    let mut credit = Credit::default();
    assert_eq!(a.book_refund_unjoined(&mut m, &mut credit, Some(&stranger), 1_001), Err(ArenaError::NotAPlayer));
    assert_eq!(a.book_refund_unjoined(&mut m, &mut credit, None, 1_180), Err(ArenaError::DeadlineNotPassed));
    assert_eq!(a.book_refund_unjoined(&mut m, &mut credit, None, 1_181), Ok(RefundReason::JoinTimeout));
    assert_eq!((credit.amount_base, a.escrowed_base, m.status), (UNIT, 0, MatchStatus::Refunded));

    let mut m = GameMatch::default();
    a.book_create(&mut m, [2; 32], creator, challenger, 1, [9; 32], 3, 1, 2_000).unwrap();
    a.book_join(&mut m, &challenger, 2_001).unwrap();
    let (mut c0, mut c1) = (Credit::default(), Credit::default());
    assert_eq!(a.book_refund_unjoined(&mut m, &mut c0, Some(&creator), 2_002), Err(ArenaError::WrongStatus));
    assert_eq!(a.book_refund_unrevealed(&mut m, &mut c0, &mut c1, 2_121), Err(ArenaError::DeadlineNotPassed));
    let card = Pubkey::new_unique();
    assert_eq!(a.book_reveal(&mut m, &[card, Pubkey::new_unique()], 2_002), Err(ArenaError::BadDeckSize));
    assert_eq!(a.book_reveal(&mut m, &[card, Pubkey::new_unique(), card], 2_002), Err(ArenaError::DuplicateCard));
    assert_eq!(a.book_reveal(&mut m, &[card, Pubkey::new_unique(), Pubkey::new_unique()], 2_122), Err(ArenaError::DeadlinePassed));
    assert_eq!(a.book_refund_unrevealed(&mut m, &mut c0, &mut c1, 2_122), Ok(()));
    assert_eq!((c0.amount_base, c1.amount_base, a.escrowed_base), (UNIT, UNIT, 0));
}

#[test]
fn a_pick_is_refused_in_the_chains_order() {
    let mut a = arena();
    let t = picking(&mut a, 1, 3);
    let stranger = Pubkey::new_unique();
    a.paused = true;
    assert_eq!(a.pick_guard(&t.m, &t.creator, 0, UNIT, 1_030), Err(ArenaError::Paused));
    a.paused = false;
    assert_eq!(a.pick_guard(&t.m, &t.creator, 0, UNIT, 1_201), Err(ArenaError::DeadlinePassed));
    assert_eq!(a.pick_guard(&t.m, &stranger, 0, UNIT, 1_030), Err(ArenaError::NotAPlayer));
    assert_eq!(a.pick_guard(&t.m, &t.creator, 3, UNIT, 1_030), Err(ArenaError::BadCard));
    assert_eq!(a.pick_guard(&t.m, &t.creator, 0, 0, 1_030), Err(ArenaError::ZeroAmount));
    assert_eq!(a.pick_guard(&t.m, &t.creator, 0, UNIT + 1, 1_030), Err(ArenaError::StakeAboveCap));
    let mut m = t.m.clone();
    assert_eq!(a.book_pick(&mut m, 0, 0, 0, 1_000, 1_000, UNIT + 1, UNIT), Err(ArenaError::CostAboveStake));
    a.book_pick(&mut m, 0, 0, 0, 1_000, 1_000, 900_000, UNIT).unwrap();
    assert_eq!(a.pick_guard(&m, &t.creator, 0, UNIT, 1_030), Err(ArenaError::AlreadyPicked));
    // The other seat's pick on the same card is its own record.
    assert_eq!(a.pick_guard(&m, &t.challenger, 0, UNIT, 1_030), Ok(1));
    let waiting = GameMatch { creator: t.creator, challenger: t.challenger, deck_size: 3, ..GameMatch::default() };
    assert_eq!(a.pick_guard(&waiting, &t.creator, 0, UNIT, 1_030), Err(ArenaError::WrongStatus));
    assert_eq!(a.settle_guard(&waiting, 0), Err(ArenaError::WrongStatus));
}

#[test]
fn a_seats_key_can_spend_the_decks_ceiling_and_not_a_unit_more() {
    let mut a = arena();
    let t = picking(&mut a, 1, 3);
    let (key, thief) = (Pubkey::new_unique(), Pubkey::new_unique());
    let mut agent = Agent::default();
    let budget = t.m.agent_budget_base().unwrap();
    assert_eq!(budget, 3 * UNIT);
    assert_eq!(a.book_agent(&mut agent, key, 0, budget, 1_000), Err(ArenaError::BadTtl));
    assert_eq!(a.book_agent(&mut agent, key, 86_401, budget, 1_000), Err(ArenaError::BadTtl));
    assert_eq!(a.book_agent(&mut agent, key, 600, budget, 1_000), Ok(3 * UNIT));
    assert_eq!((a.agent_escrow_base, agent.expires_at_sec), (3 * UNIT, 1_600));
    // Naming another key while money is still set aside for this one would strand it.
    assert_eq!(a.book_agent(&mut agent, thief, 600, budget, 1_000), Err(ArenaError::AgentStillLive));

    assert_eq!(a.book_agent_stake(&mut agent, &thief, UNIT, 1_030), Err(ArenaError::NotAgent));
    assert_eq!(a.book_agent_stake(&mut agent, &key, UNIT, 1_601), Err(ArenaError::AgentExpired));
    a.book_agent_stake(&mut agent, &key, UNIT, 1_030).unwrap();
    // 0.9 filled: the unspent 0.1 goes back beside the rest, but the ceiling counts the whole stake.
    a.book_agent_refund(&mut agent, 100_000).unwrap();
    a.book_agent_stake(&mut agent, &key, UNIT, 1_031).unwrap();
    a.book_agent_stake(&mut agent, &key, UNIT, 1_032).unwrap();
    assert_eq!((agent.spent_base, agent.escrow_base, a.agent_escrow_base), (3 * UNIT, 100_000, 100_000));
    assert_eq!(a.book_agent_stake(&mut agent, &key, 1, 1_033), Err(ArenaError::AgentOverBudget));

    assert!(!Arena::agent_releasable(&t.m, agent.expires_at_sec, 1_100));
    assert!(Arena::agent_releasable(&t.m, agent.expires_at_sec, 1_601));
    let settling = GameMatch { status: MatchStatus::Settling, ..t.m.clone() };
    assert!(Arena::agent_releasable(&settling, agent.expires_at_sec, 1_100));
    let mut credit = Credit::default();
    assert_eq!(a.book_agent_release(&mut agent, &mut credit), Ok(100_000));
    assert_eq!((credit.amount_base, a.agent_escrow_base, agent.agent), (100_000, 0, Pubkey::default()));
    assert_eq!(a.book_agent_stake(&mut agent, &key, 1, 1_033), Err(ArenaError::NotAgent));
}

#[test]
fn the_parameters_have_to_describe_a_playable_match() {
    let good = arena().params;
    assert!(good.validate().is_ok());
    assert_eq!(ArenaParams { max_deck_size: 9, ..good }.validate(), Err(ArenaError::BadParams));
    assert_eq!(ArenaParams { min_deck_size: 6, ..good }.validate(), Err(ArenaError::BadParams));
    assert_eq!(ArenaParams { pick_window_sec: 0, ..good }.validate(), Err(ArenaError::BadParams));
    assert_eq!(full_mask(3), 0b111);
    assert_eq!(full_mask(8), 0xff);
}
