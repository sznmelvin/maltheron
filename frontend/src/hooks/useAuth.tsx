import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from "react";
import { useWallet } from "./useWallet";
import { SiweMessage } from 'viem';

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
  login: () => Promise<void>;
  loginWithWallet: (address: string, signature: string, message: string) => Promise<boolean>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isDevMode: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem("maltheron_token");
  });
  const [loading, setLoading] = useState(true);
  const [isDevMode, setIsDevMode] = useState(false);

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
        setIsDevMode(data.tier === 'development');
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
    setIsDevMode(true);
    try {
      const devToken = import.meta.env.VITE_DEV_TOKEN;
      const res = await fetch("/v1/auth/dev/create", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(devToken ? { Authorization: `Bearer ${devToken}` } : {}),
        },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        setToken(data.token);
        setAgent(data.agent);
        localStorage.setItem("maltheron_token", data.token);
      }
    } finally {
      setLoading(false);
    }
  };

  const loginWithWallet = async (address: string, signature: string, message: string): Promise<boolean> => {
    setLoading(true);
    setIsDevMode(false);
    try {
      const res = await fetch("/v1/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: address,
          signature,
          message,
        }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setToken(data.token);
        setAgent(data.agent);
        localStorage.setItem("maltheron_token", data.token);
        return true;
      }
      
      const error = await res.json();
      console.error('Wallet login failed:', error);
      return false;
    } catch (error) {
      console.error('Wallet login error:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    if (token) {
      await fetch("/v1/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    localStorage.removeItem("maltheron_token");
    setToken(null);
    setAgent(null);
    setIsDevMode(false);
  };

  return (
    <AuthContext.Provider
      value={{
        agent,
        token,
        loading,
        login,
        loginWithWallet,
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
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
