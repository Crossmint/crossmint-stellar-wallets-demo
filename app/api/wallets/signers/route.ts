import { NextResponse } from "next/server";
import { addDelegatedSigner, removeSigner } from "@/lib/crossmint-server";
import { verifyAuth } from "@/lib/firebase-admin";
import type { DelegatedSignerInput } from "@/lib/types";

interface SignerBody {
  signer: DelegatedSignerInput | string;
  /** Recovery-method locator that authorizes the change. Required when the wallet has multiple recovery methods. */
  approver?: string;
}

/**
 * POST /api/wallets/signers
 * Registers a delegated signer on the caller's wallet. The response carries a
 * pending transaction the client approves with the chosen recovery method
 * (useSigner + wallet.approve, OTP flow). `approver` names the recovery
 * method authorizing the add - required on multi-recovery wallets.
 */
export async function POST(request: Request) {
  const user = await verifyAuth(request).catch(() => null);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { signer, approver } = (await request.json()) as SignerBody;
    if (!signer) {
      return NextResponse.json({ error: "signer is required" }, { status: 400 });
    }
    const result = await addDelegatedSigner(user.uid, signer, approver);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to add signer" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/wallets/signers
 * Removes a signer (delegated or recovery method) by locator. Body:
 * { signer, approver }. Same approver rule as POST.
 */
export async function DELETE(request: Request) {
  const user = await verifyAuth(request).catch(() => null);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { signer, approver } = (await request.json()) as SignerBody;
    if (!signer) {
      return NextResponse.json({ error: "signer locator is required" }, { status: 400 });
    }
    const result = await removeSigner(user.uid, String(signer), approver);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to remove signer" },
      { status: 500 }
    );
  }
}
