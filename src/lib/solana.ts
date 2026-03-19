import {
  Connection,
  PublicKey,
} from '@solana/web3.js';

// Mainnet RPC - upgrade to Helius/QuickNode for production
const SOLANA_MAINNET = 'https://api.mainnet-beta.solana.com';

const LAMPORTS_PER_SOL = 1_000_000_000;
export const FEE_BPS = 10; // 0.1%

interface SolanaConfig {
  rpcUrl: string;
  treasuryWallet: string;
}

let config: SolanaConfig = {
  rpcUrl: SOLANA_MAINNET,
  treasuryWallet: '',
};

export function setTreasuryWallet(wallet: string) {
  config.treasuryWallet = wallet;
}

export function getTreasuryWallet(): string {
  return config.treasuryWallet;
}

export async function getConnection(): Promise<Connection> {
  return new Connection(config.rpcUrl, 'confirmed');
}

export async function getSOLBalance(address: string): Promise<number> {
  try {
    const connection = await getConnection();
    const publicKey = new PublicKey(address);
    const balance = await connection.getBalance(publicKey);
    return balance / LAMPORTS_PER_SOL;
  } catch {
    return 0;
  }
}

export interface VerifiedTransaction {
  signature: string;
  from: string;
  to: string;
  amount: number;
  fee: number;
  netAmount: number;
  timestamp: number;
  slot: number;
}

export async function verifyTransaction(txHash: string): Promise<{
  valid: boolean;
  error?: string;
  transaction?: VerifiedTransaction;
}> {
  try {
    const connection = await getConnection();
    
    const transaction = await connection.getTransaction(txHash, {
      maxSupportedTransactionVersion: 0,
    });

    if (!transaction) {
      return { valid: false, error: 'Transaction not found or not confirmed' };
    }

    if (transaction.meta?.err) {
      return { valid: false, error: 'Transaction failed on-chain' };
    }

    const accountKeys = transaction.transaction.message.getAccountKeys();
    const preBalances = transaction.meta?.preBalances || [];
    const postBalances = transaction.meta?.postBalances || [];
    
    const signatures = transaction.transaction.signatures;
    if (!signatures || signatures.length === 0) {
      return { valid: false, error: 'No signatures found in transaction' };
    }
    const senderPublicKey = accountKeys.get(0)?.toBase58() || '';
    
    let receiverPublicKey = '';
    let lamportAmount = 0;
    
    for (let i = 0; i < accountKeys.length; i++) {
      const balanceChange = (postBalances[i] || 0) - (preBalances[i] || 0);
      if (balanceChange > 0) {
        const pubkey = accountKeys.get(i)?.toBase58();
        if (pubkey && pubkey !== senderPublicKey) {
          receiverPublicKey = pubkey;
          lamportAmount = balanceChange;
          break;
        }
      }
    }

    if (!receiverPublicKey) {
      return { valid: false, error: 'Could not parse transaction recipients' };
    }

    const amountSol = Number(lamportAmount) / LAMPORTS_PER_SOL;
    const fee = (amountSol * FEE_BPS) / 10000;
    const netAmount = amountSol - fee;

    return {
      valid: true,
      transaction: {
        signature: txHash,
        from: senderPublicKey,
        to: receiverPublicKey,
        amount: amountSol,
        fee: fee,
        netAmount: netAmount,
        timestamp: transaction.blockTime || Math.floor(Date.now() / 1000),
        slot: transaction.slot,
      },
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Failed to verify transaction',
    };
  }
}

export async function verifyFeeTransfer(
  mainTxHash: string,
  mainAmount: number,
  treasuryWallet: string,
  maxBlocksLookback: number = 10
): Promise<{
  valid: boolean;
  error?: string;
  feeTxHash?: string;
  actualFee?: number;
}> {
  if (!treasuryWallet) {
    return { valid: false, error: 'Treasury wallet not configured' };
  }

  const connection = await getConnection();
  
  try {
    const mainTx = await connection.getTransaction(mainTxHash, {
      maxSupportedTransactionVersion: 0,
    });
    
    if (!mainTx) {
      return { valid: false, error: 'Main transaction not found' };
    }

    const mainSlot = mainTx.slot;
    const startSlot = Math.max(0, mainSlot - maxBlocksLookback);
    
    const signatures = await connection.getSignaturesForAddress(
      new PublicKey(treasuryWallet),
      { limit: 100 },
    );

    const expectedFee = (mainAmount * FEE_BPS) / 10000;
    const feeLamports = Math.floor(expectedFee * LAMPORTS_PER_SOL);

    for (const sigInfo of signatures) {
      if (sigInfo.slot < startSlot) continue;
      
      const feeTx = await connection.getTransaction(sigInfo.signature, {
        maxSupportedTransactionVersion: 0,
      });
      
      if (!feeTx || feeTx.meta?.err) continue;
      
      const feeAccountKeys = feeTx.transaction.message.getAccountKeys();
      const feePreBalances = feeTx.meta?.preBalances || [];
      const feePostBalances = feeTx.meta?.postBalances || [];
      
      for (let i = 0; i < feeAccountKeys.length; i++) {
        const pubkey = feeAccountKeys.get(i)?.toBase58();
        if (pubkey === treasuryWallet) {
          const balanceChange = (feePostBalances[i] ?? 0) - (feePreBalances[i] ?? 0);
          
          if (balanceChange === feeLamports) {
            return {
              valid: true,
              feeTxHash: sigInfo.signature,
              actualFee: expectedFee,
            };
          }
        }
      }
    }

    return {
      valid: false,
      error: `Fee transfer of ${expectedFee} SOL not found to treasury wallet`,
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Failed to verify fee transfer',
    };
  }
}

export function calculateFee(amount: number): number {
  return (amount * FEE_BPS) / 10000;
}

export function lamportsToSOL(lamports: number): number {
  return lamports / LAMPORTS_PER_SOL;
}

export function solToLamports(sol: number): number {
  return Math.floor(sol * LAMPORTS_PER_SOL);
}

export function getExplorerUrl(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}`;
}

export function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

export function isValidTransactionSignature(signature: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{86,88}$/.test(signature);
}

export async function getUSDCBalance(_address: string): Promise<number> {
  console.log('USDC support - coming soon');
  return 0;
}
