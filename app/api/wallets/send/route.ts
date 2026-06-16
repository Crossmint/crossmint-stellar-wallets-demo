import { NextResponse } from "next/server";
import { getWallet, createSendTransaction } from "@/lib/crossmint-server";
import { verifyAuth } from "@/lib/firebase-admin";

interface SendBody {
  to: string;
  amount: string;
  signer?: string;
}

/**
 * POST /api/wallets/send
 * Creates a USDC transfer from the caller's wallet. The wallet is resolved from
 * the verified Firebase token's user, not the request body. The client then
 * approves the transaction with its device signer.
 */
export async function POST(request: Request) {
  const user = await verifyAuth(request).catch(() => null);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { to, amount, signer } = (await request.json()) as SendBody;
    if (!to || !amount) {
      return NextResponse.json({ error: "to and amount are required" }, { status: 400 });
    }
    const wallet = await getWallet(user.uid);
    const tx = await createSendTransaction(String(wallet.address), to, amount, signer);
    return NextResponse.json(tx);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send transaction" },
      { status: 500 }
    );
  }
}
