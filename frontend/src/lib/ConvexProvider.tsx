import { ConvexProvider as BaseConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode } from "react";

const convexUrl = import.meta.env.VITE_CONVEX_URL;

const convex = convexUrl && convexUrl !== "https://placeholder.convex.cloud" 
  ? new ConvexReactClient(convexUrl)
  : null;

interface ConvexProviderProps {
  children: ReactNode;
}

export function ConvexProvider({ children }: ConvexProviderProps) {
  if (!convex) {
    console.warn("Convex not configured - real-time features disabled");
    return <>{children}</>;
  }

  return (
    <BaseConvexProvider client={convex}>
      {children}
    </BaseConvexProvider>
  );
}

export { convex };

export function isConvexConfigured(): boolean {
  return !!convex;
}