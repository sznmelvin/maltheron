import { Elysia, t } from "elysia";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { memoryRateLimit } from "../lib/rate-limit";

function getConvexClient(): ConvexHttpClient {
  const url = process.env.CONVEX_URL;
  if (!url) {
    throw new Error("CONVEX_URL environment variable is not set. Run `npx convex dev` first.");
  }
  return new ConvexHttpClient(url);
}

export const memoryRoutes = new Elysia({ prefix: "/v1/memory" })
  .use(memoryRateLimit)
  .post(
    "/query",
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

      const { dimension, timeframe, context } = body;

      let result;
      switch (dimension) {
        case "roi":
          result = await convex.query(api.memory.queryROI, {
            agentId: agent._id as string,
            timeframe,
            context,
          });
          break;
        case "spend_velocity":
          result = await convex.query(api.memory.querySpendVelocity, {
            agentId: agent._id as string,
            timeframe,
            context,
          });
          break;
        case "tax_liability":
          result = await convex.query(api.memory.queryTaxLiability, {
            agentId: agent._id as string,
            timeframe,
            context,
          });
          break;
        default:
          set.status = 400;
          return { error: "Invalid dimension" };
      }

      return result;
    },
    {
      body: t.Object({
        dimension: t.Union([
          t.Literal("roi"),
          t.Literal("spend_velocity"),
          t.Literal("tax_liability"),
        ]),
        timeframe: t.String(),
        context: t.Optional(t.Record(t.String(), t.String())),
      }),
    }
  )
  .get("/all", async ({ headers, set, query }) => {
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

    const timeframe = (query.timeframe as string) || "last_30d";
    const result = await convex.query(api.memory.queryAll, {
      agentId: agent._id as string,
      timeframe,
    });

    return result;
  })
  .get("/tax/stubs", async ({ headers, set }) => {
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

    const stubs = await convex.query(api.taxes.getByAgent, { agentId: agent._id as string });
    return { stubs };
  })
  .get("/tax/unpaid", async ({ headers, set }) => {
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

    const total = await convex.query(api.taxes.getTotalUnpaidLiability, {
      agentId: agent._id as string,
    });
    return { totalLiability: total };
  });