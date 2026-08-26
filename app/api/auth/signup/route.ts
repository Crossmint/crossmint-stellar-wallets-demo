import { NextResponse } from "next/server";
import { getOrCreateWallet } from "@/lib/crossmint-server";
import { verifyAuth } from "@/lib/firebase-admin";
import type { DevicePublicKey } from "@/lib/types";

/**
 * POST /api/auth/signup
 * Creates (or returns) the caller's Stellar smart wallet server-side. The user
 * is taken from the verified Firebase ID token, never from the request body,
 * so a caller can only ever act on their own wallet. The device public key and
 * operational email, when present, are registered as delegated signers at
 * creation time.
 */
export async function POST(request: Request) {
  const user = await verifyAuth(request).catch(() => null);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!user.email) {
    return NextResponse.json({ error: "Firebase token has no email" }, { status: 400 });
  }

  try {
    const { devicePublicKey, operationalEmail } = (await request.json()) as {
      devicePublicKey?: DevicePublicKey;
      operationalEmail?: string;
    };
    const wallet = await getOrCreateWallet(user.uid, user.email, {
      devicePublicKey,
      operationalEmail,
    });
    return NextResponse.json({ userId: user.uid, email: user.email, walletAddress: wallet.address });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sign up" },
      { status: 500 }
    );
  }
}
