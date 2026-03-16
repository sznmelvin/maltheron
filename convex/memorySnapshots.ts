import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const takeSnapshot = mutation({
  args: {
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    const txns = await ctx.db
      .query("transactions")
      .withIndex("by_agent_timestamp", (q) => q.eq("agentId", args.agentId))
      .filter((q) => q.gte(q.field("timestamp"), thirtyDaysAgo))
      .collect();

    const credits = txns.filter((t) => t.type === "credit");
    const debits = txns.filter((t) => t.type === "debit");
    const fees = txns.filter((t) => t.type === "fee");

    const totalRevenue = credits.reduce((acc, t) => acc + t.amount, 0);
    const totalSpend = debits.reduce((acc, t) => acc + t.amount, 0);
    const totalFees = fees.reduce((acc, t) => acc + t.amount, 0);

    const roi = totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : 0;
    const dailyAverage = totalSpend / 30;
    const taxLiability = totalRevenue * 0.15;

    await ctx.db.insert("memorySnapshots", {
      agentId: args.agentId,
      dimension: "roi",
      value: Math.round(roi * 100) / 100,
      timestamp: now,
      metadata: {
        capitalDeployed: totalSpend,
        revenueGenerated: totalRevenue,
        periodDays: 30,
      },
    });

    await ctx.db.insert("memorySnapshots", {
      agentId: args.agentId,
      dimension: "spend_velocity",
      value: Math.round(dailyAverage * 100) / 100,
      timestamp: now,
      metadata: {
        totalSpend: totalSpend + totalFees,
        dailyAverage: Math.round(dailyAverage * 100) / 100,
        periodDays: 30,
      },
    });

    await ctx.db.insert("memorySnapshots", {
      agentId: args.agentId,
      dimension: "tax_liability",
      value: Math.round(taxLiability * 100) / 100,
      timestamp: now,
      metadata: {
        taxableRevenue: totalRevenue,
        taxRate: 0.15,
        periodDays: 30,
      },
    });

    return { snapshotCount: 3, timestamp: now };
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

export const getAllSnapshots = query({
  args: {
    agentId: v.id("agents"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 30;
    const snapshots = await ctx.db
      .query("memorySnapshots")
      .withIndex("by_agent_timestamp", (q) => q.eq("agentId", args.agentId))
      .order("desc")
      .take(limit);
    
    return snapshots;
  },
});

export const takeAllSnapshots = mutation({
  args: {},
  handler: async (ctx) => {
    const agents = await ctx.db.query("agents").collect();
    let totalSnapshots = 0;

    for (const agent of agents) {
      const now = Date.now();
      const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

      const txns = await ctx.db
        .query("transactions")
        .withIndex("by_agent_timestamp", (q) => q.eq("agentId", agent._id))
        .filter((q) => q.gte(q.field("timestamp"), thirtyDaysAgo))
        .collect();

      const credits = txns.filter((t) => t.type === "credit");
      const debits = txns.filter((t) => t.type === "debit");
      const fees = txns.filter((t) => t.type === "fee");

      const totalRevenue = credits.reduce((acc, t) => acc + t.amount, 0);
      const totalSpend = debits.reduce((acc, t) => acc + t.amount, 0);
      const totalFees = fees.reduce((acc, t) => acc + t.amount, 0);

      const roi = totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : 0;
      const dailyAverage = totalSpend / 30;
      const taxLiability = totalRevenue * 0.15;

      await ctx.db.insert("memorySnapshots", {
        agentId: agent._id,
        dimension: "roi",
        value: Math.round(roi * 100) / 100,
        timestamp: now,
        metadata: { capitalDeployed: totalSpend, revenueGenerated: totalRevenue },
      });

      await ctx.db.insert("memorySnapshots", {
        agentId: agent._id,
        dimension: "spend_velocity",
        value: Math.round(dailyAverage * 100) / 100,
        timestamp: now,
        metadata: { totalSpend: totalSpend + totalFees, dailyAverage },
      });

      await ctx.db.insert("memorySnapshots", {
        agentId: agent._id,
        dimension: "tax_liability",
        value: Math.round(taxLiability * 100) / 100,
        timestamp: now,
        metadata: { taxableRevenue: totalRevenue, taxRate: 0.15 },
      });

      totalSnapshots += 3;
    }

    return { agentsProcessed: agents.length, totalSnapshots, timestamp: Date.now() };
  },
});