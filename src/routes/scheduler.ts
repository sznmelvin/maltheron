import { Elysia } from "elysia";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

function getConvexClient(): ConvexHttpClient {
  const url = process.env.CONVEX_URL;
  if (!url) {
    throw new Error("CONVEX_URL not configured");
  }
  return new ConvexHttpClient(url);
}

export const schedulerRoutes = new Elysia({ prefix: "/v1/scheduler" })
  .post("/snapshot", async ({ headers, set }) => {
    const apiKey = headers["x-api-key"];
    const expectedKey = process.env.SCHEDULER_API_KEY;
    
    if (expectedKey && apiKey !== expectedKey) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    const convex = getConvexClient();

    try {
      const agents = await convex.query(api.agents.getAll, { limit: 1000 });
      let snapshotsCreated = 0;

      for (const agent of agents) {
        const now = Date.now();
        const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

        const txns = await convex.query(api.transactions.getByAgentAndTimeframe, {
          agentId: agent._id,
          startTime: thirtyDaysAgo,
          endTime: now,
        });

        const credits = txns.filter((t: any) => t.type === "credit");
        const debits = txns.filter((t: any) => t.type === "debit");
        const fees = txns.filter((t: any) => t.type === "fee");

        const totalRevenue = credits.reduce((acc: number, t: any) => acc + t.amount, 0);
        const totalSpend = debits.reduce((acc: number, t: any) => acc + t.amount, 0);
        const totalFees = fees.reduce((acc: number, t: any) => acc + t.amount, 0);

        const roi = totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : 0;
        const dailyAverage = totalSpend / 30;
        const taxLiability = totalRevenue * 0.15;

        await convex.mutation(api.memorySnapshots.takeSnapshot, {
          agentId: agent._id,
          dimension: "roi",
          value: Math.round(roi * 100) / 100,
          metadata: { capitalDeployed: totalSpend, revenueGenerated: totalRevenue },
        });
        snapshotsCreated++;

        await convex.mutation(api.memorySnapshots.takeSnapshot, {
          agentId: agent._id,
          dimension: "spend_velocity",
          value: Math.round(dailyAverage * 100) / 100,
          metadata: { totalSpend: totalSpend + totalFees, dailyAverage },
        });
        snapshotsCreated++;

        await convex.mutation(api.memorySnapshots.takeSnapshot, {
          agentId: agent._id,
          dimension: "tax_liability",
          value: Math.round(taxLiability * 100) / 100,
          metadata: { taxableRevenue: totalRevenue, taxRate: 0.15 },
        });
        snapshotsCreated++;
      }

      return {
        success: true,
        agentsProcessed: agents.length,
        snapshotsCreated,
        timestamp: Date.now(),
      };
    } catch (error) {
      set.status = 500;
      return { error: "Snapshot failed", details: String(error) };
    }
  })
  .post("/tax-stubs/generate", async ({ headers, set }) => {
    const apiKey = headers["x-api-key"];
    const expectedKey = process.env.SCHEDULER_API_KEY;
    
    if (expectedKey && apiKey !== expectedKey) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    const convex = getConvexClient();
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    try {
      const agents = await convex.query(api.agents.getAll, { limit: 1000 });
      let stubsCreated = 0;

      for (const agent of agents) {
        const stubId = await convex.mutation(api.taxes.generateMonthlyStub, {
          agentId: agent._id,
          year,
          month,
        });
        if (stubId) stubsCreated++;
      }

      return {
        success: true,
        agentsProcessed: agents.length,
        stubsCreated,
        period: `${year}-${month.toString().padStart(2, "0")}`,
        timestamp: Date.now(),
      };
    } catch (error) {
      set.status = 500;
      return { error: "Tax stub generation failed", details: String(error) };
    }
  })
  .get("/health", async () => {
    return {
      status: "healthy",
      timestamp: Date.now(),
      services: {
        convex: "connected",
        scheduler: "ready",
      },
    };
  });