"use client";

import { useState } from "react";
import { ExportPrivateKeyButton, useWallet } from "@crossmint/client-sdk-react-ui";
import { useAuth } from "@/providers/auth-provider";

type Phase = "idle" | "preparing" | "ready" | "done";

/**
 * Export private key, with the onExport compliance hook.
 *
 * Only the non-custodial (email/phone) signer is exportable - the device
 * signer's P-256 key is not. Post-migration the active signer is the device
 * signer, so on "Export" we silently switch the active signer to email
 * (useSigner is programmatic - no user action, no OTP), mount the export
 * iframe (which runs the export and prompts the user's OTP via the SDK's
 * built-in dialog), then switch back to the device signer so subsequent sends
 * stay frictionless. onExport fires on success - the place to emit a
 * self-custody compliance event (Elliptic etc.).
 */
export function ExportCard() {
  const { wallet } = useWallet();
  const { email } = useAuth();
  const [phase, setPhase] = useState<Phase>("idle");

  if (!wallet) return null;

  const startExport = async () => {
    if (!email) return;
    setPhase("preparing");
    try {
      if (wallet.signer?.type !== "email") {
        await wallet.useSigner({ type: "email", email });
      }
      setPhase("ready");
    } catch {
      setPhase("idle");
    }
  };

  const onExport = async () => {
    // Compliance hook: emit a self-custody export event (Elliptic etc.) here.
    console.log("[onExport] private key exported", { address: wallet.address });
    setPhase("done");
    // Restore the device signer so subsequent sends stay frictionless.
    try {
      if (!wallet.needsRecovery()) {
        await wallet.useSigner({ type: "device" });
      }
    } catch {
      // Device signer not registered (pre-migration); safe to ignore.
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-sm">
      <h2 className="text-base font-medium">Export private key</h2>
      <p className="text-xs text-muted-foreground">
        Self-custody export of the email signer key. Fires the onExport compliance hook on success.
      </p>

      {phase === "ready" ? (
        <ExportPrivateKeyButton onExport={onExport} />
      ) : (
        <button
          type="button"
          onClick={startExport}
          disabled={phase === "preparing"}
          className="w-full rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          {phase === "preparing" ? "Preparing..." : "Export private key"}
        </button>
      )}

      {phase === "done" ? <p className="text-xs text-emerald-700">Export complete. onExport fired.</p> : null}
    </div>
  );
}
