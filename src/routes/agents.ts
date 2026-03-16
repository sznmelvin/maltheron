import { Elysia } from "elysia";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { agentRateLimit } from "../lib/rate-limit";

function getConvexClient(): ConvexHttpClient {
  const url = process.env.CONVEX_URL;
  if (!url) {
    throw new Error("CONVEX_URL environment variable is not set. Run `npx convex dev` first.");
  }
  return new ConvexHttpClient(url);
}

export const agentRoutes = new Elysia({ prefix: "/v1/agents" })
  .use(agentRateLimit)
  .get("/:id", async ({ params, set }) => {
    const convex = getConvexClient();
    const agent = await convex.query(api.agents.getById, {
      agentId: params.id as string,
    });

    if (!agent) {
      set.status = 404;
      return { error: "Agent not found" };
    }

    return {
      id: agent._id,
      walletAddress: agent.walletAddress,
      balance: agent.balance,
      tier: agent.tier,
      status: agent.status,
      createdAt: agent.createdAt,
    };
  })
  .get("/", async ({ query }) => {
    const convex = getConvexClient();
    const limit = query.limit ? parseInt(query.limit as string) : 100;
    const agents = await convex.query(api.agents.getAll, { limit });

    return {
      agents: agents.map((a: any) => ({
        id: a._id,
        walletAddress: a.walletAddress,
        balance: a.balance,
        tier: a.tier,
        status: a.status,
        createdAt: a.createdAt,
      })),
    };
  })
  .get("/stats/count", async () => {
    const convex = getConvexClient();
    const count = await convex.query(api.agents.getActiveCount, {});
    return { activeAgentCount: count };
  });