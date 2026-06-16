"use client";

import { useState } from "react";
import { useSendTransaction } from "@/hooks/use-send-transaction";

/**
 * USDC transfer. The transaction is created server-side (sk_ key) and approved
 * client-side with the device signer (frictionless post-migration). If the
 * wallet still needs recovery, the send hook runs the migration first.
 */
export function SendCard({ disabled }: { disabled?: boolean }) {
  const { mutate: send, isPending, data, error } = useSendTransaction();
  const [recipientAddress, setRecipientAddress] = useState("");
  const [sendAmount, setSendAmount] = useState("");

  const handleSend = () => {
    if (!recipientAddress || !sendAmount) return;
    send(
      { recipientAddress, sendAmount },
      {
        onSuccess: () => {
          setRecipientAddress("");
          setSendAmount("");
        },
      }
    );
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-sm">
      <h2 className="text-base font-medium">Send USDC</h2>

      <input
        placeholder="recipient address (G... or C...)"
        value={recipientAddress}
        onChange={(e) => setRecipientAddress(e.target.value)}
        className="w-full rounded-md border px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-ring"
      />
      <input
        placeholder="amount"
        inputMode="decimal"
        value={sendAmount}
        onChange={(e) => setSendAmount(e.target.value)}
        className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      />

      <button
        type="button"
        onClick={handleSend}
        disabled={isPending || disabled || !recipientAddress || !sendAmount}
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {isPending ? "Sending..." : "Send"}
      </button>

      {error ? (
        <p className="break-all text-xs text-destructive">
          {error instanceof Error ? error.message : "Failed to send"}
        </p>
      ) : null}

      {data ? (
        <div className="flex flex-col gap-1 rounded-md bg-muted p-3 text-xs">
          <span className="text-muted-foreground">Sent. Tx hash:</span>
          <code className="break-all font-mono">{data.hash}</code>
          {data.explorerLink ? (
            <a href={data.explorerLink} target="_blank" rel="noreferrer" className="text-primary underline">
              View on explorer
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
