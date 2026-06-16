import { StellarWallet } from "@crossmint/client-sdk-react-ui";
import type { Chain, Wallet } from "@crossmint/client-sdk-react-ui";

/**
 * Upgrades a Stellar V1 wallet to V2 and registers a device signer.
 *
 * The Stellar smart wallet upgrade is a two-phase on-chain process:
 *   - phase 1 (upgrade-wallet): swaps the contract bytecode, locks the wallet
 *   - phase 2 (migrate-wallet): transforms storage, unlocks the wallet
 *
 * wallet.upgrade() orchestrates both phases. It is idempotent: a 409 on
 * phase 1 means the wallet is already locked from a prior attempt, and the
 * SDK resumes at phase 2. On a wallet that's already V2 the backend returns
 * "no upgrade path available" - treated here as a no-op, which is exactly the
 * case for new wallets that were born on V2 and only need a device signer.
 *
 * The active signer is set to email for the upgrade (so upgrade()'s internal
 * recover() short-circuits instead of trying to register a P-256 signer on a
 * V1 contract) and to device for the subsequent recover() call. recover()
 * registers the local device key on-chain (authorized by the email admin) and
 * makes it the active signer, so future signing is frictionless.
 */
export async function migrateLegacyWallet(wallet: Wallet<Chain>, email: string): Promise<void> {
  await wallet.waitForInit();

  await wallet.useSigner({ type: "email", email });

  try {
    await StellarWallet.from(wallet).upgrade();
  } catch (err) {
    if (!isAlreadyV2Error(err)) {
      throw err;
    }
  }

  await wallet.useSigner({ type: "device" });
  await wallet.recover();
}

function isAlreadyV2Error(err: unknown): boolean {
  return err instanceof Error && /no upgrade path/i.test(err.message);
}
