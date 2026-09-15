"use client";

import { useState } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import { PENDING_RECOVERY_SIGNER_KEY } from "@/providers/auth-provider";
import type { RecoverySigner } from "@/lib/types";

/** Parses a phone (+digits) or email value into a recovery-method config, or null when empty/invalid. */
export function parseRecoverySigner(value: string): RecoverySigner | null {
  const v = value.trim();
  if (!v) return null;
  if (v.includes("@")) return { type: "email", email: v };
  if (/^\+[0-9]{7,15}$/.test(v)) return { type: "phone", phone: v };
  return null;
}

/**
 * Firebase email/password login. Sign in with an existing user (whose Stellar
 * wallet already exists - the legacy-migration path) or create a new one (the
 * new-wallet path). The Firebase ID token is bridged into Crossmint by
 * AuthProvider once auth state changes.
 */
export function Login() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [secondRecovery, setSecondRecovery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "signin") {
        await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
      } else {
        if (secondRecovery.trim()) {
          const extra = parseRecoverySigner(secondRecovery);
          if (!extra) {
            setError("Second recovery method must be an email or a phone number like +14155550100");
            setSubmitting(false);
            return;
          }
          window.localStorage.setItem(PENDING_RECOVERY_SIGNER_KEY, JSON.stringify([extra]));
        }
        await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Crossmint</h1>
          <p className="text-sm font-medium text-muted-foreground">Stellar Wallets Demo</p>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Sign in with Firebase to load your Stellar wallet.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            required
            placeholder="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            type="password"
            required
            placeholder="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          {mode === "signup" ? (
            <input
              type="text"
              placeholder="2nd recovery method - phone (+1...) or email (optional)"
              value={secondRecovery}
              onChange={(e) => setSecondRecovery(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {submitting ? "..." : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="text-center text-xs text-muted-foreground underline"
        >
          {mode === "signin" ? "Need an account? Create one" : "Have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
