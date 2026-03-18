import { useLedgerStream } from "../hooks/useConvex";

interface Transaction {
  _id: string;
  agentId: string;
  amount: number;
  currency: string;
  type: "credit" | "debit" | "fee";
  metadata: Record<string, unknown>;
  timestamp: number;
  hash: string;
  protocol?: string;
  status?: string;
}

interface LedgerStreamProps {
  agentId?: string;
  token?: string | null;
}

export default function LedgerStream({ agentId, token }: LedgerStreamProps) {
  const { transactions, loading, error, lastUpdate, refresh } = useLedgerStream({ token });

  const formatTime = (ts: number) => {
    const date = new Date(ts);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatHash = (hash: string) => {
    return hash.length > 12 ? `${hash.slice(0, 10)}...${hash.slice(-4)}` : hash;
  };

  const getProtocolBadge = (protocol?: string) => {
    const proto = protocol || "solana";
    const colors: Record<string, string> = {
      solana: "bg-surface text-textSecondary",
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-mono ${colors[proto] || colors.solana}`}>
        {proto}
      </span>
    );
  };

  return (
    <div className="w-full bg-surface border border-border rounded-xl overflow-hidden">
      <div className="border-b border-border px-5 py-4 bg-background/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="font-tiktok text-lg text-textPrimary">Network Ledger Stream</h2>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse"></span>
            <span className="text-xs font-mono text-textSecondary">LIVE</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          {lastUpdate && (
            <span className="text-xs font-mono text-textSecondary hidden sm:inline">
              {lastUpdate.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={refresh}
            className="text-xs font-geist text-textSecondary hover:text-textPrimary transition-colors duration-150"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="max-h-80 sm:max-h-96 overflow-y-auto scrollbar-hide">
        {loading && transactions.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <div className="font-mono text-textSecondary animate-pulse">Loading transactions...</div>
          </div>
        ) : error ? (
          <div className="px-5 py-12 text-center">
            <div className="font-geist text-error">{error}</div>
          </div>
        ) : transactions.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <div className="font-geist text-textSecondary">
              No transactions yet. Use the API Playground to create one.
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {transactions.map((tx: Transaction) => (
              <div
                key={tx._id}
                className="px-5 py-3 flex justify-between items-center hover:bg-surfaceHover transition-colors duration-150"
              >
                <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                  <span className="font-mono text-textSecondary text-xs sm:text-sm truncate">
                    {formatHash(tx.hash)}
                  </span>
                  <span className="hidden sm:inline">{getProtocolBadge(tx.protocol)}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-geist ${
                      tx.type === "credit"
                        ? "bg-success/10 text-success"
                        : tx.type === "fee"
                          ? "bg-warning/10 text-warning"
                          : "bg-surface text-textSecondary"
                    }`}
                  >
                    {tx.type.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                  <span
                    className={`font-mono text-xs sm:text-sm ${
                      tx.type === "credit" ? "text-success" : "text-textPrimary"
                    }`}
                  >
                    {tx.type === "credit" ? "+" : tx.type === "fee" ? "" : "-"}
                    {tx.amount.toFixed(2)} {tx.currency}
                  </span>
                  <span className="font-mono text-xs text-textSecondary hidden sm:inline">
                    {formatTime(tx.timestamp)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}