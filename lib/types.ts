/** P-256 device-signer public key coordinates (base64url), as returned by createDeviceSigner(). */
export interface DevicePublicKey {
  x: string;
  y: string;
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
}

/** Transfer transaction, as returned by POST /wallets/{address}/tokens/{token}/transfers. */
export interface TransferResponse {
  id: string;
  status?: string;
}
