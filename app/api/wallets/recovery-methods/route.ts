import { NextResponse } from "next/server";
import { addRecoveryMethod, removeRecoveryMethod } from "@/lib/crossmint-server";
import { verifyAuth } from "@/lib/firebase-admin";
import type { RecoverySigner } from "@/lib/types";

interface RecoveryMethodBody {
  recoveryMethods?: RecoverySigner | string;
  signer?: string;
  approver?: string;
}

/**
 * POST /api/wallets/recovery-methods
 * Adds a recovery method to the caller's wallet post-creation. `approver` is
 * required - only an existing recovery method may authorize a new one. The
 * response carries a pending transaction the client approves with that
 * method (OTP flow).
 *
 * NOTE: the /recovery-methods endpoints are published in the API but not yet
 * enabled for Stellar - they currently return 400 "Recovery methods are not
 * supported for this wallet type". The route is wired so the demo is ready
 * when it ships; the client surfaces the API error as-is.
 */
export async function POST(request: Request) {
  const user = await verifyAuth(request).catch(() => null);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { recoveryMethods, approver } = (await request.json()) as RecoveryMethodBody;
    if (!recoveryMethods) {
      return NextResponse.json({ error: "recoveryMethods is required" }, { status: 400 });
    }
    if (!approver) {
      return NextResponse.json({ error: "approver is required" }, { status: 400 });
    }
    const result = await addRecoveryMethod(user.uid, recoveryMethods, approver);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to add recovery method" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/wallets/recovery-methods
 * Removes a recovery method by locator. Body: { signer, approver }. Same
 * not-yet-enabled caveat as POST.
 */
export async function DELETE(request: Request) {
  const user = await verifyAuth(request).catch(() => null);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { signer, approver } = (await request.json()) as RecoveryMethodBody;
    if (!signer) {
      return NextResponse.json({ error: "signer locator is required" }, { status: 400 });
    }
    if (!approver) {
      return NextResponse.json({ error: "approver is required" }, { status: 400 });
    }
    const result = await removeRecoveryMethod(user.uid, signer, approver);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to remove recovery method" },
      { status: 500 }
    );
  }
}
