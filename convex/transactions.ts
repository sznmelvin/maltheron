import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const FEE_BPS = 10;
const ALLOWED_CURRENCIES = ["USDC"];
const MAX_TRANSACTION_AMOUNT = 1_000_000;

function isValidCurrency(currency: string): boolean {
  return ALLOWED_CURRENCIES.includes(currency.toUpperCase());
}

function sanitizeMetadata(metadata: unknown): Record<string, unknown> {
  if (typeof metadata !== "object" || metadata === null) {
    return {};
  }
  return metadata as Record<string, unknown>;
}

export const record = mutation({
  args: {
    agentId: v.id("agents"),
    amount: v.number(),
    currency: v.string(),
    type: v.string(),
    metadata: v.any(),
    protocol: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.agentId);
    
    if (!agent) {
      throw new Error("Agent not found");
    }
    
    if (agent.status === "suspended") {
      throw new Error("Agent is suspended");
    }

    if (!isValidCurrency(args.currency)) {
      throw new Error(`Only ${ALLOWED_CURRENCIES.join(", ")} is supported`);
    }

    if (args.amount <= 0) {
      throw new Error("Amount must be positive");
    }

    if (args.amount > MAX_TRANSACTION_AMOUNT) {
      throw new Error(`Amount exceeds maximum of ${MAX_TRANSACTION_AMOUNT}`);
    }

    const sanitizedMetadata = sanitizeMetadata(args.metadata);

    const feeAmount = (args.amount * FEE_BPS) / 10000;
    const netAmount = args.amount - feeAmount;

    const txId = await ctx.db.insert("transactions", {
      agentId: args.agentId,
      amount: netAmount,
      currency: args.currency.toUpperCase(),
      type: args.type as "credit" | "debit",
      metadata: sanitizedMetadata,
      timestamp: Date.now(),
      hash: `txn_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
      protocol: args.protocol,
      status: "settled",
    });

    if (feeAmount > 0) {
      await ctx.db.insert("transactions", {
        agentId: args.agentId,
        amount: feeAmount,
        currency: args.currency.toUpperCase(),
        type: "fee",
        metadata: { sourceTx: txId, type: "network_compute_fee" },
        timestamp: Date.now(),
        hash: `fee_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
        protocol: args.protocol,
        status: "settled",
      });
    }

    const balanceChange = args.type === "credit" ? netAmount : -netAmount - feeAmount;
    await ctx.db.patch(args.agentId, {
      balance: agent.balance + balanceChange,
    });

    return { hash: txId, fee: feeAmount, netAmount };
  },
});

export const getRecent = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const txns = await ctx.db
      .query("transactions")
      .withIndex("by_timestamp")
      .order("desc")
      .take(limit);
    return txns;
  },
});

export const getByAgent = query({
  args: {
    agentId: v.id("agents"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const txns = await ctx.db
      .query("transactions")
      .withIndex("by_agent_timestamp", (q) => q.eq("agentId", args.agentId))
      .order("desc")
      .take(limit);
    return txns;
  },
});

export const getByAgentAndTimeframe = query({
  args: {
    agentId: v.id("agents"),
    startTime: v.number(),
    endTime: v.number(),
  },
  handler: async (ctx, args) => {
    const txns = await ctx.db
      .query("transactions")
      .withIndex("by_agent_timestamp", (q) =>
        q.eq("agentId", args.agentId).gte("timestamp", args.startTime).lte("timestamp", args.endTime)
      )
      .collect();
    return txns;
  },
});

export const getTotalVolume = query({
  args: {
    agentId: v.optional(v.id("agents")),
    startTime: v.optional(v.number()),
    endTime: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let txns;
    
    if (args.agentId !== undefined) {
      txns = await ctx.db
        .query("transactions")
        .withIndex("by_agent", (q) => q.eq("agentId", args.agentId!))
        .collect();
    } else {
      txns = await ctx.db.query("transactions").collect();
    }

    let filtered = txns;
    if (args.startTime !== undefined && args.endTime !== undefined) {
      filtered = txns.filter((t) => t.timestamp >= args.startTime! && t.timestamp <= args.endTime!);
    }

    const volume = filtered.reduce((acc, t) => acc + t.amount, 0);
    return volume;
  },
});

export const getFeeRevenue = query({
  args: {},
  handler: async (ctx) => {
    const fees = await ctx.db
      .query("transactions")
      .withIndex("by_type", (q) => q.eq("type", "fee"))
      .collect();
    return fees.reduce((acc, f) => acc + f.amount, 0);
  },
});