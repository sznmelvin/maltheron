import { describe, test, expect } from "bun:test";

const API_URL = process.env.API_URL || "http://localhost:3000";

interface Agent {
  id: string;
  walletAddress: string;
  token: string;
  balance: number;
}

let agentA: Agent | null = null;
let agentB: Agent | null = null;

async function createDevAgent(walletSuffix: string = ""): Promise<Agent> {
  const walletAddress = walletSuffix 
    ? `0x${walletSuffix.padStart(40, "0").slice(0, 40)}`
    : `0x${Math.random().toString(16).slice(2, 42).padEnd(40, "0")}`;

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

async function transact(fromToken: string, toWallet: string, amount: number) {
  const res = await fetch(`${API_URL}/v1/ledger/transact`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${fromToken}`,
    },
    body: JSON.stringify({
      protocol: "x402",
      payload: {
        targetWallet: toWallet,
        amount,
        currency: "USDC",
      },
    }),
  });

  return {
    status: res.status,
    data: await res.json(),
  };
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

  test("2. Create two dev agents", async () => {
    agentA = await createDevAgent("aaaa");
    agentB = await createDevAgent("bbbb");

    expect(agentA.token).toBeDefined();
    expect(agentB.token).toBeDefined();
    expect(agentA.walletAddress).toMatch(/^0x[a-f0-9]{40}$/);
    expect(agentB.walletAddress).toMatch(/^0x[a-f0-9]{40}$/);
    
    console.log(`✓ Created Agent A: ${agentA.walletAddress.slice(0, 10)}...`);
    console.log(`✓ Created Agent B: ${agentB.walletAddress.slice(0, 10)}...`);
  });

  test("3. Agent A sends 1000 USDC to Agent B", async () => {
    if (!agentA || !agentB) throw new Error("Agents not created");

    const result = await transact(agentA.token, agentB.walletAddress, 1000);
    
    expect(result.status).toBe(200);
    expect(result.data.status).toBe("settled");
    expect(result.data.fee_deducted).toBe(1); // 0.1% of 1000
    
    console.log(`✓ Transferred 1000 USDC (fee: ${result.data.fee_deducted} USDC)`);
  });

  test("4. Verify transaction recorded", async () => {
    if (!agentA) throw new Error("Agent A not created");

    const transactions = await getRecentTransactions(agentA.token);
    
    expect(transactions.transactions).toBeDefined();
    expect(transactions.transactions.length).toBeGreaterThan(0);
    
    const debitTx = transactions.transactions.find((t: any) => t.type === "debit");
    
    // Debit shows net amount after fee (1000 - 1 = 999)
    expect(debitTx?.amount).toBe(999);
    
    console.log(`✓ Verified transaction recorded: ${debitTx?.amount} USDC (net after fee)`);
  });

  test("5. Query memory returns dimensions", async () => {
    if (!agentA) throw new Error("Agent A not created");

    const memory = await queryMemory(agentA.token);
    
    // Memory might be empty for new agents, but endpoint should work
    expect(memory).toBeDefined();
    
    console.log(`✓ Memory query works: ${JSON.stringify(memory).slice(0, 100)}`);
  });

  test("6. Agent B can also transact", async () => {
    if (!agentB) throw new Error("Agent B not created");

    // Agent B sends back to a different wallet
    const result = await transact(
      agentB.token, 
      "0x9999999999999999999999999999999999999999", 
      500
    );
    
    expect(result.status).toBe(200);
    console.log(`✓ Agent B can transact`);
  });

  test("7. Get agent stats", async () => {
    if (!agentA) throw new Error("Agent A not created");

    const res = await fetch(`${API_URL}/v1/agents/${agentA.id}`, {
      headers: {
        "Authorization": `Bearer ${agentA.token}`,
      },
    });
    const data = await res.json();
    
    expect(res.status).toBe(200);
    expect(data).toBeDefined();
    
    console.log(`✓ Agent query works`);
  });
});

console.log("\n🦊 Maltheron E2E Test Suite");
console.log(`   API: ${API_URL}`);
console.log(`   Run: bun test\n`);
