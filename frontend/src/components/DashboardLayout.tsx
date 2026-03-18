import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../hooks/useSolanaAuth";
import { useAgentMetrics, useMemoryQuery } from "../hooks/useConvex";
import { useSolanaWallet } from "../lib/SolanaProvider";
import MetricCard from "./MetricCard";
import LedgerStream from "./LedgerStream";
import ApiPlayground from "./ApiPlayground";
import WalletButton from "./WalletButton";

type TabType = "Maltheron Core" | "x402 Protocol" | "AP2 Sync" | "Memory";

const TAB_CONTENT: Record<TabType, { json: string; terminal: { command: string; description: string } }> = {
  "Maltheron Core": {
    json: `{
  "agentConfig": {
    "maltheron": {
      "protocol": "x402",
      "autoSettle": true,
      "taxEngine": "autonomous"
    },
    "env": {
      "NETWORK": "base-sepolia",
      "FEE_TIER": "standard",
      "RPC_ENDPOINT": "wss://api.maltheron.network"
    }
  }
}`,
    terminal: {
      command: "$ bunx maltheron init agent --network base-sepolia",
      description: "Initialize a new agent with Base Sepolia testnet configuration.",
    },
  },
  "x402 Protocol": {
    json: `{
  "protocol": {
    "version": "2.0",
    "spec": "https://x402.org/spec",
    "payment": {
      "currency": "USDC",
      "chain": "base-sepolia",
      "settlement": "per-request"
    },
    "headers": {
      "402-Payment-Required": {
        "amount": "0.01",
        "recipient": "0x..."
      }
    }
  }
}`,
    terminal: {
      command: "$ curl -H '402-Payment-Required: amount=0.01' https://api.maltheron.network/data",
      description: "Make a micropayment request using x402 protocol headers.",
    },
  },
  "AP2 Sync": {
    json: `{
  "ap2": {
    "endpoint": "wss://api.maltheron.network/sync",
    "protocol": "websocket",
    "authentication": {
      "type": "siwe",
      "wallet": "0x..."
    },
    "features": {
      "realTimeLedger": true,
      "autoReconciliation": true
    }
  }
}`,
    terminal: {
      command: "$ bunx maltheron sync --mode ap2 --wallet 0x...",
      description: "Sync ledger state via AP2 WebSocket protocol.",
    },
  },
  "Memory": {
    json: `{
  "memory": {
    "dimensions": ["roi", "spend_velocity", "tax_liability"],
    "aggregation": "rolling_30d",
    "queries": {
      "roi": "SELECT (revenue - spend) / spend * 100",
      "velocity": "SELECT SUM(amount) / days",
      "tax": "SELECT revenue * 0.15"
    }
  }
}`,
    terminal: {
      command: "$ maltheron memory query --dimension roi --timeframe 30d",
      description: "Query financial memory metrics for the last 30 days.",
    },
  },
};

function CopyButton({ text, onCopy }: { text: string; onCopy?: (text: string) => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      onCopy?.(text);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <button 
      onClick={handleCopy}
      className="font-geist text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:text-textPrimary cursor-pointer"
    >
      {copied ? "copied!" : "copy"}
    </button>
  );
}

export default function DashboardLayout() {
  const { agent, loading: authLoading, login, logout, isAuthenticated, token } = useAuth();
  const { connected, address } = useSolanaWallet();
  const { metrics, refresh: refreshMetrics } = useAgentMetrics(token);
  const memory = useMemoryQuery(token);
  const [timeframe, setTimeframe] = useState("last_30d");
  const [activeTab, setActiveTab] = useState<TabType>("Maltheron Core");
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (token && isAuthenticated) {
      refreshMetrics();
    }
  }, [token, isAuthenticated, refreshMetrics]);

  useEffect(() => {
    if (token && isAuthenticated) {
      memory.query("roi", timeframe);
      memory.query("tax_liability", timeframe);
    }
  }, [token, isAuthenticated, timeframe, memory.query]);

  const handleWalletConnect = useCallback(async (walletAddress: string) => {
    setConnecting(true);
    try {
      const { login } = useAuth();
      await login();
    } catch (error) {
      console.error('Wallet connection error:', error);
    } finally {
      setConnecting(false);
    }
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-textSecondary font-geist animate-pulse">Loading OS...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    const content = TAB_CONTENT[activeTab];

    return (
      <div className="min-h-screen bg-background relative overflow-hidden flex flex-col">
        <div className="absolute top-32 right-[-10%] text-[8rem] font-geist text-textSecondary/5 whitespace-nowrap pointer-events-none select-none hidden md:block">
          M2M_OS // 0x402
        </div>

        <div className="absolute top-0 right-0 w-1/4 h-full bg-stripe-pattern opacity-50 pointer-events-none hidden md:block"></div>

        <header className="px-4 md:px-8 py-4 md:py-6 flex justify-between items-center relative z-10 shrink-0">
          <h1 className="text-xl md:text-2xl font-tiktok text-textPrimary tracking-tight">Maltheron</h1>
          <div className="flex gap-4 items-center">
            <WalletButton onConnect={handleWalletConnect} size="sm" />
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 md:px-8 pt-8 md:pt-12 pb-32 relative z-10 flex-1 overflow-auto">
          <div className="flex gap-2 mb-6 md:mb-8 flex-wrap">
            {(Object.keys(TAB_CONTENT) as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 md:px-4 py-1.5 rounded-lg font-geist text-xs md:text-sm transition-colors duration-200 whitespace-nowrap ${
                  activeTab === tab
                    ? "bg-[#dcdcdc] text-textPrimary"
                    : "text-textSecondary hover:text-textPrimary"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="bg-surface rounded-3xl p-4 md:p-8 mb-6 relative group">
            <div className="flex justify-between items-center mb-4 md:mb-6">
              <span className="font-geist text-textSecondary text-sm">.agent.json</span>
              <CopyButton text={content.json} />
            </div>
            <pre className="font-mono text-xs md:text-sm text-textSecondary leading-relaxed overflow-x-auto whitespace-pre-wrap">
{content.json}
            </pre>
          </div>

          <div className="bg-surface rounded-3xl p-4 md:p-8 relative group">
            <div className="flex justify-between items-center mb-4 md:mb-6">
              <span className="font-geist text-textSecondary text-sm">Terminal</span>
              <CopyButton text={content.terminal.command} />
            </div>
            
            <div className="flex flex-col gap-3 md:gap-4 font-mono text-xs md:text-sm">
              <div className="text-textSecondary">
                <span className="text-textPrimary mr-2">$</span> {content.terminal.command}
              </div>
              
              <div className="text-textSecondary mt-2 md:mt-4 text-xs font-tiktok flex items-center gap-2 flex-wrap">
                <span className="shrink-0">{content.terminal.description}</span>
                <span className="ml-auto">
                  {connecting ? (
                    <span className="text-textSecondary">Authenticating...</span>
                  ) : connected ? (
                    <button 
                      onClick={() => handleWalletConnect(address || "")}
                      className="text-textPrimary underline underline-offset-4 hover:text-textSecondary transition-colors font-tiktok"
                    >
                      Click to sign in ↗
                    </button>
                  ) : (
                    <WalletButton onConnect={handleWalletConnect} size="sm" />
                  )}
                </span>
              </div>

              <div className="text-textSecondary mt-4 pt-4 border-t border-border/30 text-xs">
                Or use test mode:
                <button 
                  onClick={login}
                  className="ml-2 text-textPrimary underline underline-offset-4 hover:text-textSecondary transition-colors font-tiktok"
                >
                  Initialize test agent ↗
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const roiData = memory.data?.dimension === "roi" ? memory.data : null;
  const taxData = memory.data?.dimension === "tax_liability" ? memory.data : null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-surface/80 backdrop-blur-sm sticky top-0 z-50 shrink-0">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-3 md:py-4 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 md:gap-4 flex-wrap">
            <h1 className="text-lg md:text-xl font-tiktok text-textPrimary">Maltheron</h1>
            <span className="text-xs font-mono text-textSecondary bg-background px-2 py-1 rounded">
              {agent?.tier?.toUpperCase() || "STANDARD"}
            </span>
            <span className="text-xs font-mono text-textSecondary bg-background px-2 py-1 rounded">
              Solana Devnet
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-success"></span>
              <span className="text-xs font-mono text-success">CONNECTED</span>
            </span>
          </div>
          <div className="flex items-center gap-3 md:gap-6">
            <WalletButton onConnect={handleWalletConnect} size="sm" />
            <div className="text-right">
              <div className="font-mono text-xs text-textSecondary">Balance</div>
              <div className="font-mono text-sm text-success">
                {metrics?.balance?.toFixed(2) || agent?.balance?.toFixed(2) || "0.00"} USDC
              </div>
            </div>
            <button
              onClick={logout}
              className="text-xs font-geist text-textSecondary hover:text-textPrimary transition-colors duration-150"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-12 pb-32 space-y-8 md:space-y-12 flex-1">
        <section>
          <div className="flex items-center justify-between mb-4 md:mb-6 flex-wrap gap-4">
            <h2 className="font-tiktok text-lg text-textPrimary">Network Overview</h2>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="bg-surface border border-border rounded px-3 py-1.5 text-xs font-mono text-textSecondary focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="last_24h">Last 24 Hours</option>
              <option value="last_7d">Last 7 Days</option>
              <option value="last_30d">Last 30 Days</option>
              <option value="last_90d">Last 90 Days</option>
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Balance"
              value={`${(metrics?.balance ?? agent?.balance ?? 0).toFixed(2)} USDC`}
              change={metrics?.balance && metrics.balance > 0 ? "+0.00%" : "Active"}
              positive={true}
            />
            <MetricCard
              title="Volume (30d)"
              value={`${(metrics?.totalVolume ?? 0).toFixed(2)} USDC`}
              change="Total processed"
              positive={true}
            />
            <MetricCard
              title="ROI (30d)"
              value={roiData ? `${roiData.value}%` : "--"}
              change={roiData?.metadata ? `Capital: $${(roiData.metadata as any).capitalDeployed?.toFixed(2) || 0}` : "Query memory"}
              positive={(roiData?.value ?? 0) >= 0}
            />
            <MetricCard
              title="Tax Liability"
              value={taxData ? `${taxData.value} USDC` : "--"}
              change={taxData?.metadata ? `Rate: ${((taxData.metadata as any).taxRate ?? 0) * 100}%` : "Unpaid"}
              positive={false}
            />
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
          <LedgerStream agentId={agent?.id} token={token} />
          <ApiPlayground agent={agent} token={token} />
        </section>
      </main>

      <footer className="border-t border-border bg-surface mt-auto shrink-0">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-3 md:py-4 flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs font-geist text-textSecondary">
            Maltheron v0.1.0 • The financial operating system for the M2M economy
          </p>
          <p className="text-xs font-mono text-textSecondary">
            Fee: 0.1% (10 bps) on all transactions
          </p>
        </div>
      </footer>
    </div>
  );
}