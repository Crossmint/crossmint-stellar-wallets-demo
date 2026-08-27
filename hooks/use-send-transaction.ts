import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@crossmint/client-sdk-react-ui";
import { useAuth } from "@/providers/auth-provider";
import { createTransaction } from "@/lib/api";
import { migrateLegacyWallet } from "@/lib/wallet-migration";

/**
 * Creates a USDC transfer server-side, then approves it client-side.
 *
 * Flow:
 * 1. If the wallet still needs recovery, run the V1 -> V2 migration and
 *    register the device signer first.
 * 2. Server creates the transaction via the Crossmint API, with the device
 *    signer locator so approval is routed to it (vs. the admin email).
 * 3. Client approves via wallet.approve() - frictionless once the device
 *    signer is registered.
 */
export const useSendTransaction = () => {
  const { jwt, user } = useAuth();
  const { wallet } = useWallet();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: { recipientAddress: string; sendAmount: string }) => {
      if (!jwt || !user || !user.email || !wallet) {
        throw new Error("Wallet not ready");
      }

      if (wallet.needsRecovery()) {
        await migrateLegacyWallet(wallet, user.email, jwt);
      }

      const { recipientAddress, sendAmount } = variables;
      const signerLocator = wallet.signer?.locator();

      const { id } = await createTransaction(jwt, recipientAddress, sendAmount, signerLocator);

      return wallet.approve({ transactionId: id });
    },
    onSuccess: (data) => {
      if (data) {
        queryClient.invalidateQueries({ queryKey: ["walletBalance"] });
      }
    },
  });
};
