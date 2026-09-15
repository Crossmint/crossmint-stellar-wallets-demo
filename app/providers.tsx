"use client";

import { CrossmintProvider, CrossmintWalletProvider } from "@crossmint/client-sdk-react-ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AuthProvider from "@/providers/auth-provider";

const queryClient = new QueryClient();

/**
 * Provider stack: QueryClient -> CrossmintProvider -> CrossmintWalletProvider -> AuthProvider.
 *
 * There is no CrossmintAuthProvider: this app uses Firebase (3P auth), and
 * AuthProvider bridges the Firebase JWT into Crossmint with setJwt().
 * CrossmintWalletProvider auto-configures the device-signer key storage and
 * shows the built-in email-OTP dialog during signing.
 *
 * A missing client key renders an on-page error instead of throwing: `next
 * build` prerenders this tree without NEXT_PUBLIC_* env set.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const apiKey = process.env.NEXT_PUBLIC_CROSSMINT_API_KEY || "";
  if (!apiKey) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center text-sm">
        NEXT_PUBLIC_CROSSMINT_API_KEY is not set - copy .env.template to .env.local and fill it in.
      </div>
    );
  }
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
