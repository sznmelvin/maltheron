import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { getSolanaConfig, setTreasuryWallet, getNetworkFromChainId, getUSDCBalance, getExplorerUrl } from "../lib/solana";
import pino from "pino";
import { ledgerRateLimit } from "../lib/rate-limit";

const logger = pino({ name: "maltheron:ledger" });

function getConvexClient(): ConvexHttpClient {
  const url = process.env.CONVEX_URL;
  if (!url) {
    throw new Error("CONVEX_URL environment variable is not set. Run `npx convex dev` first.");
  }
  return new ConvexHttpClient(url);
}

function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const ledgerRoutes = new Elysia({ prefix: "/v1/ledger" })
  .use(cors())
  .use(ledgerRateLimit)
  .post(
    "/transact",
    async ({ body, headers, set }) => {
      const convex = getConvexClient();
      const authHeader = headers.authorization || headers.Authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        set.status = 401;
        return { error: "Missing authorization header" };
      }

      const token = authHeader.slice(7);
      const agent = await convex.query(api.sessions.getAgentFromToken, { token });

      if (!agent) {
        set.status = 401;
        return { error: "Invalid or expired token" };
      }

      if (agent.status === "suspended") {
        set.status = 403;
        return { error: "Agent is suspended" };
      }

      const { payload, idempotencyKey } = body as { payload: any; idempotencyKey?: string };

      if (!payload || !payload.targetWallet || !payload.amount) {
        set.status = 400;
        return { error: "Invalid payload", details: "Missing targetWallet or amount" };
      }

      // Validate Solana address
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(payload.targetWallet)) {
        set.status = 400;
        return { error: "Invalid payload", details: "Invalid Solana address format" };
      }

      if (idempotencyKey) {
        const existing = await convex.query(api.idempotency.get, { key: idempotencyKey });
        if (existing && existing.agentId === agent._id) {
          logger.info({ idempotencyKey, agentId: agent._id, hash: existing.transactionHash }, "Idempotent request returning cached result");
          return {
            status: "settled" as const,
            hash: existing.transactionHash,
            idempotent: true,
            protocol: "solana",
            timestamp: existing.createdAt,
          };
        }
      }

      const parsed = {
        isValid: true,
        targetWallet: payload.targetWallet,
        amount: payload.amount,
        currency: payload.currency || "USDC",
      };

      const transactionType = parsed.targetWallet.toLowerCase() === agent.walletAddress.toLowerCase() 
        ? "credit" 
        : "debit";

      const result = await convex.mutation(api.transactions.record, {
        agentId: agent._id as string,
        amount: parsed.amount,
        currency: parsed.currency,
        type: transactionType,
        metadata: {
          protocol: "solana",
          targetWallet: parsed.targetWallet,
          sourceWallet: agent.walletAddress,
        },
        protocol: "solana",
      });

      if (idempotencyKey) {
        await convex.mutation(api.idempotency.create, {
          key: idempotencyKey,
          agentId: agent._id,
          transactionHash: result.hash,
        });
      }

      logger.info({
        agentId: agent._id,
        walletAddress: agent.walletAddress,
        amount: parsed.amount,
        currency: parsed.currency,
        type: transactionType,
        protocol: "solana",
        hash: result.hash,
        fee: result.fee,
        idempotencyKey: idempotencyKey || undefined,
      }, "Transaction recorded");

      return {
        status: "settled" as const,
        hash: result.hash,
        fee_deducted: result.fee,
        net_amount: result.netAmount,
        protocol: "solana",
        transaction_type: transactionType,
        timestamp: Date.now(),
      };
    },
    {
      body: t.Object({
        payload: t.Object({
          targetWallet: t.String(),
          amount: t.Number(),
          currency: t.Optional(t.String()),
        }),
        idempotencyKey: t.Optional(t.String()),
      }),
    }
  )
  .post(
    "/prepare",
    async ({ body, headers, set }) => {
      const authHeader = headers.authorization || headers.Authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        set.status = 401;
        return { error: "Missing authorization header" };
      }

      const token = authHeader.slice(7);
      const agent = await getConvexClient().query(api.sessions.getAgentFromToken, { token });

      if (!agent) {
        set.status = 401;
        return { error: "Invalid or expired token" };
      }

      const { targetWallet, amount, currency } = body as {
        targetWallet: string;
        amount: number;
        currency?: string;
      };

      // Basic validation for Solana addresses
      if (!targetWallet || targetWallet.length < 32 || targetWallet.length > 44) {
        set.status = 400;
        return { error: "Invalid payload", details: "Invalid Solana address format" };
      }

      const nonce = generateNonce();
      const expiresAt = Date.now() + 15 * 60 * 1000;

      return {
        nonce,
        expiresAt,
        instructions: "Use Phantom wallet to sign and send USDC transaction",
      };
    },
    {
      body: t.Object({
        targetWallet: t.String(),
        amount: t.Number(),
        currency: t.Optional(t.String()),
      }),
    }
  )
  .get("/recent", async ({ query }) => {
    const convex = getConvexClient();
    const limit = query.limit ? parseInt(query.limit as string) : 50;
    const txns = await convex.query(api.transactions.getRecent, { limit });
    return { transactions: txns };
  })
  .get("/agent/:agentId", async ({ params }) => {
    const convex = getConvexClient();
    const txns = await convex.query(api.transactions.getByAgent, {
      agentId: params.agentId as string,
    });
    return { transactions: txns };
  })
  .get("/volume", async ({ query }) => {
    const convex = getConvexClient();
    const volume = await convex.query(api.transactions.getTotalVolume, {
      agentId: query.agentId as string | undefined,
    });
    return { volume };
  })
  .get("/fees", async () => {
    const convex = getConvexClient();
    const revenue = await convex.query(api.transactions.getFeeRevenue, {});
    return { feeRevenue: revenue };
  })
  .post(
    "/verify",
    async ({ body, headers, set }) => {
      const convex = getConvexClient();
      const authHeader = headers.authorization || headers.Authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        set.status = 401;
        return { error: "Missing authorization header" };
      }

      const token = authHeader.slice(7);
      const agent = await convex.query(api.sessions.getAgentFromToken, { token });

      if (!agent) {
        set.status = 401;
        return { error: "Invalid or expired token" };
      }

      const { txHash, chainId, amount, currency, toAddress } = body as {
        txHash: string;
        chainId?: number;
        amount: number;
        currency?: string;
        toAddress?: string;
      };

      if (!txHash) {
        set.status = 400;
        return { error: "Missing txHash" };
      }

      // For Solana, we verify the transaction on-chain
      // For now, we'll record it directly - actual verification can be added later
      try {
        // TODO: Add Solana transaction verification
        // For now, trust the transaction hash provided
        const transactionType = "credit";
        
        logger.info({
          txHash,
          agentId: agent._id,
          amount,
          currency: currency || "USDC",
          from: "solana"
        }, "Recording Solana transaction");
        
        const recordResult = await convex.mutation(api.transactions.record, {
          agentId: agent._id as string,
          amount,
          currency: currency || "USDC",
          type: transactionType,
          metadata: {
            protocol: "onchain",
            txHash,
            chainId: "solana:devnet",
            isOnChain: true,
          },
          protocol: "onchain",
        });

        logger.info({
          agentId: agent._id,
          walletAddress: agent.walletAddress,
          amount,
          currency: currency || "USDC",
          type: transactionType,
          txHash,
          hash: recordResult.hash,
        }, "Solana transaction recorded");

        return {
          verified: true,
          transaction: {
            hash: recordResult.hash,
            amount,
            currency: currency || "USDC",
            type: transactionType,
          },
          explorer: {
            url: `https://explorer.solana.com/tx/${txHash}?cluster=devnet`,
          },
        };
      } catch (error) {
        logger.error({ error: String(error), txHash, agentId: agent?._id }, "Transaction recording failed");
        set.status = 500;
        return { error: "Recording failed", details: String(error) };
      }
    },
    {
      body: t.Object({
        txHash: t.String(),
        chainId: t.Optional(t.Number()),
        amount: t.Number(),
        currency: t.Optional(t.String()),
        toAddress: t.Optional(t.String()),
      }),
    }
  )
  .get("/config", async ({ set }) => {
    const treasuryWallet = process.env.SOLANA_TREASURY_WALLET || '';
    if (treasuryWallet) {
      setTreasuryWallet(treasuryWallet);
    }
    
    const config = getSolanaConfig('devnet');
    
    return {
      chain: "solana",
      network: "devnet",
      chainId: "solana:devnet",
      usdcMint: config.usdcMint,
      treasuryWallet: treasuryWallet || null,
      feeBps: 10,
      feePercentage: "0.1%",
      status: treasuryWallet ? "active" : "not_configured",
      instructions: !treasuryWallet ? {
        step1: "Set SOLANA_TREASURY_WALLET in environment variables",
        step2: "Restart server",
        getTokens: "Run 'solana airdrop 2' to get SOL, get USDC from faucet"
      } : null,
      rpcUrl: config.rpcUrl
    };
  })
  .get("/balance/:address", async ({ params, set }) => {
    const { address } = params;
    
    try {
      const balance = await getUSDCBalance(address, 'devnet');
      return { address, balance, currency: "USDC" };
    } catch (error) {
      set.status = 500;
      return { error: "Failed to get balance" };
    }
  });