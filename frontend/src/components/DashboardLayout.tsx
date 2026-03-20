import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../hooks/useSolanaAuth";
import { useAgentMetrics, useMemoryQuery } from "../hooks/useConvex";
import { useSolanaWallet } from "../lib/SolanaProvider";
import MetricCard from "./MetricCard";
import LedgerStream from "./LedgerStream";
import ApiPlayground from "./ApiPlayground";
import WalletButton from "./WalletButton";

type TabType = "Verify SOL" | "Two-Transfer Flow" | "Financial Memory";

const TAB_CONTENT: Record<TabType, { 
  description: string; 
  steps: string[];
  code?: string;
}> = {
  "Verify SOL": {
    description: "Submit a SOL transaction hash to verify it on-chain.",
    steps: [
      "Agents send SOL via Phantom (outside Maltheron)",
      "Agents send 0.1% fee to treasury wallet",
      "Agents POST txHash to Maltheron API",
      "Maltheron verifies both transfers on-chain",
    ],
    code: `POST /v1/ledger/verify
Body: { "txHash": "signature..." }
Response: {
  "valid": true,
  "verified": true,
  "transaction": { ... }
}`,
  },
  "Two-Transfer Flow": {
    description: "How agents pay with Maltheron: main transfer + fee.",
    steps: [
      "1. Agent sends SOL to recipient via Phantom",
      "2. Agent sends 0.1% fee to treasury wallet",
      "3. Agent submits main txHash to /v1/ledger/verify",
      "4. Maltheron records if fee was paid",
    ],
  },
  "Financial Memory": {
    description: "Track ROI, spending velocity, and tax liability.",
    steps: [
      "ROI - Return on investment calculations",
      "Spend Velocity - Daily/hourly spending patterns",
      "Tax Liability - Estimated tax at 15% rate",
    ],
    code: `POST /v1/memory/query
Body: { 
  "dimension": "roi",
  "timeframe": "last_30d"
}`,
  },
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <button 
      onClick={handleCopy}
      className="font-mono text-xs text-textSecondary hover:text-textPrimary transition-colors cursor-pointer"
    >
      {copied ? "✓ copied" : "copy"}
    </button>
  );
}

export default function DashboardLayout() {
  const { agent, loading: authLoading, error, login, loginWithPhantom, logout, isAuthenticated, token } = useAuth();
  const { metrics, refresh: refreshMetrics } = useAgentMetrics(token);
  const memory = useMemoryQuery(token);
  const [timeframe, setTimeframe] = useState("last_30d");
  const [activeTab, setActiveTab] = useState<TabType>("Verify SOL");
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

  const handleConnect = async () => {
    setConnecting(true);
    await loginWithPhantom();
    setConnecting(false);
  };

  const handleTestMode = async () => {
    setConnecting(true);
    await login();
    setConnecting(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-textSecondary font-geist animate-pulse">Loading Maltheron...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    const content = TAB_CONTENT[activeTab];

    return (
      <div className="min-h-screen bg-background relative overflow-hidden flex flex-col">
        <div className="absolute top-32 right-[-10%] text-[8rem] font-geist text-textSecondary/5 whitespace-nowrap pointer-events-none select-none hidden md:block">
          M2M_OS
        </div>

        <header className="px-4 md:px-8 py-4 md:py-6 flex justify-between items-center relative z-10 shrink-0">
          <h1 className="text-xl md:text-2xl font-tiktok text-textPrimary tracking-tight">Maltheron</h1>
          <div className="flex gap-4 items-center">
            <WalletButton onConnect={handleConnect} size="sm" />
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 md:px-8 pt-8 md:pt-12 pb-32 relative z-10 flex-1 overflow-auto">
          <div className="mb-6 md:mb-8">
            <p className="text-textSecondary text-sm md:text-base font-geist mb-4">
              Agent-Native Accounting & Financial OS for the M2M economy. Built on Solana.
            </p>
            <div className="flex gap-2 flex-wrap">
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
          </div>

          <div className="bg-surface rounded-3xl p-6 md:p-8 mb-6">
            <div className="flex justify-between items-center mb-4">
              <span className="font-geist text-textSecondary text-sm">{activeTab}</span>
            </div>
            <p className="text-textPrimary font-geist mb-6">{content.description}</p>
            
            <div className="space-y-3 mb-6">
              {content.steps.map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="text-textSecondary font-mono text-sm mt-0.5">{i + 1}.</span>
                  <span className="text-textSecondary font-geist text-sm">{step}</span>
                </div>
              ))}
            </div>

            {content.code && (
              <div className="bg-background rounded-lg p-4 relative">
                <CopyButton text={content.code} />
                <pre className="font-mono text-xs text-textSecondary overflow-x-auto">
                  {content.code}
                </pre>
              </div>
            )}
          </div>

          <div className="bg-surface rounded-3xl p-6 md:p-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="font-geist text-textSecondary text-sm">Connect Wallet</span>
              <span className="text-xs font-mono text-success bg-success/10 px-2 py-0.5 rounded">
                Ready
              </span>
            </div>
            
            {error && (
              <div className="bg-error/10 border border-error/20 rounded-lg px-4 py-3 mb-4">
                <p className="text-xs font-geist text-error">{error}</p>
              </div>
            )}
            
            <p className="text-textSecondary text-sm font-geist mb-4">
              Connect your Phantom wallet to create a session. You'll be asked to sign a message.
            </p>
            
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="w-full bg-accent hover:bg-gray-800 disabled:bg-gray-400 text-white font-geist font-medium py-2.5 rounded-lg transition-colors mb-4"
            >
              {connecting ? "Connecting..." : "Connect Phantom Wallet"}
            </button>
            
            <div className="text-center text-textSecondary text-xs font-geist">
              <span>or</span>
              <button 
                onClick={handleTestMode}
                disabled={connecting}
                className="ml-2 text-textPrimary underline underline-offset-4 hover:text-textSecondary transition-colors disabled:opacity-50"
              >
                Initialize test agent
              </button>
            </div>
          </div>
        </main>

        <footer className="border-t border-border bg-surface mt-auto shrink-0">
          <div className="max-w-5xl mx-auto px-4 md:px-6 py-3 md:py-4 flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs font-geist text-textSecondary">
              Maltheron v0.1.0 • Financial OS for M2M economy
            </p>
            <p className="text-xs font-mono text-textSecondary">
              Fee: 0.1% (10 bps) • Network: Solana Mainnet
            </p>
          </div>
        </footer>
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
              Solana Mainnet
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-success"></span>
              <span className="text-xs font-mono text-success">CONNECTED</span>
            </span>
          </div>
          <div className="flex items-center gap-3 md:gap-6">
            <WalletButton onConnect={handleConnect} size="sm" />
            <div className="text-right">
              <div className="font-mono text-xs text-textSecondary">Balance</div>
              <div className="font-mono text-sm text-success">
                {(metrics?.balance ?? agent?.balance ?? 0).toFixed(4)} SOL
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
              value={`${(metrics?.balance ?? agent?.balance ?? 0).toFixed(4)} SOL`}
              change="Agent balance"
              positive={true}
            />
            <MetricCard
              title="Volume (30d)"
              value={`${(metrics?.totalVolume ?? 0).toFixed(2)} SOL`}
              change="Total processed"
              positive={true}
            />
            <MetricCard
              title="ROI (30d)"
              value={roiData ? `${roiData.value}%` : "--"}
              change={roiData?.metadata ? `Capital: ${(roiData.metadata as any).capitalDeployed?.toFixed(2) || 0}` : "Query memory"}
              positive={(Number(roiData?.value) ?? 0) >= 0}
            />
            <MetricCard
              title="Tax Liability"
              value={taxData ? `${taxData.value} SOL` : "--"}
              change={taxData?.metadata ? `Rate: ${((taxData.metadata as any).taxRate ?? 0) * 100}%` : "Unpaid"}
              positive={false}
            />
          </div>
        </section>

        <section className="bg-surface rounded-2xl p-6">
          <h2 className="font-tiktok text-lg text-textPrimary mb-4">Two-Transfer Flow</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-background rounded-xl p-4">
              <h3 className="font-geist text-sm text-textPrimary mb-3">1. Main Transfer</h3>
              <p className="text-textSecondary text-xs font-geist mb-2">
                Agent sends SOL to recipient via Phantom wallet.
              </p>
              <code className="text-xs font-mono text-accent">
                100 SOL → Recipient
              </code>
            </div>
            <div className="bg-background rounded-xl p-4">
              <h3 className="font-geist text-sm text-textPrimary mb-3">2. Fee Transfer</h3>
              <p className="text-textSecondary text-xs font-geist mb-2">
                Agent sends 0.1% fee to treasury wallet via Phantom.
              </p>
              <code className="text-xs font-mono text-accent">
                0.1 SOL → Treasury
              </code>
            </div>
          </div>
          <div className="mt-4 bg-warning/10 border border-warning/20 rounded-lg px-4 py-3">
            <p className="text-xs font-geist text-warning">
              <strong>Important:</strong> Both transfers must be confirmed on-chain before submitting txHash to Maltheron.
            </p>
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
            Fee: 0.1% (10 bps) • USDC: Coming Soon
          </p>
        </div>
      </footer>
    </div>
  );
}
