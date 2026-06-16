/**
 * Firebase Admin (server-side), used to verify Firebase ID tokens on the API
 * routes. Only imported from route handlers, never from the client.
 *
 * verifyIdToken needs the project id to validate the token's audience and
 * issuer; the signing keys are Google's public certs, so no service account is
 * required just to verify. A service account can be provided via
 * FIREBASE_SERVICE_ACCOUNT (JSON) for production hardening.
 */
import { initializeApp, getApps, getApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;

if (!projectId && !serviceAccount) {
  throw new Error("NEXT_PUBLIC_FIREBASE_PROJECT_ID (or FIREBASE_SERVICE_ACCOUNT) is required");
}

const app = getApps().length
  ? getApp()
  : initializeApp(serviceAccount ? { credential: cert(JSON.parse(serviceAccount)) } : { projectId });

const adminAuth = getAuth(app);

export interface AuthedUser {
  uid: string;
  email: string | null;
}

/**
 * Verifies the Firebase ID token from the Authorization header and returns the
 * caller. Throws if the header is missing or the token is invalid, so routes
 * can never act on an unauthenticated or spoofed user.
 */
export async function verifyAuth(request: Request): Promise<AuthedUser> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new Error("Missing or malformed Authorization header");
  }
  const token = authorization.slice("Bearer ".length);
  const decoded = await adminAuth.verifyIdToken(token);
  return { uid: decoded.uid, email: decoded.email ?? null };
}
