import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { isValidSolanaAddress } from "../lib/solana";
import pino from "pino";
import { authRateLimit } from "../lib/rate-limit";

const SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
const NONCE_PREFIX = "Sign to login to Maltheron: ";

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

function verifySolanaSignature(
  message: string,
  signatureBase64: string,
  walletAddress: string
): boolean {
  try {
    const { PublicKey } = require("@solana/web3.js");
    const { nacl } = require("tweetnacl");

    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = Buffer.from(signatureBase64, "base64");
    const publicKey = new PublicKey(walletAddress);

    const messageHash = Buffer.from(messageBytes);
    const sig = Buffer.from(signatureBytes);

    return nacl.sign.detached.verify(messageHash, sig, publicKey.toBytes());
  } catch (error) {
    logger.error({ error: String(error) }, "Signature verification error");
    return false;
  }
}

function extractNonce(message: string): string | null {
  if (!message.startsWith(NONCE_PREFIX)) {
    return null;
  }
  return message.slice(NONCE_PREFIX.length);
}

export const authRoutes = new Elysia({ prefix: "/v1/auth" })
  .use(cors())
  .use(authRateLimit)
  .post("/session", async ({ body, set }) => {
    const convex = getConvexClient();
    const { walletAddress, signature, message, nonce } = body as {
      walletAddress: string;
      signature?: string;
      message?: string;
      nonce?: string;
    };

    if (!walletAddress) {
      set.status = 400;
      return { error: "Missing walletAddress" };
    }

    if (!isValidSolanaAddress(walletAddress)) {
      set.status = 400;
      return { error: "Invalid Solana wallet address format" };
    }

    // If signature and message provided, verify them (Phantom wallet flow)
    if (signature && message) {
      const extractedNonce = extractNonce(message);

      if (!extractedNonce) {
        set.status = 400;
        return { error: "Invalid message format. Expected 'Sign to login to Maltheron: [nonce]'" };
      }

      // Validate nonce exists and hasn't been used
      const nonceRecord = await convex.query(api.nonces.validate, { nonce: extractedNonce });

      if (!nonceRecord) {
        set.status = 401;
        return { error: "Invalid or expired nonce. Please refresh and try again." };
      }

      // Verify signature
      const isValid = verifySolanaSignature(message, signature, walletAddress);

      if (!isValid) {
        logger.warn({ walletAddress }, "Signature verification failed");
        set.status = 401;
        return { error: "Signature verification failed" };
      }

      // Consume the nonce (mark as used)
      await convex.mutation(api.nonces.consume, { nonce: extractedNonce });

      logger.info({ walletAddress, nonce: extractedNonce }, "Session created via Phantom wallet");
    } else {
      // Test mode or simple session (no signature verification)
      logger.info({ walletAddress }, "Session created (test mode or simple session)");
    }

    // Create or get agent
    let agent = await convex.query(api.agents.getByWallet, { walletAddress });

    if (!agent) {
      agent = await convex.mutation(api.agents.create, {
        walletAddress,
        tier: "standard",
        metadata: { chain: "solana", loginMethod: signature ? "phantom" : "test" },
      });
    }

    if (!agent) {
      set.status = 500;
      return { error: "Failed to create agent" };
    }

    const token = generateToken();
    const expiresAt = Date.now() + SESSION_EXPIRY_MS;

    await convex.mutation(api.sessions.createSession, {
      agentId: agent._id as any,
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
  }, {
    body: t.Object({
      walletAddress: t.String(),
      signature: t.Optional(t.String()),
      message: t.Optional(t.String()),
      nonce: t.Optional(t.String()),
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
        agentId: agent._id as any,
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
