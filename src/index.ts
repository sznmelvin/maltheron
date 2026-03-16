import "dotenv/config";
import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import pino from "pino";
import { authRoutes } from "./routes/auth";
import { ledgerRoutes } from "./routes/ledger";
import { memoryRoutes } from "./routes/memory";
import { agentRoutes } from "./routes/agents";
import { adminRoutes } from "./routes/admin";
import { webhookRoutes } from "./routes/webhooks";
import { schedulerRoutes } from "./routes/scheduler";
import { healthRoutes } from "./routes/health";
import { globalRateLimit } from "./lib/rate-limit";
import { initSentry } from "./lib/sentry";

const NODE_ENV = process.env.NODE_ENV || "development";

initSentry();

export const logger = pino({
  level: process.env.LOG_LEVEL || (NODE_ENV === "production" ? "info" : "debug"),
  transport: NODE_ENV === "development" ? {
    target: "pino-pretty",
    options: { colorize: true }
  } : undefined
});

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 
  (NODE_ENV === "production" ? "" : "http://localhost:5173,http://localhost:3000"))
  .split(",")
  .map(o => o.trim())
  .filter(Boolean);

const CSP_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "connect-src 'self' https://*.convex.cloud https://*.base.org wss://*.base.org",
  "font-src 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join("; ");

const MAX_BODY_SIZE = 100 * 1024; // 100KB

const CONVEX_URL = process.env.CONVEX_URL || process.env.VITE_CONVEX_URL;
const isConfigured = CONVEX_URL && CONVEX_URL !== "https://placeholder.convex.cloud";

const app = new Elysia();

function generateRequestId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

if (NODE_ENV === "production") {
  app.use(globalRateLimit);
}

app.onBeforeHandle(({ request, set }) => {
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength) > MAX_BODY_SIZE) {
    set.status = 413;
    return { error: "Payload too large", maxSize: "100KB" };
  }
});

app.use(
  cors({
      origin: ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : false,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      maxAge: 86400,
    })
);

app
  .derive(({ headers, set }) => {
    const securityHeaders: Record<string, string> = {
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "X-XSS-Protection": "1; mode=block",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
      "Content-Security-Policy": CSP_POLICY,
    };

    if (NODE_ENV === "production") {
      const proto = headers["x-forwarded-proto"] || headers["X-Forwarded-Proto"];
      if (proto !== "https") {
        logger.warn({ proto, ip: headers["x-forwarded-for"] }, "Non-HTTPS request received");
      }
    }

    for (const [key, value] of Object.entries(securityHeaders)) {
      set.headers[key] = value;
    }
  })
  .onRequest(({ request, set }) => {
    const requestId = generateRequestId();
    set.headers["x-request-id"] = requestId;
    const start = Date.now();
    return () => {
      logger.debug({ 
        requestId,
        method: request.method, 
        url: request.url, 
        duration: Date.now() - start 
      }, "request completed");
    };
  })
  .get("/", ({ set }) => {
    set.headers["X-Content-Type-Options"] = "nosniff";
    return {
      name: "Maltheron",
      version: "0.1.0",
      description: "The financial operating system for the M2M economy",
      status: isConfigured ? "configured" : "not_configured",
      environment: NODE_ENV,
      message: isConfigured
        ? "API is running. Connect your dashboard."
        : "Run `npx convex dev` first to configure Convex.",
      endpoints: {
        health: {
          "GET /v1/health": "Health check (Convex connectivity)",
        },
        auth: {
          "POST /v1/auth/session": "Create session with wallet signature",
          "GET /v1/auth/me": "Get current agent info",
          "POST /v1/auth/logout": "Invalidate session",
        },
        ledger: {
          "POST /v1/ledger/transact": "Record x402/AP2 transaction",
          "GET /v1/ledger/recent": "Get recent transactions",
          "GET /v1/ledger/agent/:id": "Get agent transactions",
          "GET /v1/ledger/volume": "Get total transaction volume",
          "GET /v1/ledger/fees": "Get total fee revenue",
        },
        memory: {
          "POST /v1/memory/query": "Query financial memory (roi/spend_velocity/tax_liability)",
          "GET /v1/memory/all": "Get all memory dimensions",
          "GET /v1/memory/tax/stubs": "Get tax stubs",
          "GET /v1/memory/tax/unpaid": "Get unpaid tax liability",
        },
        agents: {
          "GET /v1/agents/:id": "Get agent by ID",
          "GET /v1/agents": "List all agents",
          "GET /v1/agents/stats/count": "Get active agent count",
        },
      },
      security: {
        rateLimit: "100 req/min (global), 10 req/min (auth), 50 req/min (ledger)",
        cors: ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : "deny all",
        csp: "enabled",
        hsts: "max-age=31536000; includeSubDomains",
      },
    };
  })
  .use(healthRoutes)
  .use(authRoutes)
  .use(ledgerRoutes)
  .use(memoryRoutes)
  .use(agentRoutes)
  .use(adminRoutes)
  .use(webhookRoutes)
  .use(schedulerRoutes)
  .onError(({ code, error, set }) => {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error({ code, error: errorMsg, stack: errorStack }, "request error");

    if (code === "VALIDATION") {
      set.status = 400;
      return { error: "Validation error", details: errorMsg };
    }

    if (code === "NOT_FOUND") {
      set.status = 404;
      return { error: "Not found" };
    }

    if (errorMsg.includes("CONVEX_URL")) {
      set.status = 503;
      return {
        error: "Service unavailable",
        message: "Convex not configured. Run `npx convex dev` first.",
      };
    }

    set.status = 500;
    return { error: "Internal server error" };
  })
  .listen(3000);

const port = app.server?.port;
logger.info({ port, nodeEnv: NODE_ENV }, "Maltheron Core started");

if (!isConfigured) {
  logger.warn("Convex not configured. Run 'npx convex dev' first");
}

console.log(`\n🦊 Maltheron Core routing on port ${port}`);
console.log(`   Environment: ${NODE_ENV}`);
console.log(`   API: http://localhost:${port}/v1`);
console.log(`   Dashboard: http://localhost:5173`);
if (!isConfigured) {
  console.log(`\n   ⚠️  Run 'npx convex dev' first to configure Convex\n`);
}
