#!/usr/bin/env bun
import "dotenv/config";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const ADMIN_WALLETS = (process.env.ADMIN_WALLETS || "")
  .split(",")
  .map((w) => w.toLowerCase().trim())
  .filter(Boolean);

function getConvexClient(): ConvexHttpClient {
  const url = process.env.CONVEX_URL || process.env.VITE_CONVEX_URL;
  if (!url) {
    console.error("Error: CONVEX_URL not set. Run `npx convex dev` first.");
    process.exit(1);
  }
  return new ConvexHttpClient(url);
}

function isValidEthAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

async function bootstrapAdmin(walletAddress: string, force: boolean = false) {
  if (!isValidEthAddress(walletAddress)) {
    console.error(`Error: Invalid Ethereum address: ${walletAddress}`);
    process.exit(1);
  }

  const convex = getConvexClient();
  const address = walletAddress.toLowerCase();

  console.log(`\n🔧 Admin Bootstrap for Maltheron`);
  console.log(`   Wallet: ${address}`);
  console.log(`   Force:  ${force}\n`);

  try {
    const existing = await convex.query(api.agents.getByWallet, { walletAddress: address });

    if (existing && !force) {
      console.log(`⚠️  Agent already exists: ${existing.tier} tier`);
      console.log(`   Use --force to update tier to admin\n`);
      
      if (existing.tier !== "admin") {
        console.log(`   Current tier: ${existing.tier}`);
        console.log(`   Run with --force to promote to admin\n`);
      }
      process.exit(0);
    }

    if (existing && force) {
      console.log(`📝 Updating existing agent to admin tier...`);
      const updated = await convex.mutation(api.agents.updateTier, {
        agentId: existing._id,
        tier: "admin",
      });
      if (updated) {
        console.log(`✅ Agent promoted to admin: ${updated.tier}\n`);
      } else {
        console.log(`✅ Agent promoted to admin\n`);
      }
      return;
    }

    console.log(`📝 Creating new admin agent...`);
    const agent = await convex.mutation(api.agents.create, {
      walletAddress: address,
      tier: "admin",
      metadata: { bootstrappedAt: Date.now(), source: "admin-bootstrap" },
    });

    if (!agent) {
      console.error(`❌ Failed to create agent\n`);
      process.exit(1);
    }

    console.log(`✅ Admin agent created successfully!`);
    console.log(`   Agent ID: ${agent._id}`);
    console.log(`   Wallet:   ${agent.walletAddress}`);
    console.log(`   Tier:     ${agent.tier}`);
    console.log(`   Status:   ${agent.status}\n`);
    
    console.log(`📝 Next steps:`);
    console.log(`   1. Set ADMIN_WALLETS=${address} in your environment`);
    console.log(`   2. Restart the backend server`);
    console.log(`   3. Authenticate at POST /v1/auth/session to get admin access\n`);

  } catch (error) {
    console.error(`❌ Error: ${error}`);
    process.exit(1);
  }
}

async function listAdmins() {
  const convex = getConvexClient();
  
  console.log(`\n👥 Registered Agents\n`);
  
  try {
    const agents = await convex.query(api.agents.getAll, { limit: 100 });
    
    if (agents.length === 0) {
      console.log(`   No agents found\n`);
      return;
    }

    const admins = agents.filter(a => a.tier === "admin");
    const others = agents.filter(a => a.tier !== "admin");

    if (admins.length > 0) {
      console.log(`   Admins (${admins.length}):`);
      admins.forEach(a => console.log(`     - ${a.walletAddress}`));
      console.log();
    }

    if (others.length > 0) {
      console.log(`   Other Agents (${others.length}):`);
      others.forEach(a => console.log(`     - ${a.walletAddress} [${a.tier}]`));
      console.log();
    }
  } catch (error) {
    console.error(`❌ Error: ${error}`);
    process.exit(1);
  }
}

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(`
🔧 Maltheron Admin Bootstrap CLI

Usage:
  bun run admin:bootstrap <wallet>      Create admin agent
  bun run admin:bootstrap --list       List all agents
  bun run admin:bootstrap --help        Show this help

Options:
  <wallet>   Ethereum wallet address (0x...)
  --force   Update existing agent to admin
  --list    List all registered agents

Examples:
  bun run admin:bootstrap 0x742d35Cc6634C0532925a3b844Bc9e7595f0eB1E
  bun run admin:bootstrap 0x742d35Cc6634C0532925a3b844Bc9e7595f0eB1E --force
  bun run admin:bootstrap --list

Environment:
  CONVEX_URL     Convex deployment URL
  ADMIN_WALLETS  Comma-separated admin wallets (checked on creation)
`);
  process.exit(0);
}

if (args.includes("--list")) {
  listAdmins();
  process.exit(0);
}

if (args.length === 0) {
  console.error(`Error: Missing wallet address`);
  console.error(`Run 'bun run admin:bootstrap --help' for usage\n`);
  process.exit(1);
}

const wallet = args[0];
const force = args.includes("--force");

bootstrapAdmin(wallet, force);
