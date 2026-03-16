import { mutation, query, action } from "./_generated/server";
import { v } from "convex/values";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export const runDailySnapshot = action({
  args: {},
  handler: async (ctx): Promise<{ agentsProcessed: number; snapshotsCreated: number }> => {
    const agents = await ctx.runQuery(api.agents.getAll, { limit: 1000 });
    let snapshotsCreated = 0;

    for (const agent of agents) {
      const now = Date.now();
      const thirtyDaysAgo = now - THIRTY_DAYS_MS;

      const txns = await ctx.runQuery(api.transactions.getByAgentAndTimeframe, {
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

      await ctx.runMutation(api.memorySnapshots.takeSnapshot, {
        agentId: agent._id,
        dimension: "roi",
        value: Math.round(roi * 100) / 100,
        metadata: { capitalDeployed: totalSpend, revenueGenerated: totalRevenue },
      });
      snapshotsCreated++;

      await ctx.runMutation(api.memorySnapshots.takeSnapshot, {
        agentId: agent._id,
        dimension: "spend_velocity",
        value: Math.round(dailyAverage * 100) / 100,
        metadata: { totalSpend: totalSpend + totalFees, dailyAverage },
      });
      snapshotsCreated++;

      await ctx.runMutation(api.memorySnapshots.takeSnapshot, {
        agentId: agent._id,
        dimension: "tax_liability",
        value: Math.round(taxLiability * 100) / 100,
        metadata: { taxableRevenue: totalRevenue, taxRate: 0.15 },
      });
      snapshotsCreated++;
    }

    return { agentsProcessed: agents.length, snapshotsCreated };
  },
});

export const takeSnapshot = mutation({
  args: {
    agentId: v.id("agents"),
    dimension: v.string(),
    value: v.number(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("memorySnapshots", {
      agentId: args.agentId,
      dimension: args.dimension,
      value: args.value,
      timestamp: Date.now(),
      metadata: args.metadata,
    });
    return id;
  },
});

export const getLatestSnapshot = query({
  args: {
    agentId: v.id("agents"),
    dimension: v.string(),
  },
  handler: async (ctx, args) => {
    const snapshots = await ctx.db
      .query("memorySnapshots")
      .withIndex("by_agent_dimension", (q) =>
        q.eq("agentId", args.agentId).eq("dimension", args.dimension)
      )
      .order("desc")
      .take(1);
    return snapshots[0] || null;
  },
});

export const getSnapshotsByAgent = query({
  args: {
    agentId: v.id("agents"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 30;
    return await ctx.db
      .query("memorySnapshots")
      .withIndex("by_agent_timestamp", (q) => q.eq("agentId", args.agentId))
      .order("desc")
      .take(limit);
  },
});

import { api } from "./_generated/api";