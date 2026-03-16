export type Protocol = "x402" | "AP2";

export interface x402Payload {
  targetWallet: string;
  amount: number;
  currency: string;
  signature?: string;
  message?: string;
  conditions?: {
    expiresAt?: number;
    nonce?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface AP2Payload {
  targetWallet: string;
  amount: number;
  currency: string;
  signature?: string;
  taskId?: string;
  workflowId?: string;
  metadata?: Record<string, unknown>;
}

export interface ParsedTransaction {
  targetWallet: string;
  amount: number;
  currency: string;
  signature?: string;
  message?: string;
  protocol: Protocol;
  metadata: Record<string, unknown>;
  isValid: boolean;
  validationError?: string;
}

export function parseX402Payload(payload: unknown): ParsedTransaction {
  const p = payload as Record<string, unknown>;
  
  if (!p.targetWallet || typeof p.targetWallet !== "string") {
    return {
      targetWallet: "",
      amount: 0,
      currency: "USDC",
      protocol: "x402",
      metadata: {},
      isValid: false,
      validationError: "Missing or invalid targetWallet",
    };
  }

  if (!isValidEthAddress(p.targetWallet)) {
    return {
      targetWallet: p.targetWallet,
      amount: 0,
      currency: "USDC",
      protocol: "x402",
      metadata: {},
      isValid: false,
      validationError: "Invalid Ethereum address format",
    };
  }

  const amount = typeof p.amount === "number" ? p.amount : parseFloat(p.amount as string);
  if (isNaN(amount) || amount <= 0) {
    return {
      targetWallet: p.targetWallet,
      amount: 0,
      currency: "USDC",
      protocol: "x402",
      metadata: {},
      isValid: false,
      validationError: "Invalid or negative amount",
    };
  }

  const currency = (p.currency as string) || "USDC";
  if (!isValidCurrency(currency)) {
    return {
      targetWallet: p.targetWallet,
      amount,
      currency,
      protocol: "x402",
      metadata: {},
      isValid: false,
      validationError: "Unsupported currency",
    };
  }

  if (p.conditions?.expiresAt) {
    const expiresAt = p.conditions.expiresAt as number;
    if (Date.now() > expiresAt) {
      return {
        targetWallet: p.targetWallet,
        amount,
        currency,
        protocol: "x402",
        metadata: {},
        isValid: false,
        validationError: "Transaction expired",
      };
    }
  }

  return {
    targetWallet: p.targetWallet,
    amount,
    currency,
    signature: p.signature as string | undefined,
    message: p.message as string | undefined,
    protocol: "x402",
    metadata: {
      ...(p.metadata as Record<string, unknown>),
      conditions: p.conditions,
    },
    isValid: true,
  };
}

export function parseAP2Payload(payload: unknown): ParsedTransaction {
  const p = payload as Record<string, unknown>;
  
  if (!p.targetWallet || typeof p.targetWallet !== "string") {
    return {
      targetWallet: "",
      amount: 0,
      currency: "USDC",
      protocol: "AP2",
      metadata: {},
      isValid: false,
      validationError: "Missing or invalid targetWallet",
    };
  }

  if (!isValidEthAddress(p.targetWallet)) {
    return {
      targetWallet: p.targetWallet,
      amount: 0,
      currency: "USDC",
      protocol: "AP2",
      metadata: {},
      isValid: false,
      validationError: "Invalid Ethereum address format",
    };
  }

  const amount = typeof p.amount === "number" ? p.amount : parseFloat(p.amount as string);
  if (isNaN(amount) || amount <= 0) {
    return {
      targetWallet: p.targetWallet,
      amount: 0,
      currency: "USDC",
      protocol: "AP2",
      metadata: {},
      isValid: false,
      validationError: "Invalid or negative amount",
    };
  }

  const currency = (p.currency as string) || "USDC";
  if (!isValidCurrency(currency)) {
    return {
      targetWallet: p.targetWallet,
      amount,
      currency,
      protocol: "AP2",
      metadata: {},
      isValid: false,
      validationError: "Unsupported currency",
    };
  }

  return {
    targetWallet: p.targetWallet,
    amount,
    currency,
    signature: p.signature as string | undefined,
    message: p.message as string | undefined,
    protocol: "AP2",
    metadata: {
      ...(p.metadata as Record<string, unknown>),
      taskId: p.taskId,
      workflowId: p.workflowId,
    },
    isValid: true,
  };
}

export function parseProtocolPayload(protocol: Protocol, payload: unknown): ParsedTransaction {
  switch (protocol) {
    case "x402":
      return parseX402Payload(payload);
    case "AP2":
      return parseAP2Payload(payload);
    default:
      return {
        targetWallet: "",
        amount: 0,
        currency: "USDC",
        protocol: "AP2",
        metadata: {},
        isValid: false,
        validationError: `Unknown protocol: ${protocol}`,
      };
  }
}

function isValidEthAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

function isValidCurrency(currency: string): boolean {
  const supported = ["USDC"];
  return supported.includes(currency.toUpperCase());
}

export function generateSIWEMessage(params: {
  domain: string;
  address: string;
  nonce: string;
  expiresAt?: number;
}): string {
  const lines = [
    "Sign in to Maltheron",
    "",
    `Address: ${params.address}`,
    `Nonce: ${params.nonce}`,
  ];
  
  if (params.expiresAt) {
    lines.push(`Expires: ${new Date(params.expiresAt).toISOString()}`);
  }
  
  return lines.join("\n");
}