import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

export const create = mutation({
  args: {
    key: v.string(),
    agentId: v.id("agents"),
    transactionHash: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("idempotencyKeys")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (existing) {
      return { 
        exists: true, 
        transactionHash: existing.transactionHash,
      };
    }

    await ctx.db.insert("idempotencyKeys", {
      key: args.key,
      agentId: args.agentId,
      transactionHash: args.transactionHash,
      createdAt: Date.now(),
      expiresAt: Date.now() + IDEMPOTENCY_TTL_MS,
    });

    return { exists: false, transactionHash: args.transactionHash };
  },
});

export const get = query({
  args: {
    key: v.string(),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("idempotencyKeys")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (!record) {
      return null;
    }

    if (record.expiresAt < Date.now()) {
      return null;
    }

    return {
      key: record.key,
      agentId: record.agentId,
      transactionHash: record.transactionHash,
      createdAt: record.createdAt,
    };
  },
});

export const cleanup = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const allKeys = await ctx.db.query("idempotencyKeys").collect();
    
    let deleted = 0;
    for (const key of allKeys) {
      if (key.expiresAt < now) {
        await ctx.db.delete(key._id);
        deleted++;
      }
    }

    return { deleted };
  },
});