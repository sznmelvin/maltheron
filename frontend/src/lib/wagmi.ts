import { http, createConfig } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { base } from 'viem/chains';

const baseSepolia = {
  ...base,
  id: 84532,
  name: 'Base Sepolia',
  network: 'base-sepolia',
};

const baseMainnet = {
  id: 8453,
  name: 'Base',
  network: 'base',
  nativeCurrency: {
    decimals: 18,
    name: 'Ethereum',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: { http: ['https://mainnet.base.org'] },
  },
};

export const config = createConfig({
  chains: [baseSepolia, baseMainnet],
  connectors: [
    injected({
      shimDisconnect: true,
    }),
  ],
  transports: {
    [baseSepolia.id]: http(),
    [baseMainnet.id]: http(),
  },
});

export const TESTNET_CHAIN = baseSepolia;
export const MAINNET_CHAIN = baseMainnet;
export const DEFAULT_CHAIN = TESTNET_CHAIN;

export const CHAIN_IDS = {
  TESTNET: 84532,
  MAINNET: 8453,
} as const;
