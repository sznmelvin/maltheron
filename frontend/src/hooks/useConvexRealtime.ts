import { useEffect, useState, useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

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
  convex: any;
  token?: string | null;
}

export function useLedgerStreamRealtime(options: UseConvexRealtimeOptions = {}) {
  const { convex } = options;
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const queryResults = useQuery(
    convex ? api.transactions.getRecent : null,
    convex ? { limit: 50 } : undefined
  );

  useEffect(() => {
    if (queryResults !== undefined) {
      if (queryResults === null) {
        setError("Query returned null");
      } else {
        setTransactions(queryResults as Transaction[]);
        setError(null);
      }
      setLoading(false);
    }
  }, [queryResults]);

  const refresh = useCallback(() => {
    // With Convex subscriptions, data auto-updates
    // This triggers a refetch if needed
  }, []);

  return {
    transactions,
    loading,
    error,
    lastUpdate: transactions.length > 0 ? new Date() : null,
    refresh,
  };
}

export function useAgentMetricsRealtime(convex: any, token?: string | null) {
  const [metrics, setMetrics] = useState<{
    balance: number;
    totalVolume: number;
    feeRevenue: number;
    transactionCount: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const agentQuery = useQuery(
    convex && token ? api.sessions.getAgentFromToken : null,
    convex && token ? { token } : undefined
  );

  const volumeQuery = useQuery(
    convex && agentQuery ? api.transactions.getTotalVolume : null,
    convex && agentQuery ? { agentId: agentQuery?._id } : undefined
  );

  const feesQuery = useQuery(
    convex ? api.transactions.getFeeRevenue : null,
    convex ? {} : undefined
  );

  useEffect(() => {
    if (agentQuery !== undefined && volumeQuery !== undefined && feesQuery !== undefined) {
      if (agentQuery) {
        setMetrics({
          balance: agentQuery.balance || 0,
          totalVolume: volumeQuery || 0,
          feeRevenue: feesQuery || 0,
          transactionCount: 0,
        });
        setError(null);
      }
      setLoading(false);
    }
  }, [agentQuery, volumeQuery, feesQuery]);

  const refresh = useCallback(() => {
    // Data auto-updates via subscriptions
  }, []);

  return { metrics, loading, error, refresh };
}

export function useMemoryQueryRealtime(convex: any, token?: string | null) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const agentQuery = useQuery(
    convex && token ? api.sessions.getAgentFromToken : null,
    convex && token ? { token } : undefined
  );

  const roiQuery = useQuery(
    convex && agentQuery ? api.memory.queryROI : null,
    convex && agentQuery ? { agentId: agentQuery._id, timeframe: "last_30d" } : undefined
  );

  const velocityQuery = useQuery(
    convex && agentQuery ? api.memory.querySpendVelocity : null,
    convex && agentQuery ? { agentId: agentQuery._id, timeframe: "last_30d" } : undefined
  );

  const taxQuery = useQuery(
    convex && agentQuery ? api.memory.queryTaxLiability : null,
    convex && agentQuery ? { agentId: agentQuery._id, timeframe: "last_30d" } : undefined
  );

  const query = useCallback((dimension: string, timeframe: string) => {
    setLoading(true);
    // Data comes via subscriptions
    setLoading(false);
  }, []);

  return { data, loading, error, query };
}