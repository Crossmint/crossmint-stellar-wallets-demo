"use client";

/**
 * Shows the migration state. While `isRecovering` the wallet is running the
 * V1 -> V2 upgrade and registering its device signer (the user may be prompted
 * for an email OTP via the SDK's built-in dialog). Once done, signing is
 * frictionless.
 */
export function MigrationBanner({
  isRecovering,
  needsRecovery,
}: {
  isRecovering: boolean;
  needsRecovery: boolean;
}) {
  if (isRecovering) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
        <span>Migrating wallet to V2 and registering your device signer...</span>
      </div>
    );
  }

  if (needsRecovery) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        This wallet needs a one-time upgrade to register a device signer.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
      Wallet ready. Device signer registered, signing is frictionless.
    </div>
  );
}
