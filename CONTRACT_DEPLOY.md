# Smart Contract Deployment Guide

## Overview

The `MaltheronPaymentRouter` contract handles USDC payments with automatic fee splitting:
- **99.9%** → Recipient
- **0.1%** → Treasury (your wallet)

## Prerequisites

1. **Wallet with Base Sepolia testnet**
2. **Sepolia ETH** (for gas)
3. **USDC on Base Sepolia** (for testing)

## Step 1: Get Testnet Tokens

### ETH (for gas)
- Get from Base Sepolia faucet: https://bridge.base.org/deposit
- Or other faucets: https://faucet.oxbt.com, https://faucet.quicknode.com

### USDC (for testing)
- Go to https://testnet.bridge.base.org
- Bridge ETH to Base Sepolia
- Then swap ETH to USDC on https://app.uniswap.org (select Base Sepolia testnet)

## Step 2: Deploy Contract

### Option A: Using Remix IDE (Recommended)

1. Go to https://remix.ethereum.org
2. Create new file `MaltheronPaymentRouter.sol`
3. Paste the contract code
4. Compile (Ctrl+S)
5. Go to "Deploy" tab
6. Select "Injected Provider - MetaMask"
7. Deploy with:
   - `_usdc`: `0x036CbD53842c19Db7C8e4a499Ba7fD937B4dEg5` (Base Sepolia USDC)
   - `_treasury`: `YOUR_WALLET_ADDRESS` (your wallet to receive fees)

### Option B: Using Foundry

```bash
forge create contracts/MaltheronPaymentRouter.sol \
  --constructor-args 0x036CbD53842c19Db7C8e4a499Ba7fD937B4dEg5 YOUR_WALLET_ADDRESS \
  --rpc-url https://sepolia.base.org \
  --private-key YOUR_PRIVATE_KEY
```

## Step 3: Save Contract Address

After deployment, save your contract address:
```
CONTRACT_ADDRESS=0x...
```

## Step 4: Configure Backend

Add to your `.env.local`:
```
CONTRACT_ADDRESS=0xYOUR_CONTRACT_ADDRESS
```

## Step 5: Update Frontend (Optional)

The frontend needs to show users where to send USDC. Add the contract address to the UI.

## Contract Functions

| Function | Description |
|----------|-------------|
| `processPayment(from, to, amount)` | Direct transfer with fee |
| `splitPayment(to, amount)` | For funds already in contract |
| `setTreasury(newAddress)` | Update treasury wallet (owner only) |
| `withdrawFees()` | Withdraw accumulated fees |

## Verify Deployment

1. Go to https://sepolia.basescan.org
2. Search your contract address
3. Verify contract source code (optional)

## Production (Mainnet)

When ready for mainnet:

1. **USDC Address**: `0x833589fCD6eDb6E08f4c7c32B4F71F2e10fDD8f` (Base Mainnet)
2. **Deploy new contract** on Base Mainnet
3. **Update CONTRACT_ADDRESS** in production env vars

## Troubleshooting

### Transaction Fails
- Check user has approved USDC spending for the contract
- Ensure user has enough USDC balance
- Ensure user has ETH for gas

### Contract Not Working
- Verify USDC address is correct for the network
- Check contract is deployed to correct network (chain ID 84532 for Sepolia)
