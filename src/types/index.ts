export type AgentStatus = "active" | "suspended";

export type TransactionType = "credit" | "debit" | "fee";

export type Protocol = "x402" | "AP2";

export interface Agent {
  _id: string;
  walletAddress: string;
  status: AgentStatus;
  balance: number;
  tier: string;
  createdAt: number;
  metadata?: Record<string, unknown>;
}

export interface Transaction {
  _id: string;
  agentId: string;
  amount: number;
  currency: string;
  type: TransactionType;
  metadata: Record<string, unknown>;
  timestamp: number;
  hash: string;
  protocol?: Protocol;
  status?: "pending" | "settled" | "failed";
}

export interface TaxStub {
  _id: string;
  agentId: string;
  period: string;
  liability: number;
  isPaid: boolean;
  currency: string;
  createdAt: number;
  metadata?: Record<string, unknown>;
}

export type MemoryDimension = "roi" | "spend_velocity" | "tax_liability";

export interface MemoryQueryRequest {
  dimension: MemoryDimension;
  timeframe: string;
  context?: Record<string, string>;
}

export interface MemoryQueryResponse {
  dimension: MemoryDimension;
  value: number;
  metadata?: Record<string, unknown>;
  timeframe: string;
}

export interface LedgerTransactRequest {
  protocol: Protocol;
  payload: {
    targetWallet: string;
    amount: number;
    currency: string;
    signature: string;
    message?: string;
  };
}

export interface LedgerTransactResponse {
  status: "settled" | "pending" | "failed";
  hash: string;
  fee_deducted: number;
  net_amount: number;
}

export interface Session {
  _id: string;
  agentId: string;
  token: string;
  expiresAt: number;
  createdAt: number;
}