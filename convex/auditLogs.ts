import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const log = mutation({
  args: {
    agentId: v.optional(v.id("agents")),
    action: v.string(),
    payload: v.any(),
    result: v.union(v.literal("success"), v.literal("failed"), v.literal("blocked")),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("auditLogs", {
      agentId: args.agentId,
      action: args.action,
      payload: args.payload,
      result: args.result,
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
      timestamp: Date.now(),
    });
    return id;
  },
});

export const getByAgent = query({
  args: {
    agentId: v.id("agents"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    const logs = await ctx.db
      .query("auditLogs")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .order("desc")
      .take(limit);
    return logs;
  },
});

export const getRecent = query({
  args: {
    limit: v.optional(v.number()),
    action: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    let query = ctx.db
      .query("auditLogs")
      .withIndex("by_timestamp");

    const logs = await query.order("desc").take(limit);

    if (args.action) {
      return logs.filter((log) => log.action === args.action);
    }
    return logs;
  },
});

export const getByAction = query({
  args: {
    action: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    const logs = await ctx.db
      .query("auditLogs")
      .withIndex("by_action", (q) => q.eq("action", args.action))
      .order("desc")
      .take(limit);
    return logs;
  },
});
