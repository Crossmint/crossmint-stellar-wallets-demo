import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@crossmint/client-sdk-react-ui";
import { useAuth } from "@/providers/auth-provider";
import { migrateLegacyWallet } from "@/lib/wallet-migration";

/**
 * Runs the V1 -> V2 wallet upgrade and device-signer registration when the SDK
 * reports the wallet needs recovery (legacy wallets created without a device
 * signer). See migrateLegacyWallet for the underlying flow.
 *
 * Keyed on wallet.address so the migration runs once per wallet - TanStack
 * Query handles single-flight via the queryKey, and infinite staleTime keeps
 * the success cached for the session.
 */
export const useWalletRecovery = () => {
  const { wallet } = useWallet();
  const { email, jwt } = useAuth();

  const { isFetching: isRecovering } = useQuery({
    queryKey: ["wallet-migration", wallet?.address],
    queryFn: async () => {
      if (!wallet || !email || !jwt) {
        throw new Error("Wallet, email or JWT not found");
      }
      await migrateLegacyWallet(wallet, email, jwt);
      return true;
    },
    enabled: !!wallet && !!email && !!jwt && wallet.needsRecovery(),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
    retry: false,
  });

  return { isRecovering };
};
