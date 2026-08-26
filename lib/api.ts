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
  DevicePublicKey,
  EmailSignerRegistration,
  SignUpResponse,
  TransferResponse,
} from "./types";

/** Creates (or fetches) the caller's wallet server-side. Passes the device signer public key so the server registers it as a delegated signer. */
export async function signup(
  jwt: string,
  devicePublicKey?: DevicePublicKey,
  operationalEmail?: string
): Promise<SignUpResponse> {
  const res = await fetch("/api/auth/signup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({ devicePublicKey, operationalEmail }),
  });

  if (!res.ok) {
    throw new Error((await res.text()) || "Failed to sign up");
  }
  return res.json() as Promise<SignUpResponse>;
}

/** Creates a USDC transfer transaction server-side. Pass the device signer locator so the approval is routed to it. */
export async function createTransaction(
  jwt: string,
  to: string,
  amount: string,
  signer?: string
): Promise<TransferResponse> {
  const res = await fetch("/api/wallets/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({ to, amount, signer }),
  });

  if (!res.ok) {
    throw new Error((await res.text()) || "Failed to send transaction");
  }
  return res.json() as Promise<TransferResponse>;
}

/** Registers an operational email signer for the caller's wallet server-side. */
export async function addEmailSigner(jwt: string, email: string): Promise<EmailSignerRegistration> {
  const res = await fetch("/api/wallets/signers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({ email }),
  });

  if (!res.ok) {
    throw new Error((await res.text()) || "Failed to register email signer");
  }
  return res.json() as Promise<EmailSignerRegistration>;
}
