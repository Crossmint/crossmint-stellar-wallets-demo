import { NextResponse } from "next/server";
import { registerEmailSigner } from "@/lib/crossmint-server";
import { verifyAuth } from "@/lib/firebase-admin";

interface SignerBody {
  email?: string;
}

/** Split-based check instead of a regex: an `a@b.c`-shaped pattern backtracks polynomially on adversarial input. */
function isEmailLike(value: string): boolean {
  const parts = value.split("@");
  if (parts.length !== 2) {
    return false;
  }

  const [local, domain] = parts;
  if (local.length === 0 || /\s/.test(value)) {
    return false;
  }

  const dot = domain.lastIndexOf(".");
  return dot > 0 && dot < domain.length - 1;
}

/**
 * POST /api/wallets/signers
 * Registers an operational email signer for the caller's wallet.
 */
export async function POST(request: Request) {
  const user = await verifyAuth(request).catch(() => null);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { email } = (await request.json()) as SignerBody;
    const normalizedEmail = email?.trim();
    if (normalizedEmail == null || !isEmailLike(normalizedEmail)) {
      return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
    }

    const registration = await registerEmailSigner(user.uid, normalizedEmail);
    return NextResponse.json(registration);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to register email signer" },
      { status: 500 }
    );
  }
}
