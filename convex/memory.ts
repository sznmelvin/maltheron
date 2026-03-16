import { query } from "./_generated/server";
import { v } from "convex/values";

function getTimeframeRange(timeframe: string): { start: number; end: number } {
  const now = Date.now();
  const msInDay = 24 * 60 * 60 * 1000;

  switch (timeframe) {
    case "last_24h":
      return { start: now - msInDay, end: now };
    case "last_7d":
      return { start: now - 7 * msInDay, end: now };
    case "last_30d":
      return { start: now - 30 * msInDay, end: now };
    case "last_90d":
      return { start: now - 90 * msInDay, end: now };
    default:
      return { start: now - 7 * msInDay, end: now };
  }
}

export const queryROI = query({
  args: {
    agentId: v.id("agents"),
    timeframe: v.string(),
    context: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { start, end } = getTimeframeRange(args.timeframe);

    const allTxns = await ctx.db
      .query("transactions")
      .withIndex("by_agent_timestamp", (q) => q.eq("agentId", args.agentId))
      .collect();

    const txns = allTxns.filter((t) => t.timestamp >= start && t.timestamp <= end);

    const credits = txns.filter((t) => t.type === "credit");
    const debits = txns.filter((t) => t.type === "debit");

    const totalRevenue = credits.reduce((acc, t) => acc + t.amount, 0);
    const totalSpend = debits.reduce((acc, t) => acc + t.amount, 0);
    const capitalDeployed = totalSpend;

    const roi = capitalDeployed > 0 ? ((totalRevenue - capitalDeployed) / capitalDeployed) * 100 : 0;

    return {
      dimension: "roi" as const,
      value: Math.round(roi * 100) / 100,
      timeframe: args.timeframe,
      metadata: {
        capitalDeployed,
        revenueGenerated: totalRevenue,
        creditCount: credits.length,
        debitCount: debits.length,
      },
    };
  },
});

export const querySpendVelocity = query({
  args: {
    agentId: v.id("agents"),
    timeframe: v.string(),
    context: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { start, end } = getTimeframeRange(args.timeframe);

    const allTxns = await ctx.db
      .query("transactions")
      .withIndex("by_agent_timestamp", (q) => q.eq("agentId", args.agentId))
      .collect();

    const txns = allTxns.filter(
      (t) => t.timestamp >= start && t.timestamp <= end && (t.type === "debit" || t.type === "fee")
    );

    const totalSpend = txns.reduce((acc, t) => acc + t.amount, 0);
    const msInDay = 24 * 60 * 60 * 1000;
    const daysInRange = Math.max(1, (end - start) / msInDay);
    const dailyAverage = totalSpend / daysInRange;

    const hourlyBuckets: Record<number, number> = {};
    txns.forEach((t) => {
      const hourKey = Math.floor(t.timestamp / (60 * 60 * 1000));
      hourlyBuckets[hourKey] = (hourlyBuckets[hourKey] || 0) + t.amount;
    });

    const bucketValues = Object.values(hourlyBuckets);
    const maxHourly = Math.max(...bucketValues, 0);
    const avgHourly = bucketValues.length > 0 ? bucketValues.reduce((a, b) => a + b, 0) / bucketValues.length : 0;

    return {
      dimension: "spend_velocity" as const,
      value: Math.round(dailyAverage * 100) / 100,
      timeframe: args.timeframe,
      metadata: {
        totalSpend,
        dailyAverage: Math.round(dailyAverage * 100) / 100,
        hourlyPeak: Math.round(maxHourly * 100) / 100,
        hourlyAverage: Math.round(avgHourly * 100) / 100,
        transactionCount: txns.length,
      },
    };
  },
});

export const queryTaxLiability = query({
  args: {
    agentId: v.id("agents"),
    timeframe: v.string(),
    context: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { start, end } = getTimeframeRange(args.timeframe);

    const allTxns = await ctx.db
      .query("transactions")
      .withIndex("by_agent_timestamp", (q) => q.eq("agentId", args.agentId))
      .collect();

    const txns = allTxns.filter((t) => t.timestamp >= start && t.timestamp <= end && t.type === "credit");

    const totalRevenue = txns.reduce((acc, t) => acc + t.amount, 0);

    const TAX_RATE = 0.15;
    const liability = totalRevenue * TAX_RATE;

    return {
      dimension: "tax_liability" as const,
      value: Math.round(liability * 100) / 100,
      timeframe: args.timeframe,
      metadata: {
        taxableRevenue: totalRevenue,
        taxRate: TAX_RATE,
        transactionCount: txns.length,
        currency: txns[0]?.currency ?? "USDC",
      },
    };
  },
});

export const queryAll = query({
  args: {
    agentId: v.id("agents"),
    timeframe: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const timeframe = args.timeframe ?? "last_30d";
    const { start, end } = getTimeframeRange(timeframe);

    const allTxns = await ctx.db
      .query("transactions")
      .withIndex("by_agent_timestamp", (q) => q.eq("agentId", args.agentId))
      .collect();

    const txns = allTxns.filter((t) => t.timestamp >= start && t.timestamp <= end);

    const credits = txns.filter((t) => t.type === "credit");
    const debits = txns.filter((t) => t.type === "debit");
    const fees = txns.filter((t) => t.type === "fee");

    const totalRevenue = credits.reduce((acc, t) => acc + t.amount, 0);
    const totalSpend = debits.reduce((acc, t) => acc + t.amount, 0);
    const totalFees = fees.reduce((acc, t) => acc + t.amount, 0);

    const roi = totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : 0;
    const dailyAverage = totalSpend / Math.max(1, (end - start) / (24 * 60 * 60 * 1000));
    const taxLiability = totalRevenue * 0.15;

    return {
      roi: {
        dimension: "roi",
        value: Math.round(roi * 100) / 100,
        timeframe,
        metadata: {
          capitalDeployed: totalSpend,
          revenueGenerated: totalRevenue,
        },
      },
      velocity: {
        dimension: "spend_velocity",
        value: Math.round(dailyAverage * 100) / 100,
        timeframe,
        metadata: {
          totalSpend: totalSpend + totalFees,
          dailyAverage,
        },
      },
      tax: {
        dimension: "tax_liability",
        value: Math.round(taxLiability * 100) / 100,
        timeframe,
        metadata: {
          taxableRevenue: totalRevenue,
          taxRate: 0.15,
        },
      },
    };
  },
});