import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { 
  verifyTransaction, 
  verifyFeeTransfer,
  setTreasuryWallet, 
  getTreasuryWallet,
  isValidTransactionSignature,
  getExplorerUrl,
  FEE_BPS 
} from "../lib/solana";
import pino from "pino";
import { ledgerRateLimit } from "../lib/rate-limit";

const logger = pino({ name: "maltheron:ledger" });

function getConvexClient(): ConvexHttpClient {
  const url = process.env.CONVEX_URL;
  if (!url) {
    throw new Error("CONVEX_URL environment variable is not set.");
  }
  return new ConvexHttpClient(url);
}

export const ledgerRoutes = new Elysia({ prefix: "/v1/ledger" })
  .use(cors())
  .use(ledgerRateLimit)
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

      if (agent.status === "suspended") {
        set.status = 403;
        return { error: "Agent is suspended" };
      }

      const { txHash } = body as {
        txHash: string;
      };

      if (!txHash) {
        set.status = 400;
        return { error: "Missing txHash" };
      }

      if (!isValidTransactionSignature(txHash)) {
        set.status = 400;
        return { error: "Invalid transaction signature format" };
      }

      const treasuryWallet = getTreasuryWallet();
      
      try {
        const verificationResult = await verifyTransaction(txHash);

        if (!verificationResult.valid) {
          logger.warn({ txHash, error: verificationResult.error, agentId: agent._id }, "Transaction verification failed");
          set.status = 400;
          return { 
            valid: false, 
            error: verificationResult.error || "Transaction verification failed" 
          };
        }

        const txn = verificationResult.transaction!;
        
        if (!treasuryWallet) {
          set.status = 500;
          return { 
            valid: false,
            error: "Treasury wallet not configured on server" 
          };
        }

        const feeVerification = await verifyFeeTransfer(
          txHash,
          txn.amount,
          treasuryWallet
        );

        if (!feeVerification.valid) {
          logger.warn({ 
            txHash, 
            error: feeVerification.error, 
            agentId: agent._id,
            expectedFee: txn.fee 
          }, "Fee transfer not verified");
          set.status = 400;
          return { 
            valid: false, 
            error: "Fee not paid to treasury wallet",
            details: feeVerification.error,
            requiredFee: txn.fee,
            treasuryWallet: treasuryWallet,
          };
        }

        const transactionType = txn.to === agent.walletAddress ? "credit" : "debit";

        const recordResult = await convex.mutation(api.transactions.record, {
          agentId: agent._id as any,
          amount: txn.netAmount,
          currency: "SOL",
          type: transactionType,
          metadata: {
            protocol: "solana",
            mainTxHash: txHash,
            feeTxHash: feeVerification.feeTxHash,
            chainId: "solana:mainnet",
            isOnChain: true,
            sender: txn.from,
            receiver: txn.to,
            grossAmount: txn.amount,
            fee: txn.fee,
            treasuryWallet: treasuryWallet,
          },
          protocol: "solana",
        });

        logger.info({
          agentId: agent._id,
          walletAddress: agent.walletAddress,
          amount: txn.netAmount,
          currency: "SOL",
          type: transactionType,
          txHash,
          feeTxHash: feeVerification.feeTxHash,
          hash: recordResult.hash,
          verified: true,
        }, "Solana transaction verified and recorded");

        return {
          valid: true,
          verified: true,
          recorded: true,
          transaction: {
            hash: recordResult.hash,
            txHash,
            amount: txn.amount,
            netAmount: txn.netAmount,
            fee: txn.fee,
            currency: "SOL",
            type: transactionType,
            from: txn.from,
            to: txn.to,
            slot: txn.slot,
            timestamp: txn.timestamp,
          },
          feeTransfer: {
            verified: true,
            feeTxHash: feeVerification.feeTxHash,
          },
          explorer: {
            mainTx: getExplorerUrl(txHash),
            feeTx: feeVerification.feeTxHash ? getExplorerUrl(feeVerification.feeTxHash) : null,
          },
        };
      } catch (error) {
        logger.error({ error: String(error), txHash, agentId: agent?._id }, "Transaction verification failed");
        set.status = 500;
        return { error: "Verification failed", details: String(error) };
      }
    },
    {
      body: t.Object({
        txHash: t.String(),
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
      agentId: params.agentId as any,
    });
    return { transactions: txns };
  })
  .get("/volume", async ({ query }) => {
    const convex = getConvexClient();
    const volume = await convex.query(api.transactions.getTotalVolume, {
      agentId: query.agentId as any,
    });
    return { volume };
  })
  .get("/fees", async () => {
    const convex = getConvexClient();
    const revenue = await convex.query(api.transactions.getFeeRevenue, {});
    return { feeRevenue: revenue };
  })
  .get("/config", async () => {
    const treasuryWallet = getTreasuryWallet();
    
    return {
      chain: "solana",
      network: "mainnet",
      chainId: "solana:mainnet",
      treasuryWallet: treasuryWallet || null,
      feeBps: FEE_BPS,
      feePercentage: "0.1%",
      status: treasuryWallet ? "active" : "not_configured",
      explorer: "https://explorer.solana.com",
      usdcStatus: "Coming Soon",
      rpcNote: "Upgrade to Helius/QuickNode for production",
    };
  })
  .get("/balance/:address", async ({ set }) => {
    set.status = 501;
    return { 
      error: "Balance endpoint deprecated", 
      message: "Use Phantom wallet to check SOL balance. USDC support coming soon." 
    };
  });
