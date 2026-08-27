import { NextResponse } from "next/server";
import { createLifecycleTransaction } from "@/lib/crossmint-server";
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
 * flow) and polls it to completion directly against the Crossmint API with the
 * client key. Responds { upToDate: true } when the wallet needs no migration.
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

