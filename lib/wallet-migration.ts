import type { Chain, Wallet } from "@crossmint/client-sdk-react-ui";
import { createMigrationTransaction, getMigrationTransaction } from "./api";
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
 * wallet.approve() through the SDK's OTP flow, and the client polls the server
 * until the transaction succeeds before starting the next phase.
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
      await approveAndAwaitSuccess(wallet, jwt, transaction);
    }
  }

  await wallet.useSigner({ type: "device" });
  await wallet.recover();
}

async function approveAndAwaitSuccess(
  wallet: Wallet<Chain>,
  jwt: string,
  transaction: WalletTransaction
): Promise<void> {
  if (transaction.status === "awaiting-approval") {
    await wallet.approve({ transactionId: transaction.id });
  }

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let current = transaction;
  while (current.status !== "success") {
    if (current.status === "failed") {
      throw new Error(`Transaction ${current.id} failed: ${JSON.stringify(current.error)}`);
    }
    if (Date.now() > deadline) {
      throw new Error(`Timed out waiting for transaction ${current.id} (status: ${current.status})`);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    current = await getMigrationTransaction(jwt, transaction.id);
  }
}
