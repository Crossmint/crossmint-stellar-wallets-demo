import type { Chain, Wallet } from "@crossmint/client-sdk-react-ui";
import { createMigrationTransaction } from "./api";
import type { WalletTransaction } from "./types";

const POLL_INTERVAL_MS = 2_000;
const POLL_TIMEOUT_MS = 3 * 60_000;

/**
 * Upgrades a Stellar V1 wallet to V2 and registers a device signer.
 *
 * The Stellar smart wallet upgrade is a two-phase on-chain process:
 *   - phase 1 (upgrade-wallet): swaps the contract bytecode, locks the wallet
 *   - phase 2 (migrate-wallet): transforms storage, unlocks the wallet
 *
 * Both lifecycle transactions are created SERVER-SIDE (with the secret key,
 * via /api/wallets/migrate) and come back "awaiting-approval". The approval
 * routes to the wallet's admin signer, so the user approves each one here with
 * wallet.approve() through the SDK's OTP flow, and the client polls the
 * Crossmint API directly (via the SDK's apiClient, using the client key's
 * wallets:transactions.read scope) until the transaction succeeds before
 * starting the next phase.
 *
 * Each phase is attempted unconditionally and a "not needed" response
 * ({ upToDate: true }) is skipped: "already on the latest version" on phase 1,
 * "no upgrade in progress" on phase 2. New wallets born on V2 skip both, and a
 * migration interrupted between the phases resumes at phase 2 on the next run.
 *
 * The active signer is set to email for the approvals (the admin signer) and
 * to device for the final recover() call. recover() registers the local device
 * key on-chain (authorized by the email admin) and makes it the active signer,
 * so future signing is frictionless.
 */
export async function migrateLegacyWallet(
  wallet: Wallet<Chain>,
  email: string,
  jwt: string
): Promise<void> {
  await wallet.waitForInit();

  await wallet.useSigner({ type: "email", email });

  for (const type of ["upgrade-wallet", "migrate-wallet"] as const) {
    const transaction = await createMigrationTransaction(jwt, type);
    if (!("upToDate" in transaction)) {
      await approveAndAwaitSuccess(wallet, transaction);
    }
  }

  await wallet.useSigner({ type: "device" });
  await wallet.recover();
}

async function approveAndAwaitSuccess(
  wallet: Wallet<Chain>,
  transaction: WalletTransaction
): Promise<void> {
  if (transaction.status === "awaiting-approval") {
    await wallet.approve({ transactionId: transaction.id });
  }

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let status = transaction.status;
  let error: unknown = transaction.error;
  while (status !== "success") {
    if (status === "failed") {
      throw new Error(`Transaction ${transaction.id} failed: ${JSON.stringify(error)}`);
    }
    if (Date.now() > deadline) {
      throw new Error(`Timed out waiting for transaction ${transaction.id} (status: ${status})`);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    const current = await wallet.apiClient.getTransaction(wallet.address, transaction.id);
    if (!("status" in current)) {
      throw new Error(`Failed to get transaction ${transaction.id}: ${JSON.stringify(current)}`);
    }
    status = current.status;
    error = "error" in current ? current.error : undefined;
  }
}
