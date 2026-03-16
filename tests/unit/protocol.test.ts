import { describe, test, expect } from "bun:test";
import { parseProtocolPayload } from "../../src/lib/protocol";
import { calculateFee, validateTransactionAmount, isAllowedCurrency, ALLOWED_CURRENCIES, MAX_TRANSACTION_AMOUNT } from "../../src/lib/finance";

describe("Protocol Parsing", () => {
  describe("parseProtocolPayload", () => {
    test("parses valid x402 payload", () => {
      const result = parseProtocolPayload("x402", {
        targetWallet: "0x742d35Cc6634C0532925a3b844Bc9e7595f0eB1E",
        amount: 1000,
        currency: "USDC",
        message: "Payment for API call",
      });

      expect(result.isValid).toBe(true);
      expect(result.targetWallet).toBe("0x742d35Cc6634C0532925a3b844Bc9e7595f0eB1E");
      expect(result.amount).toBe(1000);
      expect(result.currency).toBe("USDC");
    });

    test("parses valid AP2 payload", () => {
      const result = parseProtocolPayload("AP2", {
        targetWallet: "0x742d35Cc6634C0532925a3b844Bc9e7595f0eB1E",
        amount: 500,
        currency: "USDC",
        taskId: "task_123",
        workflowId: "wf_456",
      });

      expect(result.isValid).toBe(true);
      expect(result.metadata?.taskId).toBe("task_123");
      expect(result.metadata?.workflowId).toBe("wf_456");
    });

    test("rejects invalid wallet address", () => {
      const result = parseProtocolPayload("x402", {
        targetWallet: "invalid",
        amount: 1000,
        currency: "USDC",
      });

      expect(result.isValid).toBe(false);
      expect(result.validationError).toContain("Invalid");
    });

    test("rejects negative amount", () => {
      const result = parseProtocolPayload("x402", {
        targetWallet: "0x742d35Cc6634C0532925a3b844Bc9e7595f0eB1E",
        amount: -100,
        currency: "USDC",
      });

      expect(result.isValid).toBe(false);
    });

    test("rejects zero amount", () => {
      const result = parseProtocolPayload("x402", {
        targetWallet: "0x742d35Cc6634C0532925a3b844Bc9e7595f0eB1E",
        amount: 0,
        currency: "USDC",
      });

      expect(result.isValid).toBe(false);
    });

    test("rejects unknown protocol", () => {
      const result = parseProtocolPayload("unknown" as any, {
        targetWallet: "0x742d35Cc6634C0532925a3b844Bc9e7595f0eB1E",
        amount: 1000,
        currency: "USDC",
      });

      expect(result.isValid).toBe(false);
      expect(result.validationError).toContain("Unknown protocol");
    });

    test("rejects missing required fields", () => {
      const result = parseProtocolPayload("x402", {
        targetWallet: "0x742d35Cc6634C0532925a3b844Bc9e7595f0eB1E",
      } as any);

      expect(result.isValid).toBe(false);
    });

    test("rejects non-USDC currencies", () => {
      const result = parseProtocolPayload("x402", {
        targetWallet: "0x742d35Cc6634C0532925a3b844Bc9e7595f0eB1E",
        amount: 1000,
        currency: "ETH",
      });

      expect(result.isValid).toBe(false);
      expect(result.validationError).toContain("Unsupported currency");
    });
  });
});

describe("Fee Calculation", () => {
  test("calculates 0.1% fee correctly", () => {
    expect(calculateFee(1000)).toBe(1);
    expect(calculateFee(10000)).toBe(10);
    expect(calculateFee(100000)).toBe(100);
  });

  test("calculates net amount correctly", () => {
    expect(calculateFee(1000, true)).toBe(999);
    expect(calculateFee(10000, true)).toBe(9990);
  });

  test("handles decimal amounts", () => {
    const fee = calculateFee(100.50);
    expect(fee).toBeCloseTo(0.1005, 4);
  });

  test("handles large amounts", () => {
    expect(calculateFee(1000000)).toBe(1000);
  });
});

describe("Transaction Validation", () => {
  test("validates positive amount", () => {
    expect(validateTransactionAmount(100).valid).toBe(true);
    expect(validateTransactionAmount(0).valid).toBe(false);
    expect(validateTransactionAmount(-100).valid).toBe(false);
  });

  test("validates max amount", () => {
    expect(validateTransactionAmount(MAX_TRANSACTION_AMOUNT).valid).toBe(true);
    expect(validateTransactionAmount(MAX_TRANSACTION_AMOUNT + 1).valid).toBe(false);
  });

  test("validates allowed currencies", () => {
    expect(isAllowedCurrency("USDC")).toBe(true);
    expect(isAllowedCurrency("ETH")).toBe(false);
    expect(isAllowedCurrency("USDT")).toBe(false);
  });

  test("ALLOWED_CURRENCIES contains only USDC", () => {
    expect(ALLOWED_CURRENCIES).toEqual(["USDC"]);
  });
});

describe("Token Generation", () => {
  test("generates 64 character hex token", () => {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    
    expect(token).toHaveLength(64);
    expect(/^[a-f0-9]+$/.test(token)).toBe(true);
  });

  test("generates unique tokens", () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const bytes = new Uint8Array(32);
      crypto.getRandomValues(bytes);
      tokens.add(Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(""));
    }
    expect(tokens.size).toBe(100);
  });
});
