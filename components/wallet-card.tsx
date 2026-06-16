"use client";

import { useState } from "react";
import { useWallet } from "@crossmint/client-sdk-react-ui";
import { useWalletBalance } from "@/hooks/use-wallet-balance";

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="text-xs text-muted-foreground underline"
    >
      {copied ? "copied" : "copy"}
    </button>
  );
}

export function WalletCard() {
  const { wallet } = useWallet();
  const { data: balance, isLoading, refetch } = useWalletBalance();

  if (!wallet) return null;

  const signerLocator = wallet.signer?.locator() ?? "-";

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-medium">Your wallet</h2>
        <button
          type="button"
          onClick={() => refetch()}
          className="text-xs text-muted-foreground underline"
        >
          refresh
        </button>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Address (Stellar)</span>
        <div className="flex items-center gap-2">
          <code className="break-all font-mono text-xs">{wallet.address}</code>
          <CopyButton value={wallet.address} />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Active signer</span>
        <code className="break-all font-mono text-xs">{signerLocator}</code>
      </div>

      <div className="flex items-center justify-between border-t pt-3">
        <span className="text-sm font-medium">USDC</span>
        <span className="text-sm font-medium">
          {isLoading ? "..." : `$${Number(balance ?? "0").toFixed(2)}`}
        </span>
      </div>
    </div>
  );
}
