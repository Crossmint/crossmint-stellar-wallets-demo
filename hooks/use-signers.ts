import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@crossmint/client-sdk-react-ui";
import { useAuth } from "@/providers/auth-provider";
import {
  addRecoveryMethod,
  addSigner,
  removeRecoveryMethod,
  removeSigner,
} from "@/lib/api";
import type { DelegatedSignerInput, RecoverySigner } from "@/lib/types";

/**
 * Signer management: lists the wallet's signers and adds/removes them via the
 * BFF routes, then approves the resulting pending transaction client-side.
 *
 * The approver is always a recovery method (`useSigner` selects it, then
 * `wallet.approve` runs its OTP flow). On wallets with multiple recovery
 * methods the API requires `approver` on every signer-mutating call; on
 * single-recovery wallets it is optional but harmless.
 */
export const useSigners = () => {
  const { jwt, user } = useAuth();
  const { wallet } = useWallet();
  const queryClient = useQueryClient();

  const signersQuery = useQuery({
    queryKey: ["walletSigners", wallet?.address],
    queryFn: () => (wallet ? wallet.signers() : []),
    enabled: !!wallet,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["walletSigners", wallet?.address] });
  };

  /**
   * Selects the approving recovery method, approves the pending tx, then
   * restores the device signer when present. Only email/phone methods are
   * offered in the UI - their approval is the SDK's OTP dialog.
   */
  const approveWith = async (
    approver: RecoverySigner,
    transactionId: string
  ): Promise<void> => {
    if (!wallet) {
      throw new Error("Wallet not ready");
    }
    if (approver.type === "email") {
      await wallet.useSigner({ type: "email", email: approver.email });
    } else if (approver.type === "phone") {
      await wallet.useSigner({ type: "phone", phone: approver.phone });
    } else {
      throw new Error(`Approving with a ${approver.type} method isn't supported in this demo`);
    }
    await wallet.approve({ transactionId });
    try {
      if (!wallet.needsRecovery() && wallet.signer?.type !== "device") {
        await wallet.useSigner({ type: "device" });
      }
    } catch {
      // No device signer registered yet; the email/phone method stays active.
    }
  };

  const addDelegated = useMutation({
    mutationFn: async (v: { signer: DelegatedSignerInput; approver: RecoverySigner }) => {
      if (!jwt) {
        throw new Error("Not authenticated");
      }
      const res = await addSigner(jwt, v.signer, locatorOf(v.approver));
      if (res.transaction) {
        await approveWith(v.approver, res.transaction.id);
      }
    },
    onSuccess: refresh,
  });

  const remove = useMutation({
    mutationFn: async (v: { signerLocator: string; approver: RecoverySigner }) => {
      if (!jwt) {
        throw new Error("Not authenticated");
      }
      const tx = await removeSigner(jwt, v.signerLocator, locatorOf(v.approver));
      await approveWith(v.approver, tx.id);
    },
    onSuccess: refresh,
  });

  const addRecovery = useMutation({
    mutationFn: async (v: { recovery: RecoverySigner; approver: RecoverySigner }) => {
      if (!jwt) {
        throw new Error("Not authenticated");
      }
      const res = await addRecoveryMethod(jwt, v.recovery, locatorOf(v.approver));
      await approveWith(v.approver, res.tx.id);
    },
    onSuccess: refresh,
  });

  const removeRecovery = useMutation({
    mutationFn: async (v: { signerLocator: string; approver: RecoverySigner }) => {
      if (!jwt) {
        throw new Error("Not authenticated");
      }
      const tx = await removeRecoveryMethod(jwt, v.signerLocator, locatorOf(v.approver));
      await approveWith(v.approver, tx.id);
    },
    onSuccess: refresh,
  });

  return {
    signers: signersQuery.data ?? [],
    isLoading: signersQuery.isLoading,
    isReady: !!jwt && !!user && !!wallet,
    addDelegated,
    remove,
    addRecovery,
    removeRecovery,
  };
};

/** Recovery-method config -> API locator ("email:x", "phone:x", "external-wallet:x", "server:x"). */
export function locatorOf(recovery: RecoverySigner): string {
  switch (recovery.type) {
    case "email":
      return `email:${recovery.email}`;
    case "phone":
      return `phone:${recovery.phone}`;
    case "external-wallet":
      return `external-wallet:${recovery.address}`;
    case "server":
      return "server:public";
  }
}
