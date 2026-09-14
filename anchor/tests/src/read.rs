//! Reads engine accounts from the VM by copying their bytes (VM account data isn't guaranteed aligned).

use agari_events::constants::{LEDGER_HEADER_LEN, SEAT_LEN};
use agari_events::state::{Book, GlobalConfig, Ledger, Market, Seat, Series};
use anchor_lang::prelude::Pubkey;
use anchor_spl::token::spl_token;
use anchor_lang::solana_program::program_pack::Pack;
use bytemuck::Pod;
use core::mem::size_of;

use crate::harness::Harness;

fn pod_at<T: Pod>(data: &[u8], offset: usize) -> T {
    bytemuck::pod_read_unaligned(&data[offset..offset + size_of::<T>()])
}

impl Harness {
    /// The fixed part of a zero-copy account (after the 8-byte discriminator).
    pub fn read<T: Pod>(&self, address: &Pubkey) -> T {
        pod_at(&self.account_data(address), 8)
    }

    pub fn config_state(&self) -> GlobalConfig {
        self.read(&crate::ix::config())
    }

    pub fn series_state(&self, series: &Pubkey) -> Series {
        self.read(series)
    }

    pub fn market_state(&self, market: &Pubkey) -> Market {
        self.read(market)
    }

    pub fn book_state(&self, book: &Pubkey) -> Book {
        self.read(book)
    }

    pub fn ledger_state(&self, ledger: &Pubkey) -> (Ledger, Vec<Seat>) {
        let data = self.account_data(ledger);
        let header: Ledger = pod_at(&data, 8);
        let seats = (0..usize::from(header.capacity)).map(|i| pod_at(&data, 8 + LEDGER_HEADER_LEN + SEAT_LEN * i)).collect();
        (header, seats)
    }

    pub fn token_account(&self, address: &Pubkey) -> spl_token::state::Account {
        spl_token::state::Account::unpack(&self.account_data(address)).expect("token account")
    }
}
