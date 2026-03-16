import { useAccount, useConnect, useDisconnect, useBalance, useSwitchChain, useChainId } from 'wagmi';
import { useCallback, useEffect, useState } from 'react';
import { config, DEFAULT_CHAIN } from '../lib/wagmi';
import { baseSepolia, baseMainnet } from '../../../src/lib/blockchain';

export interface WalletState {
  isConnected: boolean;
  address: string | null;
  chainId: number | null;
  isOnTestnet: boolean;
  balance: string | null;
  formattedBalance: string | null;
}

export function useWallet() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: balance } = useBalance({
    address: address as `0x${string}`,
    chainId: DEFAULT_CHAIN.id,
  });
  const { switchChain } = useSwitchChain();
  const currentChainId = useChainId();

  const [isOnTestnet, setIsOnTestnet] = useState(true);

  useEffect(() => {
    setIsOnTestnet(currentChainId === baseSepolia.id || currentChainId === undefined);
  }, [currentChainId]);

  const connectWallet = useCallback(async () => {
    const connector = connectors.find(c => c.type === 'injected') || connectors[0];
    if (connector) {
      try {
        await connect({ connector });
      } catch (error) {
        console.error('Failed to connect wallet:', error);
      }
    }
  }, [connect, connectors]);

  const switchToTestnet = useCallback(async () => {
    if (switchChain && currentChainId !== baseSepolia.id) {
      await switchChain({ chainId: baseSepolia.id });
    }
    setIsOnTestnet(true);
  }, [switchChain, currentChainId]);

  const switchToMainnet = useCallback(async () => {
    if (switchChain && currentChainId !== baseMainnet.id) {
      await switchChain({ chainId: baseMainnet.id });
    }
    setIsOnTestnet(false);
  }, [switchChain, currentChainId]);

  const disconnectWallet = useCallback(() => {
    disconnect();
  }, [disconnect]);

  return {
    isConnected,
    address,
    chainId: currentChainId,
    isOnTestnet,
    balance: balance?.value || null,
    formattedBalance: balance?.formatted || null,
    connectWallet,
    disconnectWallet,
    switchToTestnet,
    switchToMainnet,
  };
}

export function useNeedsNetworkSwitch() {
  const { chainId, isConnected } = useAccount();
  const { switchChain } = useSwitchChain();

  const needsSwitch = isConnected && chainId !== undefined && chainId !== baseSepolia.id && chainId !== baseMainnet.id;

  const switchToTestnet = useCallback(async () => {
    if (switchChain) {
      await switchChain({ chainId: baseSepolia.id });
    }
  }, [switchChain]);

  return { needsSwitch, switchToTestnet };
}
