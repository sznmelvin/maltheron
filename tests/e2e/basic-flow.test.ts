import { describe, test, expect } from "bun:test";

const API_URL = process.env.API_URL || "http://localhost:3000";

interface Agent {
  id: string;
  walletAddress: string;
  token: string;
  balance: number;
}

let testAgent: Agent | null = null;

function generateSolanaAddress(): string {
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < 44; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

async function createDevAgent(): Promise<Agent> {
  const walletAddress = generateSolanaAddress();

  const res = await fetch(`${API_URL}/v1/auth/dev/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ walletAddress }),
  });

  const data = await res.json();
  
  if (!res.ok) {
    throw new Error(`Failed to create agent: ${JSON.stringify(data)}`);
  }

  return {
    id: data.agent.id,
    walletAddress,
    token: data.token,
    balance: data.agent.balance,
  };
}

async function verifyTransaction(token: string, txHash: string) {
  const res = await fetch(`${API_URL}/v1/ledger/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ txHash }),
  });

  return {
    status: res.status,
    data: await res.json(),
  };
}

async function getLedgerConfig(token: string) {
  const res = await fetch(`${API_URL}/v1/ledger/config`, {
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });
  return res.json();
}

async function getRecentTransactions(token: string) {
  const res = await fetch(`${API_URL}/v1/ledger/recent?limit=10`, {
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });
  return res.json();
}

async function queryMemory(token: string) {
  const res = await fetch(`${API_URL}/v1/memory/all`, {
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });
  return res.json();
}

describe("Maltheron E2E Flow", () => {
  test("1. Health endpoint works", async () => {
    const res = await fetch(`${API_URL}/v1/health`);
    const data = await res.json();
    
    expect(res.status).toBe(200);
    expect(data.status).toBe("healthy");
    expect(data.checks).toBeDefined();
    console.log("✓ Health check passed");
  });

  test("2. Create a dev agent", async () => {
    testAgent = await createDevAgent();

    expect(testAgent.token).toBeDefined();
    expect(testAgent.walletAddress).toHaveLength(44);
    
    console.log(`✓ Created Agent: ${testAgent.walletAddress.slice(0, 10)}...`);
  });

  test("3. Ledger config returns Solana mainnet settings", async () => {
    if (!testAgent) throw new Error("Agent not created");

    const config = await getLedgerConfig(testAgent.token);
    
    expect(config.chain).toBe("solana");
    expect(config.network).toBe("mainnet");
    expect(config.feeBps).toBe(10);
    expect(config.feePercentage).toBe("0.1%");
    expect(config.treasuryWallet).toBeDefined();
    
    console.log(`✓ Ledger config: ${config.chain} ${config.network}`);
    console.log(`   Treasury: ${config.treasuryWallet?.slice(0, 10)}...`);
  });

  test("4. Verify endpoint rejects invalid txHash format", async () => {
    if (!testAgent) throw new Error("Agent not created");

    const result = await verifyTransaction(
      testAgent.token,
      "invalid_tx_hash"
    );
    
    expect(result.status).toBe(400);
    expect(result.data.valid).toBe(false);
    
    console.log(`✓ Invalid txHash rejected with: ${result.data.error}`);
  });

  test("5. Verify endpoint rejects non-existent txHash", async () => {
    if (!testAgent) throw new Error("Agent not created");

    const fakeTxHash = "1".repeat(88);
    const result = await verifyTransaction(
      testAgent.token,
      fakeTxHash
    );
    
    expect(result.status).toBe(400);
    expect(result.data.valid).toBe(false);
    
    console.log(`✓ Non-existent txHash rejected`);
  });

  test("6. Get recent transactions", async () => {
    if (!testAgent) throw new Error("Agent not created");

    const transactions = await getRecentTransactions(testAgent.token);
    
    expect(transactions.transactions).toBeDefined();
    expect(Array.isArray(transactions.transactions)).toBe(true);
    
    console.log(`✓ Retrieved ${transactions.transactions.length} transactions`);
  });

  test("7. Query memory returns dimensions", async () => {
    if (!testAgent) throw new Error("Agent not created");

    const memory = await queryMemory(testAgent.token);
    
    expect(memory).toBeDefined();
    
    console.log(`✓ Memory query works`);
  });

  test("8. Unauthorized requests are rejected", async () => {
    const res = await fetch(`${API_URL}/v1/ledger/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        txHash: "1".repeat(88),
      }),
    });

    expect(res.status).toBe(401);
    
    console.log(`✓ Unauthorized requests rejected`);
  });
});

console.log("\n🦊 Maltheron E2E Test Suite");
console.log(`   API: ${API_URL}`);
console.log(`   Network: Solana Mainnet`);
console.log(`   Run: bun test\n`);
console.log("NOTE: Full verification requires:");
console.log("      1. Send SOL to recipient via Phantom");
console.log("      2. Send 0.1% fee to treasury via Phantom");
console.log("      3. Submit main txHash to /v1/ledger/verify\n");
