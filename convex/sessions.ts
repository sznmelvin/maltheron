import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const createSession = mutation({
  args: {
    agentId: v.id("agents"),
    token: v.string(),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("sessions")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();

    for (const s of existing) {
      await ctx.db.delete(s._id);
    }

    const sessionExpiry = args.expiresAt || (Date.now() + SESSION_DURATION_MS);

    const sessionId = await ctx.db.insert("sessions", {
      agentId: args.agentId,
      token: args.token,
      expiresAt: sessionExpiry,
      createdAt: Date.now(),
    });

    return sessionId;
  },
});

export const validateSession = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!session) {
      return null;
    }

    if (session.expiresAt < Date.now()) {
      return null;
    }

    const agent = await ctx.db.get(session.agentId);
    return agent;
  },
});

export const deleteSession = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (session) {
      await ctx.db.delete(session._id);
    }

    return true;
  },
});

export const getAgentFromToken = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!session || session.expiresAt < Date.now()) {
      return null;
    }

    return await ctx.db.get(session.agentId);
  },
});

export const getSession = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!session) {
      return null;
    }

    return {
      agentId: session.agentId,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
    };
  },
});