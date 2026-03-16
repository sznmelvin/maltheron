import { ConvexReactClient } from "convex/react";

const convexUrl = import.meta.env.VITE_CONVEX_URL;

if (!convexUrl) {
  console.warn("VITE_CONVEX_URL is not set. Real-time features will not work.");
}

export const convex = convexUrl 
  ? new ConvexReactClient(convexUrl)
  : null;

export function isConvexConfigured(): boolean {
  return !!convexUrl && convexUrl !== "https://placeholder.convex.cloud";
}