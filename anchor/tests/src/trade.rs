//! Trading on a listed Window (S2 lane M): a funded Window, funded users, builders for the order, cancel, set and
//! withdraw instructions, and a send that also returns the program's return data (`PlaceResult`).

use agari_common::place_result::PlaceResult;
use agari_common::seeds::event_authority_address;
use agari_events::events::OrderHandle;
use agari_events::instructions::{PlaceOrderArgs, PolicyVersionArgs};
use anchor_lang::prelude::{AnchorDeserialize, Pubkey};
use anchor_lang::solana_program::instruction::Instruction;
use anchor_lang::{InstructionData, ToAccountMetas};
use anchor_spl::token::spl_token;
use solana_instruction_error::InstructionError;
use solana_keypair::Keypair;
use solana_signer::Signer;
use solana_transaction::Transaction;
use solana_transaction_error::TransactionError;

use crate::fixtures::{authorities, redstone, series_args, CLOSE_0925, NVDA, TRIAL_FROM};
use crate::harness::{key, Harness, Sent, SOL};
use crate::ix::{config, window_accounts};

/// A Regular 5m NVDA Window, trading from `start`.
#[derive(Debug, Clone, Copy)]
pub struct Window {
    pub series: Pubkey,
    pub book: Pubkey,
    pub market: Pubkey,
    pub ledger: Pubkey,
    pub mvault: Pubkey,
    pub start: i64,
}

fn ix(accounts: impl ToAccountMetas, data: impl InstructionData) -> Instruction {
    Instruction { program_id: agari_events::ID, accounts: accounts.to_account_metas(None), data: data.data() }
}

fn event_authority() -> Pubkey {
    event_authority_address(&agari_events::ID).0
}

impl Harness {
    /// Config, an NVDA RedStone Series (open-ended v1), a 256-node Book and Window 0 at Fri 09-25 19:00Z; the clock is
    /// moved 10 s into trading.
    pub fn trading_window(&mut self) -> Window {
        self.setup_config(authorities());
        let series = self.register_series(series_args(NVDA, 300, 0));
        let version = PolicyVersionArgs { valid_from_ts: TRIAL_FROM, valid_until_ts: i64::MAX, primary: redstone(b"NVDA", 900, 300), ..Default::default() };
        self.add_policy(&series, 0, version).expect("policy");
        let book = self.add_book(&series, 256);
        let start = CLOSE_0925 - 3_600;
        self.warp_to(start - 60);
        self.open_window(&series, &book, crate::fixtures::regular_window(0, start, 300, 0)).expect("open window");
        self.warp_to(start + 10);
        let w = window_accounts(&series, 0);
        Window { series, book, market: w.market, ledger: w.ledger, mvault: w.mvault, start }
    }

    /// A funded key with a collateral token account holding `tusdc` base units.
    pub fn funded_user(&mut self, tusdc: u64) -> (Keypair, Pubkey) {
        let user = self.fresh_key();
        self.svm.airdrop(&user.pubkey(), 10 * SOL).expect("airdrop");
        let token = self.fresh_key();
        let mint = self.mint;
        self.create_token_account(&token, &mint, &user.pubkey());
        if tusdc > 0 {
            let admin = key(1);
            let mint_to = spl_token::instruction::mint_to(&spl_token::ID, &mint, &token.pubkey(), &admin.pubkey(), &[], tusdc).unwrap();
            self.ok(&[mint_to], &[&admin]);
        }
        (user, token.pubkey())
    }

    pub fn token_amount(&self, token: &Pubkey) -> u64 {
        self.token_account(token).amount
    }

    /// `send`, returning the return data as well.
    pub fn send_returning(&mut self, ixs: &[Instruction], signers: &[&Keypair]) -> Result<(Sent, Vec<u8>), u32> {
        self.svm.expire_blockhash();
        let tx = Transaction::new_signed_with_payer(ixs, Some(&signers[0].pubkey()), signers, self.svm.latest_blockhash());
        let tx_bytes = tx.message_data().len() + 1 + 64 * tx.signatures.len();
        match self.svm.send_transaction(tx) {
            Ok(meta) => Ok((Sent { compute_units: meta.compute_units_consumed, tx_bytes }, meta.return_data.data)),
            Err(failed) => match failed.err {
                TransactionError::InstructionError(_, InstructionError::Custom(code)) => Err(code),
                other => panic!("transaction failed without a custom error: {other:?}\n{}", failed.meta.pretty_logs()),
            },
        }
    }

    /// Places an order signed by `user` and decodes its `PlaceResult`.
    pub fn place(&mut self, w: &Window, user: &Keypair, token: &Pubkey, args: PlaceOrderArgs) -> Result<(PlaceResult, Sent), u32> {
        let ix = self.place_order_ix(w, &user.pubkey(), token, args);
        let (sent, data) = self.send_returning(&[ix], &[user])?;
        Ok((PlaceResult::try_from_slice(&data).expect("PlaceResult return data"), sent))
    }

    pub fn place_order_ix(&self, w: &Window, authority: &Pubkey, token: &Pubkey, args: PlaceOrderArgs) -> Instruction {
        ix(
            agari_events::accounts::UserPlaceOrder {
                authority: *authority,
                config: config(),
                series: w.series,
                market: w.market,
                book: w.book,
                ledger: w.ledger,
                mvault: w.mvault,
                authority_token: *token,
                collateral_mint: self.mint,
                token_program: spl_token::ID,
                event_authority: event_authority(),
                program: agari_events::ID,
            },
            agari_events::instruction::UserPlaceOrder { args },
        )
    }

    fn cancel_accounts(&self, w: &Window, authority: &Pubkey, token: Option<&Pubkey>) -> agari_events::accounts::UserCancelOrders {
        agari_events::accounts::UserCancelOrders {
            authority: *authority,
            config: config(),
            series: w.series,
            market: w.market,
            book: w.book,
            ledger: w.ledger,
            mvault: token.map(|_| w.mvault),
            authority_token: token.copied(),
            collateral_mint: token.map(|_| self.mint),
            token_program: token.map(|_| spl_token::ID),
            event_authority: event_authority(),
            program: agari_events::ID,
        }
    }

    pub fn cancel_orders_ix(&self, w: &Window, authority: &Pubkey, token: Option<&Pubkey>, handles: Vec<OrderHandle>, seat_idx: u16) -> Instruction {
        let withdraw = token.is_some();
        ix(self.cancel_accounts(w, authority, token), agari_events::instruction::UserCancelOrders { handles, seat_idx, withdraw })
    }

    pub fn cancel_all_ix(&self, w: &Window, authority: &Pubkey, seat_idx: u16, max_scan: u16) -> Instruction {
        ix(self.cancel_accounts(w, authority, None), agari_events::instruction::UserCancelAll { seat_idx, max_scan, withdraw: false })
    }

    pub fn reduce_ix(&self, w: &Window, authority: &Pubkey, handle: OrderHandle, seat_idx: u16, new_lots: u64) -> Instruction {
        ix(
            agari_events::accounts::UserReduceOrder { authority: *authority, series: w.series, market: w.market, book: w.book, ledger: w.ledger, event_authority: event_authority(), program: agari_events::ID },
            agari_events::instruction::UserReduceOrder { handle, seat_idx, new_lots },
        )
    }

    pub fn sweep_ix(&self, w: &Window, max: u8) -> Instruction {
        ix(
            agari_events::accounts::PublicSweepExpired { series: w.series, market: w.market, book: w.book, ledger: w.ledger, event_authority: event_authority(), program: agari_events::ID },
            agari_events::instruction::PublicSweepExpired { max },
        )
    }

    fn set_accounts(&self, w: &Window, authority: &Pubkey, token: &Pubkey) -> agari_events::accounts::UserCompleteSet {
        agari_events::accounts::UserCompleteSet {
            authority: *authority,
            config: config(),
            series: w.series,
            market: w.market,
            ledger: w.ledger,
            mvault: w.mvault,
            authority_token: *token,
            collateral_mint: self.mint,
            token_program: spl_token::ID,
            event_authority: event_authority(),
            program: agari_events::ID,
        }
    }

    pub fn mint_set_ix(&self, w: &Window, authority: &Pubkey, token: &Pubkey, lots: u64, seat_hint: u16, use_credit: bool) -> Instruction {
        ix(self.set_accounts(w, authority, token), agari_events::instruction::UserMintCompleteSet { lots, seat_hint, use_credit })
    }

    pub fn merge_set_ix(&self, w: &Window, authority: &Pubkey, token: &Pubkey, lots: u64, seat_idx: u16, withdraw: bool) -> Instruction {
        ix(self.set_accounts(w, authority, token), agari_events::instruction::UserMergeCompleteSet { lots, seat_idx, withdraw })
    }

    pub fn withdraw_credit_ix(&self, w: &Window, authority: &Pubkey, token: &Pubkey, seat_idx: u16, amount: u64) -> Instruction {
        ix(
            agari_events::accounts::UserWithdrawCredit {
                authority: *authority,
                config: config(),
                market: w.market,
                ledger: w.ledger,
                mvault: w.mvault,
                authority_token: *token,
                collateral_mint: self.mint,
                token_program: spl_token::ID,
                event_authority: event_authority(),
                program: agari_events::ID,
            },
            agari_events::instruction::UserWithdrawCredit { seat_idx, amount },
        )
    }
}

/// An order expiring at the Window's lock, CancelTaker, 16 fills and evictions, claiming the first empty seat.
pub fn order_args(w: &Window, kind: u8, price: u16, lots: u64, order_type: u8) -> PlaceOrderArgs {
    PlaceOrderArgs { kind, price_ticks: price, lots, expire_ts: w.start + 300, order_type, self_match: 0, max_fills: 16, max_evictions: 16, seat_hint: u16::MAX, use_credit: false, withdraw_proceeds: false, client_id: 7 }
}
