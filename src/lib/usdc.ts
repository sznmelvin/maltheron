import { createPublicClient, http, getContract, parseEther, parseUnits } from 'viem';
import { baseSepolia, baseMainnet, getUSDCAddress } from './blockchain';

const USDC_ABI = [
  {
    name: 'transfer',
    type: 'function',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'transferFrom',
    type: 'function',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    name: 'allowance',
    type: 'function',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'approve',
    type: 'function',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    name: 'decimals',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
  },
] as const;

function getClient(chainId: number = 84532) {
  const chain = chainId === 8453 ? baseMainnet : baseSepolia;
  return createPublicClient({
    chain,
    transport: http(),
  });
}

export async function getUSDCBalance(address: string, chainId: number = 84532): Promise<bigint> {
  const client = getClient(chainId);
  const usdcAddress = getUSDCAddress(chainId);
  
  const contract = getContract({
    address: usdcAddress,
    abi: USDC_ABI,
    client,
  });

  const balance = await contract.read.balanceOf([address as `0x${string}`]);
  return balance;
}

export async function getUSDCBalanceFormatted(address: string, chainId: number = 84532): Promise<number> {
  const client = getClient(chainId);
  const usdcAddress = getUSDCAddress(chainId);
  
  const contract = getContract({
    address: usdcAddress,
    abi: USDC_ABI,
    client,
  });

  const [balance, decimals] = await Promise.all([
    contract.read.balanceOf([address as `0x${string}`]),
    contract.read.decimals(),
  ]);

  return Number(balance) / Math.pow(10, Number(decimals));
}

export async function verifyTransaction(
  txHash: string,
  fromAddress: string,
  toAddress: string,
  expectedAmount: bigint,
  chainId: number = 84532
): Promise<{ verified: boolean; blockNumber?: bigint; timestamp?: number }> {
  try {
    const client = getClient(chainId);
    const tx = await client.getTransaction({ hash: txHash as `0x${string}` });

    if (!tx) {
      return { verified: false };
    }

    if (tx.from.toLowerCase() !== fromAddress.toLowerCase()) {
      return { verified: false };
    }

    if (tx.to && tx.to.toLowerCase() !== toAddress.toLowerCase()) {
      return { verified: false };
    }

    if (tx.value < expectedAmount) {
      return { verified: false };
    }

    const receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` });

    if (!receipt || receipt.status !== 'success') {
      return { verified: false };
    }

    const block = await client.getBlock({ blockNumber: receipt.blockNumber });

    return {
      verified: true,
      blockNumber: receipt.blockNumber,
      timestamp: Number(block.timestamp) * 1000,
    };
  } catch (error) {
    console.error('Transaction verification error:', error);
    return { verified: false };
  }
}

export function parseUSDC(amount: number, decimals: number = 6): bigint {
  return parseUnits(amount.toString(), decimals);
}

export function formatUSDC(balance: bigint, decimals: number = 6): string {
  return Number(balance) / Math.pow(10, decimals);
}

export const CHAIN_IDS = {
  TESTNET: 84532,
  MAINNET: 8453,
} as const;
