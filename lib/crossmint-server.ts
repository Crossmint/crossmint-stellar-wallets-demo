/**
 * Server-side Crossmint REST client.
 *
 * Holds the SECRET server API key (CROSSMINT_SERVER_API_KEY). Only ever
 * imported from route handlers under app/api - never from a client component.
 * The web client only carries the public client key and cannot create wallets
 * or transactions directly; it goes through these endpoints.
 */
import type {
  AddRecoveryMethodResponse,
  CrossmintWallet,
  DelegatedSignerInput,
  DelegatedSignerResponse,
  DevicePublicKey,
  RecoverySigner,
  TransferResponse,
  WalletTransaction,
} from "./types";

const CROSSMINT_API_URL =
  process.env.CROSSMINT_API_URL ?? "https://staging.crossmint.com/api/2025-06-09";
const CROSSMINT_API_KEY = process.env.CROSSMINT_SERVER_API_KEY;

/**
 * Checked lazily (per request, not at module load) so `next build` can
 * collect route metadata without the secret key being set.
 */
function apiKey(): string {
  if (!CROSSMINT_API_KEY) {
    throw new Error("CROSSMINT_SERVER_API_KEY is not set");
  }
  return CROSSMINT_API_KEY;
}

function jsonHeaders() {
  return {
    "Content-Type": "application/json",
    "X-API-KEY": apiKey(),
  };
}

function stellarWalletLocator(userId: string): string {
  return `userId:${userId}:stellar:smart`;
}

interface CreateWalletConfig {
  recoveryMethods: RecoverySigner[];
  delegatedSigners?: Array<{ signer: { type: "device"; publicKey: DevicePublicKey } }>;
}

/**
 * GET-first: returns the existing Stellar smart wallet for the user, creating
 * one only on a 404. A non-200/non-404 GET is a hard error (no silent
 * fallthrough).
 *
 * New wallets are created with `recoveryMethods` (the multi-recovery API);
 * the first entry is the primary. `adminSigner` is deprecated on creation
 * and cannot be combined with `recoveryMethods` (the API rejects the mix
 * with RECOVERY_ADMIN_SIGNER_CONFLICT). When a device public key is supplied,
 * that device signer is pre-registered as a delegated signer - so new
 * wallets are frictionless from birth.
 */
export async function getOrCreateWallet(
  userId: string,
  email: string,
  devicePublicKey?: DevicePublicKey,
  additionalRecoverySigners: RecoverySigner[] = []
): Promise<CrossmintWallet> {
  const getRes = await fetch(`${CROSSMINT_API_URL}/wallets/${stellarWalletLocator(userId)}`, {
    headers: { "X-API-KEY": apiKey() },
  });

  if (getRes.ok) {
    return getRes.json() as Promise<CrossmintWallet>;
  }
  if (getRes.status !== 404) {
    throw new Error(`Failed to check existing wallet: ${getRes.status} ${await getRes.text()}`);
  }

  const config: CreateWalletConfig = {
    recoveryMethods: [{ type: "email", email }, ...additionalRecoverySigners],
  };
  if (devicePublicKey) {
    config.delegatedSigners = [{ signer: { type: "device", publicKey: devicePublicKey } }];
  }

  const res = await fetch(`${CROSSMINT_API_URL}/wallets`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({
      chainType: "stellar",
      type: "smart",
      config,
      owner: `userId:${userId}`,
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to create wallet: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<CrossmintWallet>;
}

export async function getWallet(userId: string): Promise<CrossmintWallet> {
  const res = await fetch(`${CROSSMINT_API_URL}/wallets/${stellarWalletLocator(userId)}`, {
    headers: { "X-API-KEY": apiKey() },
  });
  if (!res.ok) {
    throw new Error(`Failed to get wallet: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<CrossmintWallet>;
}

export type LifecycleTransactionType = "upgrade-wallet" | "migrate-wallet";

/**
 * Creates a wallet lifecycle transaction (upgrade-wallet or migrate-wallet).
 * `signer` names which recovery method the approval routes to - required on
 * wallets with multiple recovery methods (the API 400s otherwise), optional
 * on single-recovery ones. The client approves via wallet.approve() (OTP
 * flow). Returns { upToDate: true } when the API says the phase is not
 * needed: "already on the latest version" for upgrade-wallet, "no upgrade in
 * progress" for migrate-wallet (each phase is attempted unconditionally so
 * an interrupted migration can resume at phase 2).
 */
export async function createLifecycleTransaction(
  userId: string,
  type: LifecycleTransactionType,
  signer?: string
): Promise<WalletTransaction | { upToDate: true }> {
  const res = await fetch(
    `${CROSSMINT_API_URL}/wallets/${stellarWalletLocator(userId)}/transactions`,
    {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        params: { transaction: { type }, ...(signer ? { signer } : {}) },
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    if (/already on the latest version/i.test(text) || /no upgrade in progress/i.test(text)) {
      return { upToDate: true };
    }
    throw new Error(`Failed to create ${type} transaction: ${res.status} ${text}`);
  }
  return res.json() as Promise<WalletTransaction>;
}

/**
 * Creates a USDC transfer transaction. The signer locator picks which wallet
 * signer the approval routes to - the device signer post-migration
 * (frictionless), or a specific recovery method on multi-recovery wallets
 * (required there; omitted on single-recovery wallets it defaults to the
 * primary).
 */
export async function createSendTransaction(
  fromAddress: string,
  toAddress: string,
  amount: string,
  signer?: string
): Promise<TransferResponse> {
  const body: { recipient: string; amount: string; signer?: string } = {
    recipient: toAddress,
    amount,
  };
  if (signer) {
    body.signer = signer;
  }

  const res = await fetch(
    `${CROSSMINT_API_URL}/wallets/${fromAddress}/tokens/stellar:usdc/transfers`,
    {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to send transaction: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<TransferResponse>;
}

/**
 * Registers a delegated signer (device, email, phone, or external-wallet).
 * `approver` must be a wallet recovery method's locator on multi-recovery
 * wallets - the registration then needs that method's approval client-side.
 */
export async function addDelegatedSigner(
  userId: string,
  signer: DelegatedSignerInput | string,
  approver?: string
): Promise<DelegatedSignerResponse> {
  const res = await fetch(
    `${CROSSMINT_API_URL}/wallets/${stellarWalletLocator(userId)}/signers`,
    {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ signer, ...(approver ? { approver } : {}) }),
    }
  );
  if (!res.ok) {
    throw new Error(`Failed to add signer: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<DelegatedSignerResponse>;
}

/**
 * Removes a signer (delegated or recovery method) by locator; returns the
 * pending removal transaction. `approver` has the same multi-recovery rule
 * as addDelegatedSigner.
 */
export async function removeSigner(
  userId: string,
  signerLocator: string,
  approver?: string
): Promise<WalletTransaction> {
  const url = new URL(
    `${CROSSMINT_API_URL}/wallets/${stellarWalletLocator(userId)}/signers/${encodeURIComponent(signerLocator)}`
  );
  if (approver) {
    url.searchParams.set("approver", approver);
  }
  const res = await fetch(url, { method: "DELETE", headers: { "X-API-KEY": apiKey() } });
  if (!res.ok) {
    throw new Error(`Failed to remove signer: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<WalletTransaction>;
}

/**
 * Adds recovery method(s) post-creation via /recovery-methods. `approver` is
 * required - only an existing recovery method may authorize a new one.
 * NOTE: on the public staging environment this endpoint is published but not
 * yet enabled for Stellar - it returns 400 "Recovery methods are not
 * supported for this wallet type". The route is wired anyway so the demo is
 * ready the moment it ships.
 */
export async function addRecoveryMethod(
  userId: string,
  recoveryMethods: RecoverySigner | string,
  approver: string
): Promise<AddRecoveryMethodResponse> {
  const res = await fetch(
    `${CROSSMINT_API_URL}/wallets/${stellarWalletLocator(userId)}/recovery-methods`,
    {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ recoveryMethods, approver }),
    }
  );
  if (!res.ok) {
    throw new Error(`Failed to add recovery method: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<AddRecoveryMethodResponse>;
}

/** Removes a recovery method by locator; returns the removal transaction. `approver` is required. Same not-yet-enabled caveat as addRecoveryMethod. */
export async function removeRecoveryMethod(
  userId: string,
  signerLocator: string,
  approver: string
): Promise<WalletTransaction> {
  const url = new URL(
    `${CROSSMINT_API_URL}/wallets/${stellarWalletLocator(userId)}/recovery-methods/${encodeURIComponent(signerLocator)}`
  );
  url.searchParams.set("approver", approver);
  const res = await fetch(url, { method: "DELETE", headers: { "X-API-KEY": apiKey() } });
  if (!res.ok) {
    throw new Error(`Failed to remove recovery method: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<WalletTransaction>;
}
