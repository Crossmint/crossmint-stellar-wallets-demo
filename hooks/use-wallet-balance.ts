import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@crossmint/client-sdk-react-ui";

/**
 * Query: the wallet's USDC balance. Invalidated under the ["walletBalance"]
 * key after a transfer completes.
 */
export const useWalletBalance = () => {
  const { wallet } = useWallet();

  return useQuery({
    queryKey: ["walletBalance", wallet?.address],
    queryFn: async () => {
      if (!wallet) {
        throw new Error("Wallet not ready");
      }
      const balances = await wallet.balances();
      return balances.usdc.amount;
    },
    enabled: !!wallet,
  });
};
