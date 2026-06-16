# Crossmint Stellar Wallets Demo

A reference web app showcasing Crossmint wallet features on **Stellar**, end to end on staging:

1. **Legacy wallet migration** - upgrade a V1 smart wallet to V2 and register a device signer (`upgrade()` + `recover()`).
2. **Server-side wallet and transfer creation** (BFF) - the server holds the secret key; the browser never creates wallets or transactions directly.
3. **OTP signing** - the SDK's built-in email-OTP flow for non-custodial signers.
4. **Export private key** - with an `onExport` compliance hook.
5. **Firebase auth** - bring-your-own-auth bridged into Crossmint.

It runs against a project that has both **legacy Stellar wallets without a device key** and **new wallets**, and handles both with the same code path.

## Architecture (BFF)

As much as possible runs on the server with the secret key; only what *must* be client-side (device key + signer approvals) runs in the browser.

```
Browser (ck_ client key + Firebase JWT)        Next.js server (sk_ server key)
-----------------------------------------      --------------------------------
Firebase login -> setJwt()                      POST /api/auth/signup
createDeviceSigner() -> device {x,y}    ---->     get-or-create Stellar wallet
getWallet({ chain: "stellar" })                   (email admin + device delegated)
migration: upgrade() + recover()
                                                POST /api/wallets/send
build transfer ------------------------>          create USDC transfer tx
wallet.approve({ transactionId })       <----     returns { id }
export: ExportPrivateKeyButton + onExport
```

- **Server side**: wallet creation, transfer creation (`lib/crossmint-server.ts`, `app/api/*`). The server verifies the Firebase ID token and derives the user from it, never from the request body.
- **Client side**: `getWallet`, device-key creation, and migration (`providers/auth-provider.tsx`, `hooks/*`, `lib/wallet-migration.ts`).

Auth is **Firebase** (configured as a 3P auth provider on the Crossmint project, verifier claim `sub`), not Crossmint's built-in auth, so there is no `CrossmintAuthProvider`. `AuthProvider` bridges the Firebase ID token into Crossmint via `setJwt()`.

## The two wallet states

| State | What happens |
|---|---|
| **New wallet** | Created server-side with the email admin signer **and the device signer pre-registered** as a delegated signer. Frictionless from birth, no migration. |
| **Legacy wallet** (no device key) | SDK reports `wallet.needsRecovery() === true`. On load, the client runs `migrateLegacyWallet`: `upgrade()` (V1 -> V2, two-phase, idempotent) then `recover()` to register the device signer. One email OTP, then silent. |

The migration is idempotent: a 409 resumes at phase 2, and an already-V2 wallet returns "no upgrade path" which is treated as a no-op (so new wallets fall straight through to `recover()`).

> See the [Crossmint wallet docs](https://docs.crossmint.com/wallets) for the SDK methods used here.

## Setup

1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Create `.env.local` from the template and fill in staging values:
   ```bash
   cp .env.template .env.local
   ```
   - `NEXT_PUBLIC_CROSSMINT_API_KEY` - Crossmint **client** key (`ck_staging_...`)
   - `CROSSMINT_SERVER_API_KEY` - Crossmint **server** key (`sk_staging_...`), server-side only
   - `CROSSMINT_API_URL` - optional, defaults to staging
   - `NEXT_PUBLIC_FIREBASE_*` - Firebase web config for your project
   - `FIREBASE_SERVICE_ACCOUNT` - optional, for verifying ID tokens in production
3. Run:
   ```bash
   pnpm dev
   ```

Enable the Email/Password sign-in provider in your Firebase project's Authentication settings.

## Using the demo

1. Sign in with Firebase. An existing user whose Stellar wallet predates device signers exercises the **legacy migration** path; a brand-new user exercises the **new-wallet** path.
2. The wallet loads; legacy wallets show "Migrating wallet..." and prompt for a single email OTP, then settle.
3. **Send USDC** - the transfer is created server-side and approved client-side with the device signer (silent post-migration).
4. **Export private key** - exports the email signer key and fires the `onExport` compliance hook.

## File map

| Path | Purpose |
|---|---|
| `lib/crossmint-server.ts` | Server REST client (wallet + transfer creation), holds `sk_` key |
| `lib/firebase-admin.ts` | Verifies the Firebase ID token on the API routes |
| `app/api/auth/signup/route.ts` | Get-or-create the user's Stellar wallet |
| `app/api/wallets/send/route.ts` | Create a USDC transfer transaction |
| `lib/firebase.ts` | Firebase init (web) |
| `lib/api.ts` | Client -> server calls |
| `lib/wallet-migration.ts` | `migrateLegacyWallet`: `upgrade()` + `recover()` |
| `providers/auth-provider.tsx` | Firebase JWT bridge + wallet bootstrap |
| `app/providers.tsx` | Provider stack |
| `hooks/use-wallet-recovery.ts` | Runs migration when `needsRecovery()` |
| `hooks/use-send-transaction.ts` | Server tx creation + client approval |
| `components/export-card.tsx` | `ExportPrivateKeyButton` + `onExport` |
