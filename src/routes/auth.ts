import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import pino from "pino";
import { authRateLimit } from "../lib/rate-limit";

const SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

const logger = pino({ name: "maltheron:auth" });

function getConvexClient(): ConvexHttpClient {
  const url = process.env.CONVEX_URL;
  if (!url) {
    throw new Error("CONVEX_URL environment variable is not set. Run `npx convex dev` first.");
  }
  return new ConvexHttpClient(url);
}

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function isValidSolanaAddress(address: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

export const authRoutes = new Elysia({ prefix: "/v1/auth" })
  .use(cors())
  .use(authRateLimit)
  .post("/session", async ({ body, set }) => {
    const convex = getConvexClient();
    const { walletAddress } = body as { walletAddress: string };

    if (!walletAddress) {
      set.status = 400;
      return { error: "Missing walletAddress" };
    }

    if (!isValidSolanaAddress(walletAddress)) {
      set.status = 400;
      return { error: "Invalid Solana wallet address format" };
    }

    let agent = await convex.query(api.agents.getByWallet, { walletAddress });

    if (!agent) {
      agent = await convex.mutation(api.agents.create, {
        walletAddress,
        tier: "standard",
        metadata: { chain: "solana" },
      });
    }

    if (!agent) {
      set.status = 500;
      return { error: "Failed to create agent" };
    }

    const token = generateToken();
    const expiresAt = Date.now() + SESSION_EXPIRY_MS;

    await convex.mutation(api.sessions.createSession, {
      agentId: agent._id as string,
      token,
      expiresAt,
    });

    logger.info({ walletAddress }, "Session created");

    return {
      token,
      expiresAt,
      agent: {
        id: agent._id,
        walletAddress: agent.walletAddress,
        balance: agent.balance,
        tier: agent.tier,
        status: agent.status,
      },
    };
  }, {
    body: t.Object({
      walletAddress: t.String(),
    }),
  })
  .post("/dev/create", async ({ body, set }) => {
    const NODE_ENV = process.env.NODE_ENV || "development";

    if (NODE_ENV !== "development") {
      set.status = 404;
      return { error: "Not found" };
    }

    const convex = getConvexClient();
    const { walletAddress } = body as { walletAddress?: string };

    const generateDevAddress = () => {
      const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
      let address = '';
      for (let i = 0; i < 44; i++) {
        address += chars[Math.floor(Math.random() * chars.length)];
      }
      return address;
    };

    const address = walletAddress || generateDevAddress();

    try {
      let agent = await convex.query(api.agents.getByWallet, {
        walletAddress: address,
      });

      if (!agent) {
        agent = await convex.mutation(api.agents.create, {
          walletAddress: address,
          tier: "development",
          metadata: { isDevMode: true, chain: "solana" },
        });
      }

      if (!agent) {
        set.status = 500;
        return { error: "Failed to create agent" };
      }

      const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("");
      const expiresAt = Date.now() + SESSION_EXPIRY_MS;

      await convex.mutation(api.sessions.createSession, {
        agentId: agent._id as string,
        token,
        expiresAt,
      });

      return {
        token,
        expiresAt,
        agent: {
          id: agent._id,
          walletAddress: agent.walletAddress,
          balance: agent.balance,
          tier: agent.tier,
          status: agent.status,
        },
      };
    } catch (err) {
      console.error("Dev create error:", err);
      set.status = 500;
      return { error: "Internal error", details: String(err) };
    }
  })
  .get("/me", async ({ headers, set }) => {
    const convex = getConvexClient();
    const authHeader = headers.authorization || headers.Authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      set.status = 401;
      return { error: "Missing authorization header" };
    }

    const token = authHeader.slice(7);
    const session = await convex.query(api.sessions.getSession, { token });

    if (!session) {
      set.status = 401;
      return { error: "Invalid or expired token" };
    }

    if (session.expiresAt && session.expiresAt < Date.now()) {
      await convex.mutation(api.sessions.deleteSession, { token });
      set.status = 401;
      return { error: "Session expired" };
    }

    const agent = await convex.query(api.agents.getById, { agentId: session.agentId });

    if (!agent) {
      set.status = 401;
      return { error: "Agent not found" };
    }

    return {
      id: agent._id,
      walletAddress: agent.walletAddress,
      balance: agent.balance,
      tier: agent.tier,
      status: agent.status,
      sessionExpiresAt: session.expiresAt,
    };
  })
  .post("/logout", async ({ headers, set }) => {
    const convex = getConvexClient();
    const authHeader = headers.authorization || headers.Authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      set.status = 401;
      return { error: "Missing authorization header" };
    }

    const token = authHeader.slice(7);
    await convex.mutation(api.sessions.deleteSession, { token });
    logger.info({ token: token.slice(0, 8) + "..." }, "Session invalidated");

    return { success: true };
  });

export const authRoutesWithoutDev = authRoutes;
