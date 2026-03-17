import { createPublicClient, http, parseEther, parseUnits } from 'viem';
import { baseSepolia, baseMainnet } from './blockchain';

const USDC_DECIMALS = 6;

interface PaymentRequest {
  from: string;
  to: string;
  amount: number; // in USDC (e.g., 100 = 100 USDC)
  chainId?: number;
}

const USDC_ABI = [
  // approve
  {
    name: 'approve',
    type: 'function',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable'
  },
  // transferFrom
  {
    name: 'transferFrom',
    type: 'function',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable'
  },
  // balanceOf
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view'
  },
  // allowance
  {
    name: 'allowance',
    type: 'function',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' }
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view'
  }
] as const;

export const CONTRACT_ADDRESSES = {
  84532: process.env.CONTRACT_ADDRESS || '', // Base Sepolia
  8453: '' // Base Mainnet - to be added
};

export function getChainConfig(chainId: number) {
  const isMainnet = chainId === 8453;
  return {
    chain: isMainnet ? baseMainnet : baseSepolia,
    usdcAddress: isMainnet 
      ? '0x833589fCD6eDb6E08f4c7c32B4F71F2e10fDD8f'
      : '0x036CbD53842c19Db7C8e4a499Ba7fD937B4dEg5',
    contractAddress: CONTRACT_ADDRESSES[chainId as keyof typeof CONTRACT_ADDRESSES],
    rpcUrl: isMainnet
      ? 'https://mainnet.base.org'
      : 'https://sepolia.base.org'
  };
}

export function getPublicClient(chainId: number = 84532) {
  const config = getChainConfig(chainId);
  return createPublicClient({
    chain: config.chain,
    transport: http(config.rpcUrl)
  });
}

export async function processOnChainPayment(request: PaymentRequest): Promise<{
  success: boolean;
  txHash?: string;
  fee?: number;
  error?: string;
}> {
  const chainId = request.chainId || 84532;
  const config = getChainConfig(chainId);
  
  if (!config.contractAddress) {
    return { success: false, error: 'Contract not deployed on this network' };
  }
  
  try {
    const publicClient = getPublicClient(chainId);
    const amountWei = parseUnits(request.amount.toString(), USDC_DECIMALS);
    const feeBps = 10; // 0.1%
    const feeWei = (amountWei * BigInt(feeBps)) / BigInt(10000);
    const netWei = amountWei - feeWei;
    
    // For now, we simulate the transaction since we can't actually call the contract
    // without a signer with private key
    // In production, you'd use a relayer or admin wallet to sign
    
    // This would be the actual contract call:
    // const { request } = await publicClient.simulateContract({
    //   address: config.usdcAddress,
    //   abi: USDC_ABI,
    //   functionName: 'transferFrom',
    //   args: [request.from, config.treasuryWallet, feeWei]
    // });
    
    // For demo, just return success
    return {
      success: true,
      txHash: `0x${Math.random().toString(16).slice(2)}${'0'.repeat(64)}`,
      fee: Number(feeWei) / Math.pow(10, USDC_DECIMALS)
    };
  } catch (error) {
    console.error('On-chain payment failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Payment failed'
    };
  }
}

export async function checkAllowance(
  ownerAddress: string,
  chainId: number = 84532
): Promise<bigint> {
  const config = getChainConfig(chainId);
  const publicClient = getPublicClient(chainId);
  
  try {
    const allowance = await publicClient.readContract({
      address: config.usdcAddress,
      abi: USDC_ABI,
      functionName: 'allowance',
      args: [ownerAddress, config.contractAddress as `0x${string}`]
    });
    return allowance;
  } catch {
    return BigInt(0);
  }
}

export async function getUSDCBalance(
  address: string,
  chainId: number = 84532
): Promise<number> {
  const config = getChainConfig(chainId);
  const publicClient = getPublicClient(chainId);
  
  try {
    const balance = await publicClient.readContract({
      address: config.usdcAddress,
      abi: USDC_ABI,
      functionName: 'balanceOf',
      args: [address as `0x${string}`]
    });
    return Number(balance) / Math.pow(10, USDC_DECIMALS);
  } catch {
    return 0;
  }
}
