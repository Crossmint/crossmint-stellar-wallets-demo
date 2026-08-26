"use client";

import { useState } from "react";
import { useAddEmailSigner } from "@/hooks/use-add-email-signer";
import { useWalletSigners } from "@/hooks/use-wallet-signers";

export function AddSignerCard({ disabled }: { disabled?: boolean }) {
  const [signerEmail, setSignerEmail] = useState("");
  const { mutate: addSigner, isPending, data, error } = useAddEmailSigner();
  const { data: signers } = useWalletSigners();

  const handleAddSigner = () => {
    const email = signerEmail.trim();
    if (!email) {
      return;
    }
    addSigner(email, {
      onSuccess: () => {
        setSignerEmail("");
      },
    });
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-sm">
      <h2 className="text-base font-medium">Operational signers</h2>

      <input
        type="email"
        placeholder="email address"
        value={signerEmail}
        onChange={(e) => setSignerEmail(e.target.value)}
        className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      />

      <button
        type="button"
        onClick={handleAddSigner}
        disabled={isPending || disabled || !signerEmail.trim()}
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {isPending ? "Adding..." : "Add email signer"}
      </button>

      {error ? (
        <p className="break-all text-xs text-destructive">
          {error instanceof Error ? error.message : "Failed to add email signer"}
        </p>
      ) : null}

      {data ? (
        <p className="break-all text-xs text-emerald-700">
          Registered signer: <code className="font-mono">{data.locator}</code>
        </p>
      ) : null}

      {signers ? (
        <div className="flex flex-col gap-2 border-t pt-3 text-xs">
          <span className="text-muted-foreground">Current delegated signers</span>
          {signers.map((signer) => (
            <div key={signer.locator} className="flex items-center justify-between gap-3">
              <code className="break-all font-mono">{signer.locator}</code>
              <span className="shrink-0 text-muted-foreground">
                {"status" in signer ? signer.status : "active"}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
