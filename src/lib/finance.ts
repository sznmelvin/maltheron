const FEE_BPS = 10; // 10 bps = 0.1%

export function calculateFee(amount: number, returnNet = false): number {
  const fee = amount * (FEE_BPS / 10000);
  if (returnNet) {
    return amount - fee;
  }
  return fee;
}

export function calculateNetAmount(amount: number): number {
  return amount - calculateFee(amount);
}

export const ALLOWED_CURRENCIES = ["USDC"] as const;
export type AllowedCurrency = typeof ALLOWED_CURRENCIES[number];

export const MAX_TRANSACTION_AMOUNT = 1_000_000;

export function isAllowedCurrency(currency: string): currency is AllowedCurrency {
  return ALLOWED_CURRENCIES.includes(currency as AllowedCurrency);
}

export function validateTransactionAmount(amount: number): { valid: boolean; error?: string } {
  if (amount <= 0) {
    return { valid: false, error: "Amount must be positive" };
  }
  if (amount > MAX_TRANSACTION_AMOUNT) {
    return { valid: false, error: `Amount exceeds maximum of ${MAX_TRANSACTION_AMOUNT}` };
  }
  return { valid: true };
}
