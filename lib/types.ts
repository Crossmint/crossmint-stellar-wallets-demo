/** P-256 device-signer public key coordinates (base64url), as returned by createDeviceSigner(). */
export interface DevicePublicKey {
  x: string;
  y: string;
}

/**
 * A recovery method on a Stellar smart wallet. `email` and `phone` are the
 * user-verifiable types this demo creates; `external-wallet` and `server`
 * are also accepted by the API.
 */
export type RecoverySigner =
  | { type: "email"; email: string }
  | { type: "phone"; phone: string }
  | { type: "external-wallet"; address: string }
  | { type: "server" };

/**
 * A delegated (operational) signer. This demo registers the P-256 device
 * signer; `email`/`phone`/`external-wallet` delegated signers are also valid
 * on Stellar.
 */
export type DelegatedSignerInput =
  | { type: "device"; publicKey: DevicePublicKey }
  | { type: "email"; email: string }
  | { type: "phone"; phone: string }
  | { type: "external-wallet"; address: string };

/** A signer entry as returned in a wallet's config (resolved to a locator). */
export interface WalletSignerEntry {
  type: string;
  locator: string;
  status?: string;
  email?: string;
  phone?: string;
  address?: string;
}

/** Response from POST /api/auth/signup. */
export interface SignUpResponse {
  userId: string;
  email: string;
  walletAddress: string;
}

/**
 * Crossmint Stellar smart wallet, as returned by GET/POST /wallets.
 * Only the fields this demo reads are modeled.
 */
export interface CrossmintWallet {
  type: string;
  chainType: string;
  address: string;
  owner: string;
  config?: {
    adminSigner?: WalletSignerEntry;
    recoveryMethods?: WalletSignerEntry[];
    delegatedSigners?: WalletSignerEntry[];
  };
}

/**
 * Response from POST /wallets/{locator}/signers: the delegated signer entry,
 * with an optional pending transaction the client approves to activate it
 * (absent when the signer needed no approval, e.g. already registered).
 */
export interface DelegatedSignerResponse extends WalletSignerEntry {
  transaction?: { id: string; status?: string };
}

/** Response from POST /wallets/{locator}/recovery-methods: the new recovery method plus its install transaction. */
export interface AddRecoveryMethodResponse {
  recoveryMethods: WalletSignerEntry;
  tx: WalletTransaction;
}

/** Transfer transaction, as returned by POST /wallets/{address}/tokens/{token}/transfers. */
export interface TransferResponse {
  id: string;
  status?: string;
}

/** Wallet transaction, as returned by POST/GET /wallets/{locator}/transactions. */
export interface WalletTransaction {
  id: string;
  status: string;
  error?: unknown;
}

/** Response from POST /api/wallets/migrate. `upToDate` means the wallet needs no migration. */
export type MigrationTransactionResponse = WalletTransaction | { upToDate: true };
