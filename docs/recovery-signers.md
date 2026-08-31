# Stellar Recovery Signers — Multiple Signers & Post-Creation Additions

> **Status: draft, subject to change.** This document describes upcoming Crossmint Wallet API and SDK behavior for Stellar smart wallets. Field names, endpoints, and SDK method signatures may change before general availability. Sections marked **[Proposed]** are not yet publicly available.

## Who this is for

Teams that:

- Create wallets and transactions **server-side** (API key), and
- Approve transactions **client-side on mobile** (React Native SDK), and
- Want new wallets created with **both phone and email** recovery signers, and
- Want **existing phone-only wallets** to be able to add an **email** recovery signer after creation.

---

## 1. The model

A Stellar smart wallet has **1 to N recovery signers** (limited to 10 as of now). They form a flat **1-of-N** set: each recovery signer independently holds full admin power — it can sign transactions, approve pending approvals, add/remove delegated signers (e.g. device signers), and recover the wallet on a new device. There is no quorum; any single recovery signer is sufficient.

Allowed recovery signer types on Stellar: `email`, `phone`, `external-wallet`, `server`. `device` signers can never be recovery signers (they are delegated signers, added per-device).

Key behavioral rule: once a wallet has **more than one** recovery signer, any request that needs admin authorization must **name which recovery signer authorizes it**. Omitting it returns:

> `400` — *"This wallet has multiple recovery signers. Specify which recovery signer should authorize this request."*

| Operation | Field | Value |
|---|---|---|
| Token transfer / create transaction | `signer` (`params.signer` on raw transactions) | any wallet signer locator (recovery or delegated) |
| Add / remove a signer | `approver` | locator of one of the wallet's **recovery** signers |

Locator format: `email:user@example.com`, `phone:+14155550100`, `device:<base64-public-key>`, `external-wallet:G...`. The `approver` must exactly match one of the wallet's existing recovery signers — otherwise the API returns `400` listing the valid locators. Wallets with exactly one recovery signer keep today's behavior: `signer`/`approver` are optional and fall back to the sole recovery signer.

---

## 2. Creating new wallets with phone + email recovery (server-side)

Use the `config.recovery` array (replaces the deprecated single `adminSigner`; sending both is rejected):

```bash
curl -X POST "https://staging.crossmint.com/api/2025-06-09/wallets" \
  -H "X-API-KEY: $CROSSMINT_SERVER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "chainType": "stellar",
    "type": "smart",
    "owner": "userId:user-123",
    "config": {
      "recovery": [
        { "type": "phone", "phone": "+14155550100" },
        { "type": "email", "email": "user@example.com" }
      ]
    }
  }'
```

Response — `config.recovery` returns the full resolved list; `config.adminSigner` keeps returning the *first* entry for backward compatibility:

```json
{
  "address": "CCPJPJGL2GJFOYMZUDBINNUADGK2KMGIB6KQAOQAOI4REWAHLBWUHLXQ",
  "chainType": "stellar",
  "type": "smart",
  "config": {
    "adminSigner": {
      "type": "phone",
      "phone": "+14155550100",
      "locator": "phone:+14155550100",
      "address": "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37"
    },
    "recovery": [
      { "type": "phone", "phone": "+14155550100",    "locator": "phone:+14155550100",     "address": "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37" },
      { "type": "email", "email": "user@example.com", "locator": "email:user@example.com", "address": "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ" }
    ],
    "delegatedSigners": []
  }
}
```

Validation notes:

- Any mix is valid: phone + email, multiple phones, multiple emails.
- Duplicates are rejected (same locator twice, or two inputs resolving to the same on-chain key).
- All creation-time recovery signers participate in the wallet's address derivation.

---

## 3. Creating transfers server-side, approving on mobile

Create the transfer with the token transfer API and name the signer that will approve it. Either recovery signer (phone or email) — or a registered device signer — can be used:

```bash
curl -X POST "https://staging.crossmint.com/api/2025-06-09/wallets/$WALLET/tokens/usdc/transfers" \
  -H "X-API-KEY: $CROSSMINT_SERVER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "recipient": "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37",
    "amount": "10",
    "signer": "phone:+14155550100"
  }'
```

`signer` is optional on single-recovery wallets (defaults to the recovery signer); on multi-recovery wallets it must name the authorizing signer.

The response's `approvals.pending[]` names that signer's locator. The mobile app then approves it.

### Mobile approval (React Native SDK — `@crossmint/client-sdk-react-native-ui`)

On mobile, select the signer that matches the transaction's pending approval with `wallet.useSigner(...)`, then complete the OTP flow:

```tsx
import { useWallet, useWalletOtpSigner } from "@crossmint/client-sdk-react-native-ui";

function ApproveTransaction({ transactionId }: { transactionId: string }) {
  const { wallet } = useWallet();
  const { needsAuth, sendOtp, verifyOtp } = useWalletOtpSigner();

  async function approve() {
    // Switch the active signer to the one named in the transaction's pending approval.
    // Works for recovery signers (phone/email) and registered device signers.
    await wallet.useSigner({ type: "phone", phone: "+14155550100" });

    // Approving triggers the OTP flow for phone/email signers:
    // needsAuth flips to true → sendOtp() → user enters code → verifyOtp(code)
    await wallet.approve({ transactionId });
  }

  // render OTP input when needsAuth is true...
}
```

To approve with the email recovery signer instead: `wallet.useSigner({ type: "email", email: "user@example.com" })`.

---

## 4. Adding an email recovery signer to existing (phone-only) wallets **[Proposed]**

Existing wallets created with a single phone recovery signer will be able to add an email **recovery** signer after creation. This follows the same server-side-create / client-side-approve pattern as device-signer registration (the flow this demo implements), with two differences: the request carries `role: "recovery"`, and the `approver` must be an existing **recovery** signer.

> Adding a recovery signer later does **not** change the wallet address.

**Server-side request:**

```bash
curl -X POST "https://staging.crossmint.com/api/2025-06-09/wallets/$WALLET/signers" \
  -H "X-API-KEY: $CROSSMINT_SERVER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "signer": { "type": "email", "email": "user@example.com" },
    "role": "recovery",
    "approver": "phone:+14155550100"
  }'
```

- `role` defaults to `"delegated"` (today's behavior, used for device signers). `role: "recovery"` adds the signer as a full recovery signer.
- `approver` is the **existing phone recovery signer** (optional while the wallet still has exactly one recovery signer, required after that).
- The response is the standard transaction shape with `approvals.pending[]` naming the phone signer.

**Client-side approval (mobile):** identical to section 3 — `useSigner` with the phone signer, phone OTP approves the pending signer-addition transaction. Once confirmed, the email signer appears in `config.recovery` and can independently sign transactions, approve, add device signers, and recover the wallet.

**SDK equivalent [Proposed]:**

```typescript
await wallet.addRecoverySigner(
  { type: "email", email: "user@example.com" },
  { approver: "phone:+14155550100" }
);
```

Validations mirror creation: allowed types only (`email`, `phone`, `external-wallet`, `server` — never `device`), duplicate rejection, and the 10-recovery-signer cap counting existing ones.

---

## 5. Interaction with the device-signer migration

Wallets migrating to device signers (the flow this demo implements) are unaffected:

- Device signers remain **delegated** signers, added via `POST .../signers` with the default role and approved by a recovery signer, exactly as in this demo.
- Once the wallet has both phone and email recovery signers, device-signer additions must name which recovery signer approves, e.g. `"approver": "phone:+14155550100"`.
- Day-to-day transactions keep using the device signer; the recovery signers (phone and/or email) are only needed for approvals, signer management, and recovery on a new device.

---

## 6. Error reference

| Situation | Result |
|---|---|
| `recovery` and `adminSigner` both set at creation | `400` (conflict — provide only one) |
| Same locator twice in `recovery` | `400` "Duplicate admin signer '<locator>'..." |
| Two inputs resolving to same on-chain address | `400` "Duplicate recovery signer..." |
| More than 10 recovery signers | `400` (array max 10) |
| `device` as a recovery signer | `400` (not an allowed type) |
| Multi-recovery wallet, no `signer`/`approver` on the request | `400` "This wallet has multiple recovery signers. Specify which recovery signer should authorize this request." |
| `approver` not one of the wallet's recovery signers | `400` "'approver' must be one of the wallet's recovery signers. It should be <valid locators>" |
