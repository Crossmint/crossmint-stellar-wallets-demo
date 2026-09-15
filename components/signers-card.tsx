"use client";

import { useState } from "react";
import { useWallet } from "@crossmint/client-sdk-react-ui";
import { useAuth } from "@/providers/auth-provider";
import { locatorOf, useSigners } from "@/hooks/use-signers";
import { parseRecoverySigner } from "@/components/login";
import type { RecoverySigner } from "@/lib/types";

type DelegatedKind = "email" | "phone" | "external-wallet";

/**
 * Signer management card: lists the wallet's recovery methods and delegated
 * signers, and adds/removes signers post-creation through the BFF routes.
 *
 * Every mutation needs a recovery method to authorize it - the "Approver"
 * dropdown picks which one (the API requires this choice on multi-recovery
 * wallets). Approving runs that method's OTP flow via the SDK dialog.
 *
 * Recovery-method add/remove is wired to /recovery-methods, which the API
 * publishes but has not enabled for Stellar yet - it currently 400s
 * ("Recovery methods are not supported for this wallet type") and the error
 * is surfaced verbatim.
 */
export function SignersCard() {
  const { wallet } = useWallet();
  const { email } = useAuth();
  const { signers, isLoading, addDelegated, remove, addRecovery, removeRecovery } = useSigners();

  const [approverIdx, setApproverIdx] = useState(0);
  const [delegatedKind, setDelegatedKind] = useState<DelegatedKind>("email");
  const [delegatedValue, setDelegatedValue] = useState("");
  const [recoveryValue, setRecoveryValue] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  if (!wallet) return null;

  const recoveryMethods = wallet.recoveryMethods as RecoverySigner[];
  const approvable = recoveryMethods.filter((r) => r.type === "email" || r.type === "phone");
  const approver = approvable[Math.min(approverIdx, Math.max(approvable.length - 1, 0))] ??
    (email ? ({ type: "email", email } as RecoverySigner) : undefined);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setStatus(null);
    try {
      await fn();
      setStatus({ ok: true, text: "Done" });
    } catch (err) {
      setStatus({ ok: false, text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setBusy(null);
    }
  };

  const recoveryLabel = (r: RecoverySigner): string => {
    switch (r.type) {
      case "email":
        return `email: ${r.email}`;
      case "phone":
        return `phone: ${r.phone}`;
      case "external-wallet":
        return `external-wallet: ${r.address.slice(0, 12)}…`;
      case "server":
        return "server";
    }
  };

  const signerLabel = (s: { type: string; locator?: string }): string =>
    s.locator ?? s.type;

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm">
      <h2 className="text-base font-medium">Signers</h2>

      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">
          Recovery methods ({recoveryMethods.length})
        </span>
        {recoveryMethods.map((r, i) => (
          <div key={locatorOf(r)} className="flex items-center justify-between gap-2">
            <code className="break-all font-mono text-xs">{recoveryLabel(r)}</code>
            <button
              type="button"
              disabled={busy !== null || !approver}
              onClick={() =>
                run(`rm-recovery-${i}`, () =>
                  removeRecovery.mutateAsync({ signerLocator: locatorOf(r), approver: approver! })
                )
              }
              className="shrink-0 text-xs text-muted-foreground underline disabled:opacity-60"
            >
              {busy === `rm-recovery-${i}` ? "..." : "remove"}
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">
          Delegated signers{isLoading ? " (loading...)" : ` (${signers.length})`}
        </span>
        {signers.map((s, i) => (
          <div key={s.locator ?? i} className="flex items-center justify-between gap-2">
            <code className="break-all font-mono text-xs">
              {signerLabel(s)}
              {s.status ? ` [${s.status}]` : ""}
            </code>
            <button
              type="button"
              disabled={busy !== null || !approver || !s.locator}
              onClick={() =>
                run(`rm-signer-${i}`, () =>
                  remove.mutateAsync({ signerLocator: s.locator!, approver: approver! })
                )
              }
              className="shrink-0 text-xs text-muted-foreground underline disabled:opacity-60"
            >
              {busy === `rm-signer-${i}` ? "..." : "remove"}
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 border-t pt-3">
        <label className="text-xs text-muted-foreground">
          Approving recovery method (authorizes each change)
        </label>
        <select
          value={approverIdx}
          onChange={(e) => setApproverIdx(Number(e.target.value))}
          className="w-full rounded-md border px-3 py-2 text-sm outline-none"
        >
          {approvable.map((r, i) => (
            <option key={locatorOf(r)} value={i}>
              {recoveryLabel(r)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs text-muted-foreground">Add delegated signer</span>
        <div className="flex gap-2">
          <select
            value={delegatedKind}
            onChange={(e) => setDelegatedKind(e.target.value as DelegatedKind)}
            className="rounded-md border px-2 py-2 text-sm outline-none"
          >
            <option value="email">email</option>
            <option value="phone">phone</option>
            <option value="external-wallet">external wallet</option>
          </select>
          <input
            placeholder={
              delegatedKind === "email"
                ? "email"
                : delegatedKind === "phone"
                  ? "+14155550100"
                  : "G... address"
            }
            value={delegatedValue}
            onChange={(e) => setDelegatedValue(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <button
          type="button"
          disabled={busy !== null || !delegatedValue.trim() || !approver}
          onClick={() =>
            run("add-signer", async () => {
              const signer =
                delegatedKind === "email"
                  ? { type: "email" as const, email: delegatedValue.trim() }
                  : delegatedKind === "phone"
                    ? { type: "phone" as const, phone: delegatedValue.trim() }
                    : { type: "external-wallet" as const, address: delegatedValue.trim() };
              await addDelegated.mutateAsync({ signer, approver: approver! });
              setDelegatedValue("");
            })
          }
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {busy === "add-signer" ? "Adding..." : "Add delegated signer"}
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs text-muted-foreground">
          Add recovery method (endpoint published, not yet enabled on Stellar)
        </span>
        <input
          placeholder="email or +1... phone"
          value={recoveryValue}
          onChange={(e) => setRecoveryValue(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="button"
          disabled={busy !== null || !recoveryValue.trim() || !approver}
          onClick={() =>
            run("add-recovery", async () => {
              const recovery = parseRecoverySigner(recoveryValue);
              if (!recovery) {
                throw new Error("Must be an email or a phone number like +14155550100");
              }
              await addRecovery.mutateAsync({ recovery, approver: approver! });
              setRecoveryValue("");
            })
          }
          className="w-full rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          {busy === "add-recovery" ? "Adding..." : "Add recovery method"}
        </button>
      </div>

      {status ? (
        <p className={`break-all text-xs ${status.ok ? "text-emerald-700" : "text-destructive"}`}>
          {status.text}
        </p>
      ) : null}
    </div>
  );
}
