/**
 * Server-side Crossmint REST client.
 *
 * Holds the SECRET server API key (CROSSMINT_SERVER_API_KEY). Only ever
 * imported from route handlers under app/api - never from a client component.
 * The web client only carries the public client key and cannot create wallets
 * or transactions directly; it goes through these endpoints.
 */
import type {
  CrossmintWallet,
  DevicePublicKey,
  EmailSignerRegistration,
  TransferResponse,
} from "./types";

const CROSSMINT_API_URL =
  process.env.CROSSMINT_API_URL ?? "https://staging.crossmint.com/api/2025-06-09";
const CROSSMINT_API_KEY = process.env.CROSSMINT_SERVER_API_KEY;

if (!CROSSMINT_API_KEY) {
  throw new Error("CROSSMINT_SERVER_API_KEY is not set");
}

const apiKey: string = CROSSMINT_API_KEY;

const jsonHeaders = {
  "Content-Type": "application/json",
  "X-API-KEY": apiKey,
};

function stellarWalletLocator(userId: string): string {
  return `userId:${userId}:stellar:smart`;
}

interface CreateWalletConfig {
  adminSigner: { type: "email"; email: string };
  delegatedSigners?: Array<{
    signer: { type: "device"; publicKey: DevicePublicKey } | { type: "email"; email: string };
  }>;
}

/**
 * GET-first: returns the existing Stellar smart wallet for the user, creating
 * one only on a 404. A non-200/non-404 GET is a hard error (no silent
 * fallthrough). New wallets are created with the email admin signer and, when a
 * device public key is supplied, that device signer pre-registered as a
 * delegated signer - so new wallets are frictionless from birth.
 */
export async function getOrCreateWallet(
  userId: string,
  email: string,
  options?: { devicePublicKey?: DevicePublicKey; operationalEmail?: string }
): Promise<CrossmintWallet> {
  const getRes = await fetch(`${CROSSMINT_API_URL}/wallets/${stellarWalletLocator(userId)}`, {
    headers: { "X-API-KEY": apiKey },
  });

  if (getRes.ok) {
    return getRes.json() as Promise<CrossmintWallet>;
  }
  if (getRes.status !== 404) {
    throw new Error(`Failed to check existing wallet: ${getRes.status} ${await getRes.text()}`);
  }

  const config: CreateWalletConfig = {
    adminSigner: { type: "email", email },
  };
  const delegatedSigners: NonNullable<CreateWalletConfig["delegatedSigners"]> = [];
  if (options?.devicePublicKey != null) {
    delegatedSigners.push({ signer: { type: "device", publicKey: options.devicePublicKey } });
  }
  if (options?.operationalEmail != null) {
    delegatedSigners.push({ signer: { type: "email", email: options.operationalEmail } });
  }
  if (delegatedSigners.length > 0) {
    config.delegatedSigners = delegatedSigners;
  }

  const res = await fetch(`${CROSSMINT_API_URL}/wallets`, {
    method: "POST",
    headers: jsonHeaders,
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

export async function registerEmailSigner(
  userId: string,
  email: string
): Promise<EmailSignerRegistration> {
  const res = await fetch(`${CROSSMINT_API_URL}/wallets/${stellarWalletLocator(userId)}/signers`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ signer: { type: "email", email } }),
  });

  if (!res.ok) {
    throw new Error(`Failed to register email signer: ${res.status} ${await res.text()}`);
  }

  const body = (await res.json()) as {
    locator: string;
    address: string;
    transaction?: { id: string; status?: string };
  };
  const registration: EmailSignerRegistration = {
    locator: body.locator,
    address: body.address,
  };
  if (body.transaction != null) {
    registration.transactionId = body.transaction.id;
    if (body.transaction.status != null) {
      registration.status = body.transaction.status;
    }
  }
  return registration;
}

export async function getWallet(userId: string): Promise<CrossmintWallet> {
  const res = await fetch(`${CROSSMINT_API_URL}/wallets/${stellarWalletLocator(userId)}`, {
    headers: { "X-API-KEY": apiKey },
  });
  if (!res.ok) {
    throw new Error(`Failed to get wallet: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<CrossmintWallet>;
}

/**
 * Creates a USDC transfer transaction. When a signer locator is passed (the
 * device signer post-migration), the approval is routed to it so signing is
 * frictionless; otherwise it falls back to the wallet's admin email signer.
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
      headers: jsonHeaders,
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to send transaction: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<TransferResponse>;
}
