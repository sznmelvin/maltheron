import { useWallet, useNeedsNetworkSwitch } from "../hooks/useWallet";

export default function WalletButton({ 
  onConnect,
  size = "md" 
}: { 
  onConnect?: (address: string) => void;
  size?: "sm" | "md" | "lg";
}) {
  const { 
    isConnected, 
    address, 
    isOnTestnet,
    formattedBalance,
    connectWallet, 
    disconnectWallet,
    switchToTestnet,
  } = useWallet();
  
  const { needsSwitch, switchToTestnet: doSwitch } = useNeedsNetworkSwitch();

  const handleConnect = async () => {
    if (needsSwitch) {
      await doSwitch();
    }
    await connectWallet();
    
    if (address && onConnect) {
      onConnect(address);
    }
  };

  const handleDisconnect = () => {
    disconnectWallet();
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const sizeClasses = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };

  if (!isConnected) {
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
      {needsSwitch && (
        <button
          onClick={doSwitch}
          className="px-3 py-1.5 text-xs font-geist bg-warning/20 text-warning rounded-lg hover:bg-warning/30 transition-colors"
        >
          Switch to Base Sepolia
        </button>
      )}
      
      <div className="flex items-center gap-2 bg-surface rounded-lg px-3 py-2">
        <div className="flex flex-col items-end">
          <span className="font-mono text-xs text-textPrimary">
            {formatAddress(address || "")}
          </span>
          {formattedBalance && (
            <span className="font-mono text-xs text-textSecondary">
              {parseFloat(formattedBalance).toFixed(4)} ETH
            </span>
          )}
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

export function NetworkBadge() {
  const { isOnTestnet, chainId } = useWallet();
  
  return (
    <span className={`text-xs font-mono px-2 py-1 rounded ${
      isOnTestnet 
        ? "bg-success/20 text-success" 
        : "bg-warning/20 text-warning"
    }`}>
      {isOnTestnet ? "Base Sepolia" : "Base Mainnet"}
    </span>
  );
}
