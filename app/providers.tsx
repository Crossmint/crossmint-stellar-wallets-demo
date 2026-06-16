"use client";

import { CrossmintProvider, CrossmintWalletProvider } from "@crossmint/client-sdk-react-ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AuthProvider from "@/providers/auth-provider";

const queryClient = new QueryClient();

const apiKey = process.env.NEXT_PUBLIC_CROSSMINT_API_KEY || "";
if (!apiKey) {
  throw new Error("NEXT_PUBLIC_CROSSMINT_API_KEY is not set");
}

/**
 * Provider stack: QueryClient -> CrossmintProvider -> CrossmintWalletProvider -> AuthProvider.
 *
 * There is no CrossmintAuthProvider: this app uses Firebase (3P auth), and
 * AuthProvider bridges the Firebase JWT into Crossmint with setJwt().
 * CrossmintWalletProvider auto-configures the device-signer key storage and
 * shows the built-in email-OTP dialog during signing.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <CrossmintProvider apiKey={apiKey}>
        <CrossmintWalletProvider>
          <AuthProvider>{children}</AuthProvider>
        </CrossmintWalletProvider>
      </CrossmintProvider>
    </QueryClientProvider>
  );
}
