import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from "react";
import { useSolanaWallet } from "../lib/SolanaProvider";

interface Agent {
  id: string;
  walletAddress: string;
  balance: number;
  tier: string;
  status: string;
}

interface AuthContextType {
  agent: Agent | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  login: () => Promise<void>;
  loginWithPhantom: () => Promise<boolean>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isDevMode: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

function generateNonce(): string {
  return crypto.randomUUID?.() || 
    Array.from({ length: 32 }, () => Math.random().toString(36)[2]).join('');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem("maltheron_token");
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDevMode, setIsDevMode] = useState(false);
  
  const { address, connected, connect, disconnect, signMessage } = useSolanaWallet();

  useEffect(() => {
    if (token) {
      fetchMe();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchMe = async () => {
    try {
      const res = await fetch("/v1/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAgent(data);
        setIsDevMode(data.tier === "development");
      } else {
        localStorage.removeItem("maltheron_token");
        setToken(null);
        setIsDevMode(false);
      }
    } catch {
      localStorage.removeItem("maltheron_token");
      setToken(null);
      setIsDevMode(false);
    } finally {
      setLoading(false);
    }
  };

  const login = async () => {
    setLoading(true);
    setError(null);
    setIsDevMode(true);
    try {
      const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
      const walletAddress = Array.from({ length: 44 }, () => 
        chars[Math.floor(Math.random() * chars.length)]
      ).join('');
      
      const res = await fetch("/v1/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setToken(data.token);
        setAgent(data.agent);
        localStorage.setItem("maltheron_token", data.token);
      } else {
        const err = await res.json();
        setError(err.error || "Login failed");
      }
    } catch (err) {
      setError("Network error during login");
    } finally {
      setLoading(false);
    }
  };

  const loginWithPhantom = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(null);
    setIsDevMode(false);
    
    try {
      // Step 1: Connect to Phantom
      if (!connected) {
        await connect();
      }
      
      if (!address) {
        setError("Wallet not connected");
        setLoading(false);
        return false;
      }

      // Step 2: Generate nonce and sign message
      const nonce = generateNonce();
      const message = `Sign to login to Maltheron: ${nonce}`;
      
      // Step 3: Sign with Phantom
      const signatureResult = await signMessage(message);
      
      if (!signatureResult) {
        setError("User rejected signature or wallet not available");
        setLoading(false);
        return false;
      }

      // Step 4: Send to backend
      const res = await fetch("/v1/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: signatureResult.publicKey,
          signature: signatureResult.signature,
          message: message,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setToken(data.token);
        setAgent(data.agent);
        localStorage.setItem("maltheron_token", data.token);
        setLoading(false);
        return true;
      }

      const err = await res.json();
      setError(err.error || "Signature verification failed");
      setLoading(false);
      return false;
    } catch (err) {
      console.error("Wallet login error:", err);
      setError("Failed to login with wallet");
      setLoading(false);
      return false;
    }
  }, [address, connected, connect, signMessage]);

  const logout = async () => {
    if (token) {
      await fetch("/v1/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    await disconnect();
    localStorage.removeItem("maltheron_token");
    setToken(null);
    setAgent(null);
    setIsDevMode(false);
    setError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        agent,
        token,
        loading,
        error,
        login,
        loginWithPhantom,
        logout,
        isAuthenticated: !!agent,
        isDevMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
