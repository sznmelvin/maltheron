import { useState } from "react";

interface Agent {
  id: string;
  walletAddress: string;
  balance: number;
  tier: string;
  status: string;
}

interface ApiPlaygroundProps {
  agent?: Agent | null;
  token?: string | null;
}

type Tab = "transact" | "memory" | "account";

export default function ApiPlayground({ agent, token }: ApiPlaygroundProps) {
  const [activeTab, setActiveTab] = useState<Tab>("transact");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [transactForm, setTransactForm] = useState({
    targetWallet: "",
    amount: 100,
    currency: "USDC",
  });

  const [memoryForm, setMemoryForm] = useState({
    dimension: "roi" as "roi" | "spend_velocity" | "tax_liability",
    timeframe: "last_30d",
  });

  const executeTransact = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/v1/ledger/transact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          payload: {
            targetWallet: transactForm.targetWallet || agent?.walletAddress || "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsN",
            amount: transactForm.amount,
            currency: transactForm.currency,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Transaction failed");
      } else {
        setResult(data);
      }
    } catch (err) {
      setError("Request failed");
    } finally {
      setLoading(false);
    }
  };

  const executeMemoryQuery = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/v1/memory/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(memoryForm),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Query failed");
      } else {
        setResult(data);
      }
    } catch {
      setError("Request failed");
    } finally {
      setLoading(false);
    }
  };

  const fetchAccountInfo = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/v1/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to fetch account");
      } else {
        setResult(data);
      }
    } catch {
      setError("Request failed");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <div className="border-b border-border px-5 py-4 bg-background/50">
        <h2 className="font-tiktok text-lg text-textPrimary">API Playground</h2>
      </div>

      <div className="flex border-b border-border">
        {(["transact", "memory", "account"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-geist transition-colors duration-150 ${
              activeTab === tab
                ? "bg-surface text-textPrimary rounded-md mx-1 px-3"
                : "text-textSecondary hover:text-textPrimary"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="p-5 space-y-4">
        {activeTab === "transact" && (
          <>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-geist text-textSecondary mb-2">
                  Blockchain
                </label>
                <div className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono text-textPrimary">
                  Solana (USDC)
                </div>
              </div>
              <div>
                <label className="block text-xs font-geist text-textSecondary mb-2">
                  Currency
                </label>
                <select
                  value={transactForm.currency}
                  onChange={(e) =>
                    setTransactForm({ ...transactForm, currency: e.target.value })
                  }
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono text-textPrimary focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="USDC">USDC</option>
                  <option value="ETH">ETH</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-geist text-textSecondary mb-2">
                Target Wallet (leave empty for self-credit)
              </label>
              <input
                type="text"
                value={transactForm.targetWallet}
                onChange={(e) =>
                  setTransactForm({ ...transactForm, targetWallet: e.target.value })
                }
                placeholder={agent?.walletAddress || "0x..."}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono text-textPrimary placeholder:text-textSecondary/50 focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-geist text-textSecondary mb-2">
                Amount
              </label>
              <input
                type="number"
                value={transactForm.amount}
                onChange={(e) =>
                  setTransactForm({ ...transactForm, amount: parseFloat(e.target.value) || 0 })
                }
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono text-textPrimary focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            <button
              onClick={executeTransact}
              disabled={loading}
              className="w-full bg-accent hover:bg-gray-800 disabled:bg-gray-400 text-white font-geist font-medium py-2.5 rounded-lg transition-colors"
            >
              {loading ? "Processing..." : "Execute Transaction"}
            </button>
          </>
        )}

        {activeTab === "memory" && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-geist text-textSecondary mb-2">
                  Dimension
                </label>
                <select
                  value={memoryForm.dimension}
                  onChange={(e) =>
                    setMemoryForm({
                      ...memoryForm,
                      dimension: e.target.value as "roi" | "spend_velocity" | "tax_liability",
                    })
                  }
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono text-textPrimary focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="roi">ROI</option>
                  <option value="spend_velocity">Spend Velocity</option>
                  <option value="tax_liability">Tax Liability</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-geist text-textSecondary mb-2">
                  Timeframe
                </label>
                <select
                  value={memoryForm.timeframe}
                  onChange={(e) => setMemoryForm({ ...memoryForm, timeframe: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono text-textPrimary focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="last_24h">Last 24 Hours</option>
                  <option value="last_7d">Last 7 Days</option>
                  <option value="last_30d">Last 30 Days</option>
                  <option value="last_90d">Last 90 Days</option>
                </select>
              </div>
            </div>

            <button
              onClick={executeMemoryQuery}
              disabled={loading}
              className="w-full bg-accent hover:bg-gray-800 disabled:bg-gray-400 text-white font-geist font-medium py-2.5 rounded-lg transition-colors"
            >
              {loading ? "Querying..." : "Query Memory"}
            </button>
          </>
        )}

        {activeTab === "account" && (
          <>
            <div className="bg-background border border-border rounded-lg p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-xs font-geist text-textSecondary">Agent ID</span>
                <span className="font-mono text-xs text-textPrimary">{agent?.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs font-geist text-textSecondary">Wallet</span>
                <span className="font-mono text-xs text-textPrimary truncate max-w-48">
                  {agent?.walletAddress}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs font-geist text-textSecondary">Status</span>
                <span
                  className={`text-xs font-geist ${
                    agent?.status === "active" ? "text-success" : "text-error"
                  }`}
                >
                  {agent?.status?.toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs font-geist text-textSecondary">Balance</span>
                <span className="font-mono text-xs text-success">
                  {agent?.balance?.toFixed(2)} USDC
                </span>
              </div>
            </div>

            <button
              onClick={fetchAccountInfo}
              disabled={loading}
              className="w-full bg-surface hover:bg-surfaceHover disabled:opacity-50 text-textPrimary font-geist font-medium py-2.5 rounded-lg transition-colors border border-border"
            >
              {loading ? "Fetching..." : "Refresh Account Info"}
            </button>
          </>
        )}

        {error && (
          <div className="bg-error/10 border border-error/20 rounded-lg px-4 py-3">
            <p className="text-xs font-geist text-error">{error}</p>
          </div>
        )}

        {result && (
          <div className="relative bg-surface rounded-lg px-4 py-3">
            <button
              onClick={() => copyToClipboard(JSON.stringify(result, null, 2))}
              className="absolute top-2 right-2 text-xs font-mono text-textSecondary hover:text-textPrimary transition-colors"
            >
              Copy
            </button>
            <pre className="font-mono text-xs text-textSecondary overflow-x-auto max-h-48">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}