import { NextResponse } from "next/server";
import { createLifecycleTransaction, getTransaction } from "@/lib/crossmint-server";
import type { LifecycleTransactionType } from "@/lib/crossmint-server";
import { verifyAuth } from "@/lib/firebase-admin";

interface MigrateBody {
  type: LifecycleTransactionType;
}

/**
 * POST /api/wallets/migrate
 * Creates a wallet lifecycle transaction (upgrade-wallet or migrate-wallet)
 * server-side with the secret key. The wallet is resolved from the verified
 * Firebase token's user, never from the request body. The client approves the
 * returned transaction with wallet.approve() (routed to the admin signer's OTP
 * flow). Responds { upToDate: true } when the wallet needs no migration.
 */
export async function POST(request: Request) {
  const user = await verifyAuth(request).catch(() => null);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { type } = (await request.json()) as MigrateBody;
    if (type !== "upgrade-wallet" && type !== "migrate-wallet") {
      return NextResponse.json(
        { error: "type must be upgrade-wallet or migrate-wallet" },
        { status: 400 }
      );
    }
    const tx = await createLifecycleTransaction(user.uid, type);
    return NextResponse.json(tx);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create migration transaction" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/wallets/migrate?transactionId=...
 * Returns the transaction's current status so the client can poll a lifecycle
 * transaction to completion after approving it.
 */
export async function GET(request: Request) {
  const user = await verifyAuth(request).catch(() => null);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const transactionId = new URL(request.url).searchParams.get("transactionId");
  if (!transactionId) {
    return NextResponse.json({ error: "transactionId is required" }, { status: 400 });
  }

  try {
    const tx = await getTransaction(user.uid, transactionId);
    return NextResponse.json(tx);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get transaction" },
      { status: 500 }
    );
  }
}
