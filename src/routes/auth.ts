import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { ConvexHttpClient } from "convex/browser";
import { createPublicClient, http, recoverMessageAddress } from "viem";
import { baseSepolia, baseMainnet } from "../lib/blockchain";
import { api } from "../../convex/_generated/api";
import pino from "pino";
import { authRateLimit } from "../lib/rate-limit";

const SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
const NONCE_TTL_MS = 5 * 60 * 1000;

const logger = pino({ name: "maltheron:auth" });

function getConvexClient(): ConvexHttpClient {
  const url = process.env.CONVEX_URL;
  if (!url) {
    throw new Error("CONVEX_URL environment variable is not set. Run `npx convex dev` first.");
  }
  return new ConvexHttpClient(url);
}

function getViemClient(chainId: number) {
  const chain = chainId === 8453 ? baseMainnet : baseSepolia;
  return createPublicClient({
    chain,
    transport: http(),
  });
}

async function verifyWalletSignature(
  message: string,
  signature: `0x${string}`,
  expectedAddress: `0x${string}`,
  chainId: number = 84532
): Promise<boolean> {
  try {
    const client = getViemClient(chainId);
    const recoveredAddress = await client.recoverMessageAddress({
      message,
      signature,
    });
    const isValid = recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
    if (!isValid) {
      logger.warn({ expected: expectedAddress, recovered: recoveredAddress }, "Signature recovery address mismatch");
    }
    return isValid;
  } catch (err) {
    logger.error({ error: String(err), chainId }, "Signature verification failed");
    return false;
  }
}

function parseAndValidateSIWEMessage(
  message: string,
  expectedAddress: string,
  expectedDomain: string,
  expectedChainId: number
): { valid: boolean; nonce?: string; error?: string } {
  const lines = message.split("\n").map(l => l.trim());
  
  const addressLine = lines.find(l => l.startsWith("Address:"));
  const nonceLine = lines.find(l => l.startsWith("Nonce:"));
  const domainLine = lines.find(l => l.startsWith("Domain:") || l.startsWith("domain:"));
  const chainIdLine = lines.find(l => l.startsWith("Chain ID:") || l.startsWith("chainId:"));
  
  if (!addressLine || !nonceLine) {
    return { valid: false, error: "Invalid SIWE message format" };
  }

  const address = addressLine.replace(/^(Address:|address:)\s*/i, "").trim();
  if (address.toLowerCase() !== expectedAddress.toLowerCase()) {
    return { valid: false, error: "Address mismatch in message" };
  }

  if (domainLine) {
    const domain = domainLine.replace(/^(Domain:|domain:)\s*/i, "").trim();
    if (domain.toLowerCase() !== expectedDomain.toLowerCase()) {
      return { valid: false, error: "Domain mismatch" };
    }
  }

  if (chainIdLine) {
    const chainId = parseInt(chainIdLine.replace(/^(Chain ID:|chainId:)\s*/i, "").trim());
    if (chainId !== expectedChainId) {
      return { valid: false, error: "Chain ID mismatch" };
    }
  }

  const nonce = nonceLine.replace(/^(Nonce:|nonce:)\s*/i, "").trim();
  return { valid: true, nonce };
}

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function generateSIWEMessage(address: string, nonce: string, domain: string = "maltheron.network", chainId: number = 84532): string {
  return `Sign in to Maltheron

Address: ${address}
Domain: ${domain}
Chain ID: ${chainId}
Nonce: ${nonce}

This signature verifies your wallet ownership and creates a session.`;
}

export const authRoutes = new Elysia({ prefix: "/v1/auth" })
  .use(cors())
  .use(authRateLimit)
  .post("/prepare", async ({ body, set }) => {
    const { walletAddress, chainId } = body as { walletAddress: string; chainId?: number };
    
    if (!walletAddress) {
      set.status = 400;
      return { error: "Missing walletAddress" };
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      set.status = 400;
      return { error: "Invalid wallet address format" };
    }

    const convex = getConvexClient();
    const nonce = generateToken().slice(0, 16);
    const activeChainId = chainId || 84532;

    await convex.mutation(api.nonces.create, {
      nonce,
      walletAddress,
    });

    const message = generateSIWEMessage(walletAddress, nonce, "maltheron.network", activeChainId);

    logger.debug({ walletAddress, nonce }, "Nonce created for wallet");

    return {
      message,
      nonce,
      domain: "maltheron.network",
      chainId: activeChainId,
      expiresAt: Date.now() + NONCE_TTL_MS,
    };
  }, {
    body: t.Object({
      walletAddress: t.String(),
      chainId: t.Optional(t.Number()),
    }),
  })
  .post("/session", async ({ body, set }) => {
    const convex = getConvexClient();
    const { walletAddress, signature, message, chainId } = body as {
      walletAddress: string;
      signature: string;
      message: string;
      chainId?: number;
    };

    if (!walletAddress || !signature || !message) {
      set.status = 400;
      return { error: "Missing required fields: walletAddress, signature, message" };
    }

    if (!/^0x[a-fA-F0-9]{130}$/.test(signature)) {
      set.status = 400;
      return { error: "Invalid signature format" };
    }

    const activeChainId = chainId || 84532;
    const validation = parseAndValidateSIWEMessage(message, walletAddress, "maltheron.network", activeChainId);
    if (!validation.valid) {
      set.status = 400;
      return { error: validation.error };
    }

    const nonceRecord = await convex.query(api.nonces.validate, { nonce: validation.nonce });
    if (!nonceRecord) {
      set.status = 400;
      return { error: "Invalid or expired nonce. Please request a new message." };
    }

    if (nonceRecord.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      logger.warn({ walletAddress, expected: nonceRecord.walletAddress }, "Nonce wallet mismatch");
      set.status = 400;
      return { error: "Nonce not issued for this wallet" };
    }

    const isValid = await verifyWalletSignature(
      message,
      signature as `0x${string}`,
      walletAddress as `0x${string}`,
      activeChainId
    );

    if (!isValid) {
      set.status = 401;
      return { error: "Invalid signature. Please sign the message to authenticate." };
    }

    if (validation.nonce) {
      await convex.mutation(api.nonces.consume, { nonce: validation.nonce });
    }

    logger.info({ walletAddress, chainId: activeChainId }, "Session created");

    let agent = await convex.query(api.agents.getByWallet, { walletAddress });

    if (!agent) {
      agent = await convex.mutation(api.agents.create, {
        walletAddress,
        tier: "standard",
        metadata: { chainId: activeChainId },
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

    return {
      token,
      expiresAt,
      agent: {
        id: agent._id,
        walletAddress: agent.walletAddress,
        balance: agent.balance,
        tier: agent.tier,
        status: agent.status,
        chainId: activeChainId,
      },
    };
  })
  .post("/dev/create", async ({ body, set }) => {
    const NODE_ENV = process.env.NODE_ENV || "development";
    
    // Dev endpoint only works in development
    if (NODE_ENV !== "development") {
      set.status = 404;
      return { error: "Not found" };
    }

    const convex = getConvexClient();
    const { walletAddress } = body as { walletAddress?: string };
    
    if (walletAddress && !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      set.status = 400;
      return { error: "Invalid wallet address format" };
    }

    // Generate random wallet if not provided
    const bytes = new Uint8Array(20);
    crypto.getRandomValues(bytes);
    const address = walletAddress || `0x${Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("")}`;

    try {
      let agent = await convex.query(api.agents.getByWallet, {
        walletAddress: address,
      });

      if (!agent) {
        agent = await convex.mutation(api.agents.create, {
          walletAddress: address,
          tier: "development",
          metadata: { isDevMode: true, chainId: 84532 },
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

export const authRoutesWithoutDev = new Elysia({ prefix: "/v1/auth" })
  .use(cors())
  .use(authRateLimit)
  .post("/prepare", async ({ body, set }) => {
    const { walletAddress, chainId } = body as { walletAddress: string; chainId?: number };
    
    if (!walletAddress) {
      set.status = 400;
      return { error: "Missing walletAddress" };
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      set.status = 400;
      return { error: "Invalid wallet address format" };
    }

    const convex = getConvexClient();
    const nonce = generateToken().slice(0, 16);
    const activeChainId = chainId || 84532;

    await convex.mutation(api.nonces.create, {
      nonce,
      walletAddress,
    });

    const message = generateSIWEMessage(walletAddress, nonce, "maltheron.network", activeChainId);

    logger.debug({ walletAddress, nonce }, "Nonce created for wallet");

    return {
      message,
      nonce,
      domain: "maltheron.network",
      chainId: activeChainId,
      expiresAt: Date.now() + NONCE_TTL_MS,
    };
  }, {
    body: t.Object({
      walletAddress: t.String(),
      chainId: t.Optional(t.Number()),
    }),
  })
  .post("/session", async ({ body, set }) => {
    const convex = getConvexClient();
    const { walletAddress, signature, message, chainId } = body as {
      walletAddress: string;
      signature: string;
      message: string;
      chainId?: number;
    };

    if (!walletAddress || !signature || !message) {
      set.status = 400;
      return { error: "Missing required fields: walletAddress, signature, message" };
    }

    if (!/^0x[a-fA-F0-9]{130}$/.test(signature)) {
      set.status = 400;
      return { error: "Invalid signature format" };
    }

    const activeChainId = chainId || 84532;
    const validation = parseAndValidateSIWEMessage(message, walletAddress, "maltheron.network", activeChainId);
    if (!validation.valid) {
      set.status = 400;
      return { error: validation.error };
    }

    const nonceRecord = await convex.query(api.nonces.validate, { nonce: validation.nonce });
    if (!nonceRecord) {
      set.status = 400;
      return { error: "Invalid or expired nonce. Please request a new message." };
    }

    if (nonceRecord.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      logger.warn({ walletAddress, expected: nonceRecord.walletAddress }, "Nonce wallet mismatch");
      set.status = 400;
      return { error: "Nonce not issued for this wallet" };
    }

    const isValid = await verifyWalletSignature(
      message,
      signature as `0x${string}`,
      walletAddress as `0x${string}`,
      activeChainId
    );

    if (!isValid) {
      set.status = 401;
      return { error: "Invalid signature. Please sign the message to authenticate." };
    }

    if (validation.nonce) {
      await convex.mutation(api.nonces.consume, { nonce: validation.nonce });
    }

    logger.info({ walletAddress, chainId: activeChainId }, "Session created");

    let agent = await convex.query(api.agents.getByWallet, { walletAddress });

    if (!agent) {
      agent = await convex.mutation(api.agents.create, {
        walletAddress,
        tier: "standard",
        metadata: { chainId: activeChainId },
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

    return {
      token,
      expiresAt,
      agent: {
        id: agent._id,
        walletAddress: agent.walletAddress,
        balance: agent.balance,
        tier: agent.tier,
        status: agent.status,
        chainId: activeChainId,
      },
    };
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
