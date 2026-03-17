use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("MalTheron1111111111111111111111111111111");

const FEE_BPS: u64 = 10; // 0.1%

#[program]
pub mod maltheron {
    use super::*;

    pub fn process_payment(ctx: Context<ProcessPayment>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);

        let fee = (amount * FEE_BPS) / 10000;
        let net_amount = amount - fee;

        // Transfer fee to treasury
        if fee > 0 {
            let treasury_seed = &[ctx.accounts.treasury.key().as_ref()];
            let treasury_bump = ctx.bumps.treasury;
            let signer_seeds = &[treasury_seed, &[treasury_bump]];

            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.sender_token_account.to_account_info(),
                        to: ctx.accounts.treasury.to_account_info(),
                        authority: ctx.accounts.sender.to_account_info(),
                    },
                ),
                fee,
            )?;
        }

        // Transfer net amount to recipient
        if net_amount > 0 {
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.sender_token_account.to_account_info(),
                        to: ctx.accounts.recipient_token_account.to_account_info(),
                        authority: ctx.accounts.sender.to_account_info(),
                    },
                ),
                net_amount,
            )?;
        }

        emit!(PaymentProcessed {
            sender: ctx.accounts.sender.key(),
            recipient: ctx.accounts.recipient.key(),
            amount,
            fee,
            net_amount,
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct ProcessPayment<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = sender,
    )]
    pub sender_token_account: Account<'info, TokenAccount>,
    pub recipient: SystemAccount<'info>,
    #[account(
        init_if_needed,
        associated_token::mint = mint,
        associated_token::address = recipient.key(),
        payer = recipient,
        rent_exempt = enforce,
    )]
    pub recipient_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = treasury,
    )]
    pub treasury: Account<'info, TokenAccount>,
    pub mint: Account<'info, token::Mint>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[event]
pub struct PaymentProcessed {
    pub sender: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub fee: u64,
    pub net_amount: u64,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Insufficient balance")]
    InsufficientBalance,
    #[msg("Treasury not initialized")]
    TreasuryNotInitialized,
}
