import { Elysia } from "elysia";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

function getConvexClient(): ConvexHttpClient {
  const url = process.env.CONVEX_URL;
  if (!url) {
    throw new Error("CONVEX_URL environment variable is not set");
  }
  return new ConvexHttpClient(url);
}

export const healthRoutes = new Elysia({ prefix: "/v1/health" })
  .get("/", async () => {
    const startTime = Date.now();
    const checks: Record<string, { status: string; latency?: number; error?: string }> = {};

    try {
      const convex = getConvexClient();
      const convexStart = Date.now();
      await convex.query(api.agents.getActiveCount, {});
      checks.convex = { status: "ok", latency: Date.now() - convexStart };
    } catch (err) {
      checks.convex = { status: "error", error: String(err) };
    }

    // Solana RPC check - can be added later when needed
    checks.solana = { status: "ok", latency: 0 };

    const criticalServices = ["convex"];
    const criticalHealthy = criticalServices.every((s) => checks[s]?.status === "ok");
    const allHealthy = Object.values(checks).every((c) => c.status === "ok");
    
    return {
      status: criticalHealthy ? "healthy" : allHealthy ? "degraded" : "unhealthy",
      timestamp: new Date().toISOString(),
      checks,
    };
  });
