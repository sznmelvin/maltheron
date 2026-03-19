#!/usr/bin/env bun

import { Connection, PublicKey } from "@solana/web3.js";

const API_URL = process.env.API_URL || "https://maltheron.onrender.com";

function generateSolanaAddress(): string {
  const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let result = "";
  for (let i = 0; i < 44; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

async function createDevAgent(walletAddress: string) {
  console.log("\n📋 Step 1: Creating dev agent...\n");
  const res = await fetch(`${API_URL}/v1/auth/dev/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress }),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("❌ Failed to create agent:", data);
    process.exit(1);
  }

  console.log("✅ Agent created successfully!");
  console.log(`   Wallet: ${walletAddress.slice(0, 10)}...${walletAddress.slice(-6)}`);
  console.log(`   Token:  ${data.token.slice(0, 20)}...`);

  return data;
}

async function getLedgerConfig() {
  console.log("\n📋 Step 2: Fetching ledger configuration...\n");

  const res = await fetch(`${API_URL}/v1/ledger/config`);
  const config = await res.json();

  if (!res.ok) {
    console.error("❌ Failed to get config:", config);
    process.exit(1);
  }

  console.log("✅ Ledger config retrieved:");
  console.log(`   Chain:        ${config.chain}`);
  console.log(`   Network:      ${config.network}`);
  console.log(`   Fee:          ${config.feePercentage}`);
  console.log(`   Treasury:     ${config.treasuryWallet || "NOT CONFIGURED"}`);

  if (config.usdcStatus) {
    console.log(`   USDC:         ${config.usdcStatus}`);
  }

  return config;
}

function printInstructions(treasuryWallet: string, token: string) {
  console.log(`
┌─────────────────────────────────────────────────────────────────────┐
│                         TWO-TRANSFER FLOW                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. Open Phantom Wallet                                              │
│                                                                      │
│  2. Send your MAIN transfer (e.g., 10 SOL) to the recipient          │
│     └─ Copy the TRANSACTION SIGNATURE from Phantom                   │
│                                                                      │
│  3. Send the FEE transfer (0.1%) to treasury wallet:                 │
│     └─ Recipient: ${treasuryWallet.slice(0, 20)}...${treasuryWallet.slice(-10)}
│     └─ Amount:    0.01 SOL (for 10 SOL transaction)                  │
│     └─ Copy this TRANSACTION SIGNATURE too                           │
│                                                                      │
│  4. Come back here and paste the MAIN txHash to verify               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
`);
}

async function verifyTransaction(token: string, txHash: string) {
  console.log("\n📋 Step 3: Verifying transaction on-chain...\n");
  console.log(`   txHash: ${txHash.slice(0, 20)}...${txHash.slice(-10)}\n`);

  const res = await fetch(`${API_URL}/v1/ledger/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ txHash }),
  });

  const result = await res.json();

  if (!res.ok || !result.valid) {
    console.log("❌ Verification FAILED\n");
    console.log(`   Error: ${result.error}`);
    if (result.details) {
      console.log(`   Details: ${result.details}`);
    }
    if (result.requiredFee) {
      console.log(`   Required Fee: ${result.requiredFee} SOL`);
    }
    if (result.treasuryWallet) {
      console.log(`   Treasury: ${result.treasuryWallet}`);
    }
    return false;
  }

  console.log("✅ Transaction verified and recorded!\n");

  const tx = result.transaction;
  console.log("   Transaction Details:");
  console.log(`   ├── Amount:     ${tx.amount} SOL`);
  console.log(`   ├── Fee:        ${tx.fee} SOL`);
  console.log(`   ├── Net:        ${tx.netAmount} SOL`);
  console.log(`   ├── Type:       ${tx.type}`);
  console.log(`   ├── From:       ${tx.from.slice(0, 10)}...${tx.from.slice(-6)}`);
  console.log(`   └── To:         ${tx.to.slice(0, 10)}...${tx.to.slice(-6)}`);

  if (result.feeTransfer?.feeTxHash) {
    console.log("\n   Fee Transfer:");
    console.log(`   ├── Verified:  ✅`);
    console.log(`   └── txHash:    ${result.feeTransfer.feeTxHash.slice(0, 20)}...`);
  }

  if (result.explorer?.mainTx) {
    console.log(`\n   🔍 View on explorer: ${result.explorer.mainTx}`);
  }

  return true;
}

async function getAgentTransactions(token: string) {
  console.log("\n📋 Step 4: Fetching transaction history...\n");

  const res = await fetch(`${API_URL}/v1/ledger/recent?limit=5`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("❌ Failed to get transactions:", data);
    return;
  }

  const txns = data.transactions || [];

  if (txns.length === 0) {
    console.log("   No transactions recorded yet.");
    return;
  }

  console.log(`   Found ${txns.length} transaction(s):\n`);

  for (const tx of txns.slice(0, 5)) {
    const date = new Date(tx.timestamp).toLocaleString();
    console.log(`   ${tx.type.toUpperCase().padEnd(7)} | ${tx.amount.toFixed(4).padStart(12)} ${tx.currency} | ${date}`);
    console.log(`            Hash: ${(tx.metadata?.mainTxHash || tx.hash).slice(0, 20)}...`);
    console.log();
  }
}

async function demo() {
  console.log(`
╔═══════════════════════════════════════════════════════════════════════╗
║                    MALTHERON AGENT DEMO SCRIPT                        ║
║                                                                       ║
║   This script demonstrates how an agent uses Maltheron:                ║
║   1. Create session with wallet address                               ║
║   2. View treasury wallet for fee payments                            ║
║   3. Verify a SOL transaction (with fee enforcement)                  ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝
`);

  const walletAddress = generateSolanaAddress();
  const agentData = await createDevAgent(walletAddress);
  const config = await getLedgerConfig();

  if (!config.treasuryWallet) {
    console.log(`
⚠️  WARNING: Treasury wallet not configured on server!
   Ask the operator to set TREASURY_WALLET in environment variables.
`);
  }

  printInstructions(config.treasuryWallet || "TREASURY_NOT_SET", agentData.token);

  console.log("⏳ Waiting for you to send transfers via Phantom...\n");

  const readline = await import("readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const askTxHash = (): Promise<string> => {
    return new Promise((resolve) => {
      rl.question("📝 Paste your main transaction hash (txHash) and press Enter:\n   ", (answer) => {
        resolve(answer.trim());
      });
    });
  };

  const txHash = await askTxHash();

  if (!txHash) {
    console.log("\n❌ No txHash provided. Exiting.");
    rl.close();
    process.exit(1);
  }

  if (txHash.length < 50) {
    console.log("\n❌ Invalid txHash format. Expected a Solana signature (86-88 chars).");
    rl.close();
    process.exit(1);
  }

  rl.close();

  const success = await verifyTransaction(agentData.token, txHash);

  if (success) {
    await getAgentTransactions(agentData.token);
  }

  console.log(`
┌─────────────────────────────────────────────────────────────────────┐
│                         DEMO COMPLETE                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   Summary:                                                           │
│   • Agent created with wallet: ${walletAddress.slice(0, 15)}...              │
│   • Session token saved (for future API calls)                       │
│   • Treasury wallet confirmed: ${(config.treasuryWallet || "N/A").slice(0, 15)}...              │
│   • Transaction ${success ? "VERIFIED & RECORDED" : "NEEDS FEE PAYMENT"}                         │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

   Next steps for your agent:
   1. Save the session token for authenticated API calls
   2. Automate Phantom transfers in your agent code
   3. Call /v1/ledger/verify with each transaction
   4. Query /v1/ledger/recent to track history
   5. Use /v1/memory/query for financial insights
`);
}

demo().catch((error) => {
  console.error("\n❌ Demo failed:", error);
  process.exit(1);
});
