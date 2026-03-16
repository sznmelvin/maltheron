import { useEffect, useState, useCallback } from "react";

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

interface UseConvexRealtimeOptions {
  token?: string | null;
}

export function useLedgerStream(options: UseConvexRealtimeOptions = {}) {
  const { token } = options;
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchTransactions = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    setError(null);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch("/v1/ledger/recent?limit=50", { headers });
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      setTransactions(data.transactions || []);
      setLastUpdate(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchTransactions(true);

    const interval = setInterval(() => {
      fetchTransactions(false);
    }, 3000);

    return () => clearInterval(interval);
  }, [fetchTransactions]);

  const refresh = useCallback(() => {
    fetchTransactions(false);
  }, [fetchTransactions]);

  return {
    transactions,
    loading,
    error,
    lastUpdate,
    refresh,
  };
}

export function useAgentMetrics(token?: string | null) {
  const [metrics, setMetrics] = useState<{
    balance: number;
    totalVolume: number;
    feeRevenue: number;
    transactionCount: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      };

      const [accountRes, volumeRes, feesRes] = await Promise.all([
        fetch("/v1/auth/me", { headers }),
        fetch("/v1/ledger/volume", { headers }),
        fetch("/v1/ledger/fees", { headers }),
      ]);

      const [account, volume, fees] = await Promise.all([
        accountRes.json(),
        volumeRes.json(),
        feesRes.json(),
      ]);

      setMetrics({
        balance: account.balance || 0,
        totalVolume: volume.volume || 0,
        feeRevenue: fees.feeRevenue || 0,
        transactionCount: 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch metrics");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  return { metrics, loading, error, refresh: fetchMetrics };
}

export function useMemoryQuery(token?: string | null) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = useCallback(async (dimension: string, timeframe: string) => {
    if (!token) {
      setError("No token");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/v1/memory/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ dimension, timeframe }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Query failed");
      }

      const result = await res.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Query failed");
    } finally {
      setLoading(false);
    }
  }, [token]);

  return { data, loading, error, query };
}