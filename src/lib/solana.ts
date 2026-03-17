import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  Keypair,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  getOrCreateAssociatedTokenAccount,
} from '@solana/spl-token';

const SOLANA_DEVNET = 'https://api.devnet.solana.com';
const SOLANA_MAINNET = 'https://api.mainnet-beta.solana.com';

// USDC on Solana Devnet
const USDC_DEVNET = 'Gh9kkMbrD8WNCT4kP1D9R9WSXc9iN9h3XwWJ8y1MmM3'; // USDC Devnet
// USDC on Solana Mainnet  
const USDC_MAINNET = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4XtEGUrFAbcXw3'; // USDC on Mainnet

const FEE_BPS = 10; // 0.1%

interface SolanaConfig {
  rpcUrl: string;
  usdcMint: string;
  treasuryWallet: string;
  programId?: string;
}

const configs: Record<string, SolanaConfig> = {
  devnet: {
    rpcUrl: SOLANA_DEVNET,
    usdcMint: USDC_DEVNET,
    treasuryWallet: '', // Set after deployment
    programId: '', // Set after program deployment
  },
  mainnet: {
    rpcUrl: SOLANA_MAINNET,
    usdcMint: USDC_MAINNET,
    treasuryWallet: '', // Set after deployment
  },
};

export function getSolanaConfig(network: 'devnet' | 'mainnet' = 'devnet'): SolanaConfig {
  return configs[network];
}

export function setTreasuryWallet(wallet: string, network: 'devnet' | 'mainnet' = 'devnet') {
  configs[network].treasuryWallet = wallet;
}

export function setProgramId(programId: string, network: 'devnet' | 'mainnet' = 'devnet') {
  configs[network].programId = programId;
}

export async function getConnection(network: 'devnet' | 'mainnet' = 'devnet'): Promise<Connection> {
  return new Connection(configs[network].rpcUrl, 'confirmed');
}

export async function getUSDCBalance(
  address: string,
  network: 'devnet' | 'mainnet' = 'devnet'
): Promise<number> {
  const config = getSolanaConfig(network);
  const connection = await getConnection(network);
  const publicKey = new PublicKey(address);
  const usdcMint = new PublicKey(config.usdcMint);

  try {
    const tokenAccount = await getAssociatedTokenAddress(usdcMint, publicKey);
    const balance = await connection.getTokenAccountBalance(tokenAccount);
    return balance.value.uiAmount || 0;
  } catch {
    return 0;
  }
}

export async function processPayment(
  senderAddress: string,
  recipientAddress: string,
  amount: number, // in USDC (e.g., 10 = 10 USDC)
  senderSecretKey?: number[],
  network: 'devnet' | 'mainnet' = 'devnet'
): Promise<{
  success: boolean;
  signature?: string;
  fee?: number;
  error?: string;
}> {
  const config = getSolanaConfig(network);
  
  if (!config.treasuryWallet) {
    return { success: false, error: 'Treasury wallet not configured' };
  }

  try {
    const connection = await getConnection(network);
    const sender = new PublicKey(senderAddress);
    const recipient = new PublicKey(recipientAddress);
    const treasury = new PublicKey(config.treasuryWallet);
    const usdcMint = new PublicKey(config.usdcMint);

    // Calculate fee
    const amountSmallest = Math.round(amount * 1_000_000); // USDC has 6 decimals
    const fee = Math.round((amountSmallest * FEE_BPS) / 10000);
    const netAmount = amountSmallest - fee;

    // For client-side transactions (wallet adapter)
    // This returns instructions that the frontend will execute
    const senderUsdcAccount = await getAssociatedTokenAddress(usdcMint, sender);
    const recipientUsdcAccount = await getAssociatedTokenAddress(usdcMint, recipient);
    const treasuryUsdcAccount = await getAssociatedTokenAddress(usdcMint, treasury);

    return {
      success: true,
      instructions: [
        // Transfer fee to treasury
        createTransferInstruction(
          senderUsdcAccount,
          treasuryUsdcAccount,
          sender,
          fee
        ),
        // Transfer net amount to recipient
        createTransferInstruction(
          senderUsdcAccount,
          recipientUsdcAccount,
          sender,
          netAmount
        ),
      ],
      fee: fee / 1_000_000,
      recipientUsdcAccount: recipientUsdcAccount.toBase58(),
      treasuryUsdcAccount: treasuryUsdcAccount.toBase58(),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Payment failed',
    };
  }
}

export function getNetworkFromChainId(chainId: string): 'devnet' | 'mainnet' {
  if (chainId === 'solana:devnet' || chainId === 'devnet') {
    return 'devnet';
  }
  return 'mainnet';
}

export async function getTransactionHistory(
  address: string,
  network: 'devnet' | 'mainnet' = 'devnet'
): Promise<any[]> {
  const connection = await getConnection(network);
  const publicKey = new PublicKey(address);
  
  const signatures = await connection.getSignaturesForAddress(publicKey, { limit: 10 });
  return signatures;
}

export function getExplorerUrl(signature: string, network: 'devnet' | 'mainnet' = 'devnet'): string {
  const base = network === 'devnet' 
    ? 'https://explorer.solana.com' 
    : 'https://explorer.solana.com';
  const cluster = network === 'devnet' ? '?cluster=devnet' : '';
  return `${base}/tx/${signature}${cluster}`;
}
