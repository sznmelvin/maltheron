import { createContext, useContext, ReactNode, useState, useEffect, useCallback } from 'react';

export interface SolanaWallet {
  address: string;
  connected: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signMessage: (message: string) => Promise<{ signature: string; publicKey: string } | null>;
}

const WalletContext = createContext<SolanaWallet | null>(null);

declare global {
  interface Window {
    phantom?: {
      solana?: {
        isPhantom?: boolean;
        connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toBase58: () => string } }>;
        disconnect: () => Promise<void>;
        signMessage: (message: Uint8Array) => Promise<{ signature: Uint8Array; publicKey: { toBase58: () => string } }>;
        on: (event: string, callback: (...args: any[]) => void) => void;
        off: (event: string, callback: (...args: any[]) => void) => void;
      };
    };
  }
}

export function SolanaProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string>("");
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const checkConnection = async () => {
      if (window.phantom?.solana) {
        try {
          const response = await window.phantom.solana.connect({ onlyIfTrusted: true });
          if (response.publicKey) {
            setAddress(response.publicKey.toBase58());
            setConnected(true);
          }
        } catch {
          // Not connected
        }
      }
    };

    checkConnection();

    if (window.phantom?.solana) {
      window.phantom.solana.on('connect', () => {
        setConnected(true);
      });
      window.phantom.solana.on('disconnect', () => {
        setConnected(false);
        setAddress("");
      });
    }
  }, []);

  const connect = async () => {
    if (window.phantom?.solana) {
      try {
        const response = await window.phantom.solana.connect();
        setAddress(response.publicKey.toBase58());
        setConnected(true);
      } catch (err) {
        console.error('Failed to connect:', err);
      }
    } else {
      alert('Phantom wallet not installed!');
    }
  };

  const disconnect = async () => {
    if (window.phantom?.solana) {
      await window.phantom.solana.disconnect();
      setAddress("");
      setConnected(false);
    }
  };

  const signMessage = useCallback(async (message: string): Promise<{ signature: string; publicKey: string } | null> => {
    if (!window.phantom?.solana) {
      console.error('Phantom wallet not found');
      return null;
    }

    try {
      const encodedMessage = new TextEncoder().encode(message);
      const response = await window.phantom.solana.signMessage(encodedMessage);
      
      // Convert Uint8Array to base64
      const signatureBase64 = btoa(String.fromCharCode(...response.signature));
      
      return {
        signature: signatureBase64,
        publicKey: response.publicKey.toBase58(),
      };
    } catch (err) {
      console.error('Failed to sign message:', err);
      return null;
    }
  }, []);

  return (
    <WalletContext.Provider value={{ address, connected, connect, disconnect, signMessage }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useSolanaWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useSolanaWallet must be used within SolanaProvider');
  }
  return context;
}
