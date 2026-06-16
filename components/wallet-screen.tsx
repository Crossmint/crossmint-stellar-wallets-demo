"use client";

import { useWallet } from "@crossmint/client-sdk-react-ui";
import { useAuth } from "@/providers/auth-provider";
import { useWalletRecovery } from "@/hooks/use-wallet-recovery";
import { WalletCard } from "./wallet-card";
import { SendCard } from "./send-card";
import { ExportCard } from "./export-card";
import { MigrationBanner } from "./migration-banner";

export function WalletScreen() {
  const { user, signOut } = useAuth();
  const { wallet } = useWallet();

  // One-time V1 -> V2 migration + device-signer registration for legacy wallets.
  const { isRecovering } = useWalletRecovery();

  if (!wallet) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
        <p className="text-sm text-muted-foreground">Setting up your wallet...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-5 px-4 py-8">
      <header className="flex items-center justify-between">
        <span className="text-lg font-semibold tracking-tight">Crossmint</span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{user?.email}</span>
          <button type="button" onClick={signOut} className="text-xs text-muted-foreground underline">
            Sign out
          </button>
        </div>
      </header>

      <MigrationBanner isRecovering={isRecovering} needsRecovery={wallet.needsRecovery()} />

      <WalletCard />
      <SendCard disabled={isRecovering} />
      <ExportCard />
    </div>
  );
}
