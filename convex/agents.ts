import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const ADMIN_WALLETS = (process.env.ADMIN_WALLETS || "")
  .split(",")
  .map((w) => w.toLowerCase().trim())
  .filter(Boolean);

export function isAdminWallet(walletAddress: string): boolean {
  return ADMIN_WALLETS.includes(walletAddress.toLowerCase());
}

export const create = mutation({
  args: {
    walletAddress: v.string(),
    tier: v.optional(v.union(v.literal("standard"), v.literal("development"), v.literal("admin"))),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("agents")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", args.walletAddress))
      .first();

    if (existing) {
      return existing;
    }

    let tier: "standard" | "development" | "admin" = args.tier ?? "standard";
    if (isAdminWallet(args.walletAddress)) {
      tier = "admin";
    }

    const agentId = await ctx.db.insert("agents", {
      walletAddress: args.walletAddress,
      status: "active",
      balance: 0,
      tier,
      createdAt: Date.now(),
      metadata: args.metadata,
    });

    return await ctx.db.get(agentId);
  },
});

export const getByWallet = query({
  args: {
    walletAddress: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agents")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", args.walletAddress))
      .first();
  },
});

export const getById = query({
  args: {
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.agentId);
  },
});

export const updateBalance = mutation({
  args: {
    agentId: v.id("agents"),
    balance: v.number(),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.agentId);
    
    if (!agent) {
      throw new Error("Agent not found");
    }

    await ctx.db.patch(args.agentId, { balance: args.balance });
    return await ctx.db.get(args.agentId);
  },
});

export const updateStatus = mutation({
  args: {
    agentId: v.id("agents"),
    status: v.union(v.literal("active"), v.literal("suspended")),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.agentId);
    
    if (!agent) {
      throw new Error("Agent not found");
    }

    await ctx.db.patch(args.agentId, { status: args.status });
    return await ctx.db.get(args.agentId);
  },
});

export const updateTier = mutation({
  args: {
    agentId: v.id("agents"),
    tier: v.union(v.literal("standard"), v.literal("development"), v.literal("admin")),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.agentId);
    
    if (!agent) {
      throw new Error("Agent not found");
    }

    await ctx.db.patch(args.agentId, { tier: args.tier });
    return await ctx.db.get(args.agentId);
  },
});

export const getAll = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    return await ctx.db.query("agents").take(limit);
  },
});

export const getActiveCount = query({
  args: {},
  handler: async (ctx) => {
    const agents = await ctx.db
      .query("agents")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    return agents.length;
  },
});