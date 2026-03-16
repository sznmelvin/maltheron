# Production Deployment Guide

This guide covers deploying Maltheron to production.

## Prerequisites

- [Bun](https://bun.sh) v1.3+
- Node.js v18+ (for Convex CLI)
- GitHub account (for deployment)
- Cloud provider account (Render or Railway)

## Environment Variables

### Required

```bash
# Convex
CONVEX_URL=https://your-deployment.convex.cloud
VITE_CONVEX_URL=https://your-deployment.convex.cloud

# Security
BETTER_AUTH_SECRET=$(openssl rand -base64 32)
NODE_ENV=production
LOG_LEVEL=info

# CORS - your frontend domain(s)
ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com
```

### Optional

```bash
# Admin wallets (comma-separated, no spaces)
ADMIN_WALLETS=0x...,0x...

# Monitoring (optional but recommended)
SENTRY_DSN=https://...@sentry.io/...
```

## Deployment Steps

### 1. Configure Convex Production

```bash
# Set ADMIN_WALLETS for Convex (comma-separated)
export ADMIN_WALLETS=0x...,0x...

# Deploy Convex to production
npx convex deploy --env ADMIN_WALLETS

# Or set via Convex dashboard: Settings > Environment Variables
# Add ADMIN_WALLETS with your admin wallet addresses

# Update your CONVEX_URL to the production deployment
```

### 2. Build Backend

```bash
bun run build:backend
```

### 3. Deploy to Render

1. Push code to GitHub
2. Create new Web Service on Render
3. Configure:
   - **Build Command**: `bun install && bun run build:backend`
   - **Start Command**: `bun run dist/index.js`
   - **Environment**: `bun`
4. Add all environment variables

### 4. Deploy to Railway

1. Push code to GitHub
2. Create new project on Railway
3. Connect GitHub repository
4. Add environment variables in Railway dashboard
5. Deploy

### 5. Verify Deployment

```bash
# Check health endpoint
curl https://your-domain.com/v1/health

# Should return:
# {
#   "status": "healthy",
#   "timestamp": "...",
#   "checks": {
#     "convex": { "status": "ok", "latency": ... },
#     "base_rpc": { "status": "ok", "latency": ... }
#   }
# }
```

## Security Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Set `LOG_LEVEL=info`
- [ ] Configure `ALLOWED_ORIGINS` with your frontend domain
- [ ] Generate new `BETTER_AUTH_SECRET` with `openssl rand -base64 32`
- [ ] Deploy Convex to production with `npx convex deploy`
- [ ] Update `CONVEX_URL` to production deployment
- [ ] Enable HTTPS on your hosting platform
- [ ] Configure admin wallets via `ADMIN_WALLETS`
- [ ] (Optional) Set up Sentry for error tracking

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| Global | 100 req/min |
| Auth | 10 req/min |
| Ledger | 50 req/min |
| Memory | 50 req/min |
| Agents | 30 req/min |
| Admin | 60 req/min |
| Webhooks | 30 req/min |
