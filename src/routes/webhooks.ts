import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { webhooksRateLimit } from "../lib/rate-limit";

function getConvexClient(): ConvexHttpClient {
  const url = process.env.CONVEX_URL;
  if (!url) {
    throw new Error("CONVEX_URL environment variable is not set");
  }
  return new ConvexHttpClient(url);
}

export const webhookRoutes = new Elysia({ prefix: "/v1/webhooks" })
  .use(cors())
  .use(webhooksRateLimit)
  .post("/", async ({ headers, body, set }) => {
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

    const { url, events } = body as { url: string; events: string[] };

    if (!url || !events || events.length === 0) {
      set.status = 400;
      return { error: "Missing url or events" };
    }

    try {
      const webhookId = await getConvexClient().mutation(api.webhooks.create, {
        agentId: agent._id,
        url,
        events,
      });

      return { success: true, webhookId };
    } catch (err) {
      set.status = 400;
      return { error: String(err) };
    }
  }, {
    body: t.Object({
      url: t.String(),
      events: t.Array(t.String()),
    }),
  })
  .get("/", async ({ headers, set }) => {
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

    const webhooks = await getConvexClient().query(api.webhooks.getByAgent, {
      agentId: agent._id,
    });

    return { webhooks: webhooks.map(w => ({
      id: w._id,
      url: w.url,
      events: w.events,
      isActive: w.isActive,
      createdAt: w.createdAt,
    })) };
  })
  .post("/:webhookId/toggle", async ({ params, headers, body, set }) => {
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

    const { isActive } = body as { isActive: boolean };

    try {
      await getConvexClient().mutation(api.webhooks.toggle, {
        webhookId: params.webhookId as string,
        isActive,
      });

      return { success: true };
    } catch (err) {
      set.status = 500;
      return { error: String(err) };
    }
  })
  .delete("/:webhookId", async ({ params, headers, set }) => {
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

    try {
      await getConvexClient().mutation(api.webhooks.remove, {
        webhookId: params.webhookId as string,
      });

      return { success: true };
    } catch (err) {
      set.status = 500;
      return { error: String(err) };
    }
  });
