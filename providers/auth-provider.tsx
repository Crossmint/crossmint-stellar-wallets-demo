"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { onIdTokenChanged } from "firebase/auth";
import type { User } from "firebase/auth";
import { useCrossmint, useWallet } from "@crossmint/client-sdk-react-ui";
import { auth } from "@/lib/firebase";
import { signup } from "@/lib/api";

type AuthState = {
  user: User | null;
  loading: boolean;
  email: string | null;
  jwt: string | null;
};

type AuthContextType = AuthState & {
  signOut: () => Promise<void>;
  refreshToken: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

const initialState: AuthState = {
  user: null,
  loading: true,
  email: null,
  jwt: null,
};

async function getIdToken(user: User | null): Promise<string | null> {
  if (!user) return null;
  try {
    return await user.getIdToken();
  } catch (error) {
    console.error("[auth] getIdToken failed:", error);
    return null;
  }
}

/**
 * Bridges Firebase auth with the Crossmint wallet.
 *
 * - The Firebase id-token listener feeds local state and pushes the JWT into
 *   Crossmint via setJwt(), so the Crossmint context is hydrated before the
 *   bootstrap query runs.
 * - Wallet bootstrap (useQuery keyed on user.uid) creates the local device
 *   signer, calls the server to create-or-fetch the wallet (passing the device
 *   public key so new wallets get it pre-registered), then hydrates the wallet
 *   via the SDK. Keyed on user.uid for single-flight across re-renders.
 */
export default function AuthProvider({ children }: { children: ReactNode }) {
  const { crossmint, setJwt } = useCrossmint();
  const { getWallet, createDeviceSigner } = useWallet();
  const [state, setState] = useState<AuthState>(initialState);
  const { user, jwt, email } = state;

  useEffect(() => {
    return onIdTokenChanged(auth, async (nextUser) => {
      const nextJwt = await getIdToken(nextUser);
      setState({
        user: nextUser,
        loading: false,
        email: nextUser?.email ?? null,
        jwt: nextJwt,
      });
      if (nextJwt) {
        setJwt(nextJwt);
      }
    });
  }, [setJwt]);

  useQuery({
    queryKey: ["wallet-bootstrap", user?.uid],
    queryFn: async () => {
      if (!user || !jwt || !email) {
        throw new Error("User not authenticated");
      }

      let devicePublicKey: { x: string; y: string } | undefined;
      try {
        const signer = await createDeviceSigner();
        devicePublicKey = signer?.publicKey;
      } catch {
        // Device signer unavailable in this environment; the recovery flow
        // will register one client-side after the wallet loads.
      }

      await signup(jwt, devicePublicKey);
      await getWallet({ chain: "stellar" });
      return true;
    },
    // Gate on crossmint.jwt, the SDK's hydrated token, not just local state.
    // getWallet() no-ops while crossmint.jwt is null; on first login that token
    // propagates a tick after setJwt(), so gating on local jwt alone would run
    // the query too early and cache it as "done" with the wallet never loaded.
    enabled: !!user && !!jwt && !!email && crossmint.jwt != null,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
    retry: false,
  });

  const refreshToken = useCallback(async () => {
    const newJwt = await getIdToken(auth.currentUser);
    setJwt(newJwt ?? undefined);
    setState((prev) => ({ ...prev, jwt: newJwt }));
  }, [setJwt]);

  const signOut = useCallback(async () => {
    setJwt(undefined);
    await auth.signOut();
  }, [setJwt]);

  return (
    <AuthContext.Provider value={{ ...state, signOut, refreshToken }}>
      {children}
    </AuthContext.Provider>
  );
}
