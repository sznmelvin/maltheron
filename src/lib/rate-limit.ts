import { rateLimit } from "elysia-rate-limit";

const NODE_ENV = process.env.NODE_ENV || "development";

function getClientIp(request: Request): string {
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() ?? "anonymous";
}

export { getClientIp };

export const globalRateLimit = NODE_ENV === "production"
  ? rateLimit({
      max: 100,
      duration: 60 * 1000,
      generator: (request) => getClientIp(request),
    })
  : (app: any) => app;

export const authRateLimit = NODE_ENV === "production"
  ? rateLimit({
      max: 10,
      duration: 60 * 1000,
      generator: (request) => getClientIp(request),
    })
  : (app: any) => app;

export const ledgerRateLimit = NODE_ENV === "production"
  ? rateLimit({
      max: 50,
      duration: 60 * 1000,
      generator: (request) => getClientIp(request),
    })
  : (app: any) => app;

export const memoryRateLimit = NODE_ENV === "production"
  ? rateLimit({
      max: 50,
      duration: 60 * 1000,
      generator: (request) => getClientIp(request),
    })
  : (app: any) => app;

export const agentRateLimit = NODE_ENV === "production"
  ? rateLimit({
      max: 30,
      duration: 60 * 1000,
      generator: (request) => getClientIp(request),
    })
  : (app: any) => app;

export const adminRateLimit = NODE_ENV === "production"
  ? rateLimit({
      max: 60,
      duration: 60 * 1000,
      generator: (request) => getClientIp(request),
    })
  : (app: any) => app;

export const webhooksRateLimit = NODE_ENV === "production"
  ? rateLimit({
      max: 30,
      duration: 60 * 1000,
      generator: (request) => getClientIp(request),
    })
  : (app: any) => app;