import { signMessage, getAccount, getPublicClient } from '@wagmi/core';
import { config } from '../lib/wagmi';

const baseSepoliaId = 84532 as const;
const baseMainnetId = 8453 as const;

export interface SIWEMessage {
  domain: string;
  address: string;
  statement: string;
  nonce: string;
  version: string;
  chainId: number;
}

export async function generateSIWE(address: string, nonce?: string, domain: string = "maltheron.network", chainId: number = 84532): Promise<{ message: string; nonce: string }> {
  const nonceStr = nonce || Math.random().toString(36).substring(2, 15);
  
  const message = `Sign in to Maltheron

Address: ${address}
Domain: ${domain}
Chain ID: ${chainId}
Nonce: ${nonceStr}

This signature verifies your wallet ownership and creates a session.`;

  return { message, nonce: nonceStr };
}

export async function signInWithEthereum(address: string): Promise<{ signature: string; message: string } | null> {
  try {
    const { message } = await generateSIWE(address);
    
    const account = getAccount(config);
    
    const signature = await signMessage(config, {
      message,
      account: account.address,
    });

    return { signature, message };
  } catch (error) {
    console.error('SIWE signing failed:', error);
    return null;
  }
}

export async function prepareAuth(address: string): Promise<{ message: string; nonce: string } | null> {
  try {
    const response = await fetch('/v1/auth/prepare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        walletAddress: address,
        chainId: baseSepoliaId,
      }),
    });

    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (error) {
    console.error('Prepare auth failed:', error);
    return null;
  }
}

export interface AuthResult {
  token: string;
  agent: {
    id: string;
    walletAddress: string;
    balance: number;
    tier: string;
    status: string;
  };
}

export async function authenticateWithWallet(address: string): Promise<AuthResult | null> {
  try {
    const response = await fetch('/v1/auth/prepare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        walletAddress: address,
        chainId: baseSepoliaId,
      }),
    });

    if (!response.ok) {
      console.error('Prepare auth failed:', response.status);
      return null;
    }

    const { message } = await response.json();
    
    const account = getAccount(config);
    
    const signature = await signMessage(config, {
      message,
      account: account.address,
    });

    const authResponse = await fetch('/v1/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress: address,
        signature,
        message,
        chainId: baseSepoliaId,
      }),
    });

    if (!authResponse.ok) {
      const error = await authResponse.json();
      console.error('Session creation failed:', error);
      return null;
    }

    const data = await authResponse.json();
    return {
      token: data.token,
      agent: data.agent,
    };
  } catch (error) {
    console.error('Wallet authentication failed:', error);
    return null;
  }
}
