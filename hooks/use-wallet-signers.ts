import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@crossmint/client-sdk-react-ui";

export const useWalletSigners = () => {
  const { wallet } = useWallet();

  return useQuery({
    queryKey: ["wallet-signers", wallet?.address],
    queryFn: async () => {
      if (wallet == null) {
        throw new Error("Wallet not ready");
      }
      return wallet.signers();
    },
    enabled: wallet != null,
  });
};
