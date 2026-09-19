use anchor_lang::prelude::*;

#[error_code]
pub enum RangeError {
    #[msg("the band is empty or inverted")]
    BadBand,
}
