/**
 * Client -> server API.
 *
 * All wallet and transaction creation goes through the Next.js route handlers
 * under app/api, which hold the secret server key and verify the Firebase ID
 * token. The browser only has the public client key, so it cannot create
 * wallets or transactions directly. The user is derived server-side from the
 * verified token, so the client never sends a user id.
 *
 * Same-origin requests, so no base URL is needed.
 */
import type {
  AddRecoveryMethodResponse,
  DelegatedSignerInput,
  DelegatedSignerResponse,
  DevicePublicKey,
  MigrationTransactionResponse,
  RecoverySigner,
  SignUpResponse,
  TransferResponse,
  WalletTransaction,
} from "./types";

function authedHeaders(jwt: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${jwt}`,
  };
}

/**
 * Creates (or fetches) the caller's wallet server-side. Passes the device
 * signer public key so the server registers it as a delegated signer, and any
 * extra recovery methods (phone or second email) so new wallets can be born
 * multi-recovery.
 */
export async function signup(
  jwt: string,
  devicePublicKey?: DevicePublicKey,
  recoverySigners?: RecoverySigner[]
): Promise<SignUpResponse> {
  const res = await fetch("/api/auth/signup", {
    method: "POST",
    headers: authedHeaders(jwt),
    body: JSON.stringify({ devicePublicKey, recoverySigners }),
  });

  if (!res.ok) {
    throw new Error((await res.text()) || "Failed to sign up");
  }
  return res.json() as Promise<SignUpResponse>;
}

/**
 * Creates a wallet lifecycle transaction (upgrade-wallet or migrate-wallet)
 * server-side. `signer` is the recovery-method locator the approval routes
 * to - required when the wallet has multiple recovery methods.
 */
export async function createMigrationTransaction(
  jwt: string,
  type: "upgrade-wallet" | "migrate-wallet",
  signer?: string
): Promise<MigrationTransactionResponse> {
  const res = await fetch("/api/wallets/migrate", {
    method: "POST",
    headers: authedHeaders(jwt),
    body: JSON.stringify({ type, signer }),
  });

  if (!res.ok) {
    throw new Error((await res.text()) || "Failed to create migration transaction");
  }
  return res.json() as Promise<MigrationTransactionResponse>;
}


/** Creates a USDC transfer transaction server-side. Pass the signer locator so the approval is routed to it. */
export async function createTransaction(
  jwt: string,
  to: string,
  amount: string,
  signer?: string
): Promise<TransferResponse> {
  const res = await fetch("/api/wallets/send", {
    method: "POST",
    headers: authedHeaders(jwt),
    body: JSON.stringify({ to, amount, signer }),
  });

  if (!res.ok) {
    throw new Error((await res.text()) || "Failed to send transaction");
  }
  return res.json() as Promise<TransferResponse>;
}

/**
 * Registers a delegated signer server-side. `approver` is the recovery-method
 * locator authorizing the add (required on multi-recovery wallets). The
 * pending transaction in the response is approved client-side with that
 * recovery method.
 */
export async function addSigner(
  jwt: string,
  signer: DelegatedSignerInput | string,
  approver?: string
): Promise<DelegatedSignerResponse> {
  const res = await fetch("/api/wallets/signers", {
    method: "POST",
    headers: authedHeaders(jwt),
    body: JSON.stringify({ signer, approver }),
  });
  if (!res.ok) {
    throw new Error((await res.text()) || "Failed to add signer");
  }
  return res.json() as Promise<DelegatedSignerResponse>;
}

/** Removes a signer (delegated or recovery method) by locator; `approver` as in addSigner. Returns the pending removal transaction. */
export async function removeSigner(
  jwt: string,
  signerLocator: string,
  approver?: string
): Promise<WalletTransaction> {
  const res = await fetch("/api/wallets/signers", {
    method: "DELETE",
    headers: authedHeaders(jwt),
    body: JSON.stringify({ signer: signerLocator, approver }),
  });
  if (!res.ok) {
    throw new Error((await res.text()) || "Failed to remove signer");
  }
  return res.json() as Promise<WalletTransaction>;
}

/**
 * Adds a recovery method post-creation; `approver` (a recovery-method
 * locator) is required. NOTE: the API publishes this endpoint but has not
 * enabled it for Stellar yet - it currently 400s; the demo surfaces that
 * error verbatim.
 */
export async function addRecoveryMethod(
  jwt: string,
  recoveryMethods: RecoverySigner,
  approver: string
): Promise<AddRecoveryMethodResponse> {
  const res = await fetch("/api/wallets/recovery-methods", {
    method: "POST",
    headers: authedHeaders(jwt),
    body: JSON.stringify({ recoveryMethods, approver }),
  });
  if (!res.ok) {
    throw new Error((await res.text()) || "Failed to add recovery method");
  }
  return res.json() as Promise<AddRecoveryMethodResponse>;
}

/** Removes a recovery method by locator; `approver` required. Returns the removal transaction. Same not-yet-enabled caveat as addRecoveryMethod. */
export async function removeRecoveryMethod(
  jwt: string,
  signerLocator: string,
  approver: string
): Promise<WalletTransaction> {
  const res = await fetch("/api/wallets/recovery-methods", {
    method: "DELETE",
    headers: authedHeaders(jwt),
    body: JSON.stringify({ signer: signerLocator, approver }),
  });
  if (!res.ok) {
    throw new Error((await res.text()) || "Failed to remove recovery method");
  }
  return res.json() as Promise<WalletTransaction>;
}
