import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const NONCE_TTL_MS = 5 * 60 * 1000;

export const create = mutation({
  args: {
    nonce: v.string(),
    walletAddress: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("nonces")
      .withIndex("by_nonce", (q) => q.eq("nonce", args.nonce))
      .first();

    if (existing) {
      return existing._id;
    }

    const nonceId = await ctx.db.insert("nonces", {
      nonce: args.nonce,
      walletAddress: args.walletAddress.toLowerCase(),
      expiresAt: Date.now() + NONCE_TTL_MS,
      createdAt: Date.now(),
    });

    return nonceId;
  },
});

export const validate = query({
  args: {
    nonce: v.string(),
  },
  handler: async (ctx, args) => {
    const nonceRecord = await ctx.db
      .query("nonces")
      .withIndex("by_nonce", (q) => q.eq("nonce", args.nonce))
      .first();

    if (!nonceRecord) {
      return null;
    }

    if (nonceRecord.expiresAt < Date.now()) {
      await ctx.db.delete(nonceRecord._id);
      return null;
    }

    return {
      nonce: nonceRecord.nonce,
      walletAddress: nonceRecord.walletAddress,
      expiresAt: nonceRecord.expiresAt,
    };
  },
});

export const consume = mutation({
  args: {
    nonce: v.string(),
  },
  handler: async (ctx, args) => {
    const nonceRecord = await ctx.db
      .query("nonces")
      .withIndex("by_nonce", (q) => q.eq("nonce", args.nonce))
      .first();

    if (!nonceRecord) {
      return false;
    }

    if (nonceRecord.expiresAt < Date.now()) {
      await ctx.db.delete(nonceRecord._id);
      return false;
    }

    await ctx.db.delete(nonceRecord._id);
    return true;
  },
});

export const cleanup = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const allNonces = await ctx.db.query("nonces").collect();
    
    let deleted = 0;
    for (const n of allNonces) {
      if (n.expiresAt < now) {
        await ctx.db.delete(n._id);
        deleted++;
      }
    }

    return { deleted };
  },
});
