import { defineChain } from 'viem';

export const baseSepolia = defineChain({
  id: 84532,
  name: 'Base Sepolia',
  nativeCurrency: {
    decimals: 18,
    name: 'Ethereum',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['https://sepolia.base.org', 'https://base-sepolia-rpc.publicnode.com'],
    },
    public: {
      http: ['https://sepolia.base.org', 'https://base-sepolia-rpc.publicnode.com'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Base Sepolia Explorer',
      url: 'https://sepolia.basescan.org',
    },
  },
  testnet: true,
});

export const baseMainnet = defineChain({
  id: 8453,
  name: 'Base',
  nativeCurrency: {
    decimals: 18,
    name: 'Ethereum',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['https://mainnet.base.org', 'https://base-rpc.publicnode.com'],
    },
    public: {
      http: ['https://mainnet.base.org', 'https://base-rpc.publicnode.com'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Base Explorer',
      url: 'https://basescan.org',
    },
  },
});

export const USDC_ADDRESSES = {
  84532: '0x036CbD53842c19Db7C8e4a499Ba7fD937B4dEg5', // Base Sepolia USDC
  8453: '0x833589fCD6eDb6E08f4c7c32B4F71F2e10fDD8f', // Base Mainnet USDC
};

export const EXPLORER_URLS = {
  84532: 'https://sepolia.basescan.org',
  8453: 'https://basescan.org',
};

export function getUSDCAddress(chainId: number): string {
  return USDC_ADDRESSES[chainId as keyof typeof USDC_ADDRESSES] || USDC_ADDRESSES[84532];
}

export function getExplorerUrl(chainId: number): string {
  return EXPLORER_URLS[chainId as keyof typeof EXPLORER_URLS] || EXPLORER_URLS[84532];
}
