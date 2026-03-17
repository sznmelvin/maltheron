import { AuthProvider } from "./hooks/useSolanaAuth";
import { ConvexProvider } from "./lib/ConvexProvider";
import { SolanaProvider } from "./lib/SolanaProvider";
import DashboardLayout from "./components/DashboardLayout";

export default function App() {
  return (
    <SolanaProvider>
      <ConvexProvider>
        <AuthProvider>
          <div className="min-h-screen bg-background text-textPrimary font-tiktok antialiased">
            <DashboardLayout />
          </div>
        </AuthProvider>
      </ConvexProvider>
    </SolanaProvider>
  );
}
