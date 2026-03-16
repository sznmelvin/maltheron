import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import pino from "pino";
import { adminRateLimit } from "../lib/rate-limit";

const ADMIN_WALLETS = (process.env.ADMIN_WALLETS || "")
  .split(",")
  .map((w) => w.toLowerCase().trim())
  .filter(Boolean);

const logger = pino({ name: "maltheron:admin" });

function getConvexClient(): ConvexHttpClient {
  const url = process.env.CONVEX_URL;
  if (!url) {
    throw new Error("CONVEX_URL environment variable is not set");
  }
  return new ConvexHttpClient(url);
}

async function checkAdmin(authorization: string | null, convex: ConvexHttpClient): Promise<{ isAdmin: boolean; agent?: any; error?: string }> {
  if (!authorization || !authorization.startsWith("Bearer ")) {
    return { isAdmin: false, error: "Missing authorization header" };
  }

  const token = authorization.slice(7);
  const session = await convex.query(api.sessions.getSession, { token });

  if (!session) {
    return { isAdmin: false, error: "Invalid or expired token" };
  }

  if (session.expiresAt && session.expiresAt < Date.now()) {
    return { isAdmin: false, error: "Session expired" };
  }

  const agent = await convex.query(api.agents.getById, { agentId: session.agentId });

  if (!agent) {
    return { isAdmin: false, error: "Agent not found" };
  }

  if (agent.tier !== "admin") {
    return { isAdmin: false, error: "Admin access required" };
  }

  return { isAdmin: true, agent };
}

export const adminRoutes = new Elysia({ prefix: "/v1/admin" })
  .use(cors())
  .use(adminRateLimit)
  .get("/agents", async ({ headers, set, query }) => {
    const convex = getConvexClient();
    const authCheck = await checkAdmin(headers.authorization || headers.Authorization, convex);

    if (!authCheck.isAdmin) {
      set.status = 403;
      return { error: authCheck.error };
    }

    const rawLimit = query.limit ? parseInt(query.limit as string) : 100;
    const limit = Number.isNaN(rawLimit) ? 100 : Math.min(Math.max(rawLimit, 1), 1000);
    const agents = await convex.query(api.agents.getAll, { limit });

    return { agents };
  })
  .get("/agents/:agentId", async ({ params, headers, set }) => {
    const convex = getConvexClient();
    const authCheck = await checkAdmin(headers.authorization || headers.Authorization, convex);

    if (!authCheck.isAdmin) {
      set.status = 403;
      return { error: authCheck.error };
    }

    const agent = await convex.query(api.agents.getById, { agentId: params.agentId as string });

    if (!agent) {
      set.status = 404;
      return { error: "Agent not found" };
    }

    const transactions = await convex.query(api.transactions.getByAgent, {
      agentId: params.agentId as string,
      limit: 50,
    });

    return { agent, transactions };
  })
  .post("/agents/:agentId/suspend", async ({ params, headers, set }) => {
    const convex = getConvexClient();
    const authCheck = await checkAdmin(headers.authorization || headers.Authorization, convex);

    if (!authCheck.isAdmin) {
      set.status = 403;
      return { error: authCheck.error };
    }

    try {
      const agent = await convex.mutation(api.agents.updateStatus, {
        agentId: params.agentId as string,
        status: "suspended",
      });

      await convex.mutation(api.auditLogs.log, {
        agentId: authCheck.agent._id,
        action: "agent.suspend",
        payload: { targetAgentId: params.agentId },
        result: "success",
        ipAddress: headers["x-forwarded-for"]?.split(",")[0]?.trim(),
        userAgent: headers["user-agent"],
      });

      logger.info({ adminId: authCheck.agent._id, targetAgentId: params.agentId }, "Agent suspended");

      return { success: true, agent };
    } catch (err) {
      await convex.mutation(api.auditLogs.log, {
        agentId: authCheck.agent._id,
        action: "agent.suspend",
        payload: { targetAgentId: params.agentId, error: String(err) },
        result: "failed",
        ipAddress: headers["x-forwarded-for"]?.split(",")[0]?.trim(),
        userAgent: headers["user-agent"],
      });

      set.status = 500;
      return { error: String(err) };
    }
  })
  .post("/agents/:agentId/activate", async ({ params, headers, set }) => {
    const convex = getConvexClient();
    const authCheck = await checkAdmin(headers.authorization || headers.Authorization, convex);

    if (!authCheck.isAdmin) {
      set.status = 403;
      return { error: authCheck.error };
    }

    try {
      const agent = await convex.mutation(api.agents.updateStatus, {
        agentId: params.agentId as string,
        status: "active",
      });

      await convex.mutation(api.auditLogs.log, {
        agentId: authCheck.agent._id,
        action: "agent.activate",
        payload: { targetAgentId: params.agentId },
        result: "success",
        ipAddress: headers["x-forwarded-for"]?.split(",")[0]?.trim(),
        userAgent: headers["user-agent"],
      });

      logger.info({ adminId: authCheck.agent._id, targetAgentId: params.agentId }, "Agent activated");

      return { success: true, agent };
    } catch (err) {
      await convex.mutation(api.auditLogs.log, {
        agentId: authCheck.agent._id,
        action: "agent.activate",
        payload: { targetAgentId: params.agentId, error: String(err) },
        result: "failed",
        ipAddress: headers["x-forwarded-for"]?.split(",")[0]?.trim(),
        userAgent: headers["user-agent"],
      });

      set.status = 500;
      return { error: String(err) };
    }
  })
  .get("/audit", async ({ headers, set, query }) => {
    const convex = getConvexClient();
    const authCheck = await checkAdmin(headers.authorization || headers.Authorization, convex);

    if (!authCheck.isAdmin) {
      set.status = 403;
      return { error: authCheck.error };
    }

    const rawLimit = query.limit ? parseInt(query.limit as string) : 100;
    const limit = Number.isNaN(rawLimit) ? 100 : Math.min(Math.max(rawLimit, 1), 1000);
    const action = query.action as string | undefined;

    const logs = await convex.query(api.auditLogs.getRecent, { limit, action });

    return { logs };
  })
  .get("/stats", async ({ headers, set }) => {
    const convex = getConvexClient();
    const authCheck = await checkAdmin(headers.authorization || headers.Authorization, convex);

    if (!authCheck.isAdmin) {
      set.status = 403;
      return { error: authCheck.error };
    }

    const activeCount = await convex.query(api.agents.getActiveCount, {});
    const totalVolume = await convex.query(api.transactions.getTotalVolume, {});
    const feeRevenue = await convex.query(api.transactions.getFeeRevenue, {});

    return {
      activeAgents: activeCount,
      totalVolume,
      feeRevenue,
    };
  });
