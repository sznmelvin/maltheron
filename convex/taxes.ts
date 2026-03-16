import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    agentId: v.id("agents"),
    period: v.string(),
    liability: v.number(),
    currency: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("taxStubs")
      .withIndex("by_agent_period", (q) =>
        q.eq("agentId", args.agentId).eq("period", args.period)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        liability: args.liability,
        metadata: args.metadata,
      });
      return existing._id;
    }

    const stubId = await ctx.db.insert("taxStubs", {
      agentId: args.agentId,
      period: args.period,
      liability: args.liability,
      isPaid: false,
      currency: args.currency ?? "USDC",
      createdAt: Date.now(),
      metadata: args.metadata,
    });

    return stubId;
  },
});

export const markPaid = mutation({
  args: {
    stubId: v.id("taxStubs"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.stubId, { isPaid: true });
    return await ctx.db.get(args.stubId);
  },
});

export const getByAgent = query({
  args: {
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("taxStubs")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .order("desc")
      .collect();
  },
});

export const getUnpaidByAgent = query({
  args: {
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    const stubs = await ctx.db
      .query("taxStubs")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .filter((q) => q.eq(q.field("isPaid"), false))
      .collect();
    return stubs;
  },
});

export const getTotalUnpaidLiability = query({
  args: {
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    const stubs = await ctx.db
      .query("taxStubs")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .filter((q) => q.eq(q.field("isPaid"), false))
      .collect();

    return stubs.reduce((acc, s) => acc + s.liability, 0);
  },
});

export const generateMonthlyStub = mutation({
  args: {
    agentId: v.id("agents"),
    year: v.number(),
    month: v.number(),
  },
  handler: async (ctx, args) => {
    const monthNames = [
      "january", "february", "march", "april", "may", "june",
      "july", "august", "september", "october", "november", "december"
    ];
    const period = `${monthNames[args.month - 1]}_${args.year}`;

    const startOfMonth = new Date(args.year, args.month - 1, 1).getTime();
    const endOfMonth = new Date(args.year, args.month, 0, 23, 59, 59, 999).getTime();

    const txns = await ctx.db
      .query("transactions")
      .withIndex("by_agent_timestamp", (q) => q.eq("agentId", args.agentId))
      .filter((q) =>
        q.and(
          q.gte(q.field("timestamp"), startOfMonth),
          q.lte(q.field("timestamp"), endOfMonth),
          q.eq(q.field("type"), "credit")
        )
      )
      .collect();

    const totalRevenue = txns.reduce((acc, t) => acc + t.amount, 0);
    const TAX_RATE = 0.15;
    const liability = totalRevenue * TAX_RATE;

    if (liability > 0) {
      const stubId = await ctx.db.insert("taxStubs", {
        agentId: args.agentId,
        period,
        liability,
        isPaid: false,
        currency: txns[0]?.currency ?? "USDC",
        createdAt: Date.now(),
        metadata: {
          generatedAt: Date.now(),
          revenueBase: totalRevenue,
          taxRate: TAX_RATE,
          transactionCount: txns.length,
        },
      });
      return stubId;
    }

    return null;
  },
});