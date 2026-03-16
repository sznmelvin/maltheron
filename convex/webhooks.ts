import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const ALLOWED_EVENTS = ["transaction.settled", "agent.suspended", "tax.due"] as const;

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function generateSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const create = mutation({
  args: {
    agentId: v.id("agents"),
    url: v.string(),
    events: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    if (!isValidUrl(args.url)) {
      throw new Error("Webhook URL must be a valid HTTPS URL");
    }

    const invalidEvents = args.events.filter((e) => !ALLOWED_EVENTS.includes(e as typeof ALLOWED_EVENTS[number]));
    if (invalidEvents.length > 0) {
      throw new Error(`Invalid events: ${invalidEvents.join(", ")}. Allowed: ${ALLOWED_EVENTS.join(", ")}`);
    }

    const id = await ctx.db.insert("webhooks", {
      agentId: args.agentId,
      url: args.url,
      events: args.events,
      secret: generateSecret(),
      isActive: true,
      createdAt: Date.now(),
    });

    return id;
  },
});

export const getByAgent = query({
  args: {
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    const webhooks = await ctx.db
      .query("webhooks")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();
    return webhooks;
  },
});

export const toggle = mutation({
  args: {
    webhookId: v.id("webhooks"),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.webhookId, {
      isActive: args.isActive,
    });
  },
});

export const remove = mutation({
  args: {
    webhookId: v.id("webhooks"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.webhookId);
  },
});

export const getActiveWebhooks = query({
  args: {
    event: v.string(),
  },
  handler: async (ctx, args) => {
    if (!ALLOWED_EVENTS.includes(args.event as typeof ALLOWED_EVENTS[number])) {
      return [];
    }

    const webhooks = await ctx.db
      .query("webhooks")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();

    return webhooks.filter((w) => w.events.includes(args.event));
  },
});

export const recordTrigger = mutation({
  args: {
    webhookId: v.id("webhooks"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.webhookId, {
      lastTriggeredAt: Date.now(),
    });
  },
});
