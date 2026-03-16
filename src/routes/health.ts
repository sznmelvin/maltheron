import { Elysia } from "elysia";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { createPublicClient, http } from "viem";
import { baseSepolia, baseMainnet } from "../lib/blockchain";

function getConvexClient(): ConvexHttpClient {
  const url = process.env.CONVEX_URL;
  if (!url) {
    throw new Error("CONVEX_URL environment variable is not set");
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

export const healthRoutes = new Elysia({ prefix: "/v1/health" })
  .get("/", async () => {
    const startTime = Date.now();
    const checks: Record<string, { status: string; latency?: number; error?: string }> = {};
    const NODE_ENV = process.env.NODE_ENV || "development";

    try {
      const convex = getConvexClient();
      const convexStart = Date.now();
      await convex.query(api.agents.getActiveCount, {});
      checks.convex = { status: "ok", latency: Date.now() - convexStart };
    } catch (err) {
      checks.convex = { status: "error", error: String(err) };
    }

    if (NODE_ENV === "production") {
      try {
        const chainId = 84532;
        const viem = getViemClient(chainId);
        const rpcStart = Date.now();
        await viem.getBlockNumber();
        checks.base_rpc = { status: "ok", latency: Date.now() - rpcStart };
      } catch (err) {
        checks.base_rpc = { status: "error", error: String(err) };
      }
    } else {
      checks.base_rpc = { status: "skipped", latency: 0 };
    }

    const criticalServices = ["convex"];
    const criticalHealthy = criticalServices.every((s) => checks[s]?.status === "ok");
    const allHealthy = Object.values(checks).every((c) => c.status === "ok" || c.status === "skipped");
    
    return {
      status: criticalHealthy ? "healthy" : allHealthy ? "degraded" : "unhealthy",
      timestamp: new Date().toISOString(),
      checks,
    };
  });