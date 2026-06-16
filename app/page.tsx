"use client";

import { useAuth } from "@/providers/auth-provider";
import { Login } from "@/components/login";
import { WalletScreen } from "@/components/wallet-screen";

export default function Home() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  return user ? <WalletScreen /> : <Login />;
}
