import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@crossmint/client-sdk-react-ui";
import { useAuth } from "@/providers/auth-provider";
import { addEmailSigner } from "@/lib/api";
import { migrateLegacyWallet } from "@/lib/wallet-migration";

/**
 * Registers an operational email signer server-side, then approves its Stellar
 * registration with the wallet's email admin signer.
 */
export const useAddEmailSigner = () => {
  const { jwt, user } = useAuth();
  const { wallet } = useWallet();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (signerEmail: string) => {
      if (!jwt || !user?.email || !wallet) {
        throw new Error("Wallet not ready");
      }

      if (wallet.needsRecovery()) {
        await migrateLegacyWallet(wallet, user.email);
      }

      const registration = await addEmailSigner(jwt, signerEmail);
      if (
        registration.transactionId == null ||
        (registration.status != null && registration.status !== "awaiting-approval")
      ) {
        return registration;
      }

      const previousSignerType = wallet.signer?.type;
      await wallet.useSigner({ type: "email", email: user.email });
      try {
        await wallet.approve({ transactionId: registration.transactionId });
      } finally {
        if (previousSignerType === "device") {
          try {
            await wallet.useSigner({ type: "device" });
          } catch {
            // A restore failure should not mask an approval result.
          }
        }
      }

      return registration;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallet-signers", wallet?.address] });
    },
  });
};
