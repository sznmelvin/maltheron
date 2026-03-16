import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  agents: defineTable({
    walletAddress: v.string(),
    status: v.union(v.literal("active"), v.literal("suspended")),
    balance: v.number(),
    tier: v.union(v.literal("standard"), v.literal("development"), v.literal("admin")),
    createdAt: v.number(),
    metadata: v.optional(v.any()),
  })
    .index("by_wallet", ["walletAddress"])
    .index("by_status", ["status"]),

  transactions: defineTable({
    agentId: v.id("agents"),
    amount: v.number(),
    currency: v.string(),
    type: v.union(v.literal("credit"), v.literal("debit"), v.literal("fee")),
    metadata: v.any(),
    timestamp: v.number(),
    hash: v.string(),
    protocol: v.optional(v.string()),
    status: v.optional(v.union(v.literal("pending"), v.literal("settled"), v.literal("failed"))),
  })
    .index("by_agent", ["agentId"])
    .index("by_timestamp", ["timestamp"])
    .index("by_agent_timestamp", ["agentId", "timestamp"])
    .index("by_type", ["type"]),

  taxStubs: defineTable({
    agentId: v.id("agents"),
    period: v.string(),
    liability: v.number(),
    isPaid: v.boolean(),
    currency: v.string(),
    createdAt: v.number(),
    metadata: v.optional(v.any()),
  })
    .index("by_agent_period", ["agentId", "period"])
    .index("by_agent", ["agentId"]),

  sessions: defineTable({
    agentId: v.id("agents"),
    token: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_agent", ["agentId"]),

  memorySnapshots: defineTable({
    agentId: v.id("agents"),
    dimension: v.string(),
    value: v.number(),
    timestamp: v.number(),
    metadata: v.optional(v.any()),
  })
    .index("by_agent_dimension", ["agentId", "dimension"])
    .index("by_agent_timestamp", ["agentId", "timestamp"]),

  nonces: defineTable({
    nonce: v.string(),
    walletAddress: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_nonce", ["nonce"])
    .index("by_wallet", ["walletAddress"]),

  idempotencyKeys: defineTable({
    key: v.string(),
    agentId: v.id("agents"),
    transactionHash: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_agent", ["agentId"]),

  auditLogs: defineTable({
    agentId: v.optional(v.id("agents")),
    action: v.string(),
    payload: v.any(),
    result: v.union(v.literal("success"), v.literal("failed"), v.literal("blocked")),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("by_agent", ["agentId"])
    .index("by_timestamp", ["timestamp"])
    .index("by_action", ["action"]),

  webhooks: defineTable({
    agentId: v.id("agents"),
    url: v.string(),
    events: v.array(v.string()),
    secret: v.string(),
    isActive: v.boolean(),
    createdAt: v.number(),
    lastTriggeredAt: v.optional(v.number()),
  })
    .index("by_agent", ["agentId"])
    .index("by_active", ["isActive"]),
});