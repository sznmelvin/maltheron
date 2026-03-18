import { useSolanaWallet } from "../lib/SolanaProvider";

export default function WalletButton({ 
  onConnect,
  size = "md" 
}: { 
  onConnect?: (address: string) => void;
  size?: "sm" | "md" | "lg";
}) {
  const { connected, address, connect, disconnect } = useSolanaWallet();
  
  const handleConnect = async () => {
    await connect();
    
    if (address && onConnect) {
      onConnect(address);
    }
  };

  const handleDisconnect = () => {
    disconnect();
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const sizeClasses = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };

  if (!connected) {
    return (
      <button
        onClick={handleConnect}
        className={`bg-surface hover:bg-surfaceHover text-textPrimary font-geist rounded-lg transition-colors ${sizeClasses[size]}`}
      >
        Connect Wallet
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 bg-surface rounded-lg px-3 py-2">
        <div className="flex flex-col items-end">
          <span className="font-mono text-xs text-textPrimary">
            {formatAddress(address || "")}
          </span>
        </div>
        
        <div className="w-2 h-2 rounded-full bg-success"></div>
      </div>

      <button
        onClick={handleDisconnect}
        className="text-xs font-geist text-textSecondary hover:text-textPrimary transition-colors"
      >
        Disconnect
      </button>
    </div>
  );
}
