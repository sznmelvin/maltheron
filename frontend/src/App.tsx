import { AuthProvider } from "./hooks/useAuth";
import { ConvexProvider } from "./lib/ConvexProvider";
import { WalletProvider } from "./lib/WalletProvider";
import DashboardLayout from "./components/DashboardLayout";

export default function App() {
  return (
    <WalletProvider>
      <ConvexProvider>
        <AuthProvider>
          <div className="min-h-screen bg-background text-textPrimary font-tiktok antialiased">
            <DashboardLayout />
          </div>
        </AuthProvider>
      </ConvexProvider>
    </WalletProvider>
  );
}