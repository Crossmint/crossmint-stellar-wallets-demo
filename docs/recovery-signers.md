# Stellar Recovery Methods — Multiple Signers & Post-Creation Additions

> **Status:** Multiple recovery methods are **released** for Stellar smart wallets — creation with `config.recoveryMethods`, the `signer`/`approver` disambiguation fields, and the wallets SDK support (`wallet.recoveryMethods`, `useSigner`, `addSigner`/`removeSigner`) are all live.
>
> **Not yet enabled:** the published `POST`/`DELETE /wallets/{walletLocator}/recovery-methods` endpoints for adding or removing a recovery method *after* creation. The routes are in the API reference but currently return `400` — *"Recovery methods are not supported for this wallet type"*. Section 4 documents the released request/response shape for when it is enabled.

The API calls these signers **recovery methods** (earlier docs said *recovery signers* or *admin signers*; the deprecated `adminSigner` field is the same thing). Error messages still quote the older term — reproduced verbatim below.

## Who this is for

Teams that:

- Create wallets and transactions **server-side** (API key), and
- Approve transactions **client-side on mobile** (React Native SDK), and
- Want new wallets created with **both phone and email** recovery methods, and
- Want **existing phone-only wallets** to be able to add an **email** recovery method after creation.

---

## 1. The model

A Stellar smart wallet has **1 to N recovery methods**. They form a flat **1-of-N** set: each recovery method independently holds full admin power — it can sign transactions, approve pending approvals, add/remove delegated signers (e.g. device signers), and recover the wallet on a new device. There is no quorum; any single recovery method is sufficient.

A Stellar wallet supports **up to 8 combined admin (recovery) and delegated signers** — that cap counts both kinds together, so a second recovery method and a device signer share the same budget.

Allowed recovery method types on Stellar: `email`, `phone`, `external-wallet`, `server`. `device` signers can never be recovery methods (they are delegated signers, added per-device).

Key behavioral rule: once a wallet has **more than one** recovery method, any request that needs admin authorization must **name which recovery method authorizes it**. Omitting it returns:

> `400` — *"This wallet has multiple recovery signers. Specify which recovery signer should authorize this request."*

| Operation | Field | Value |
|---|---|---|
| Token transfer / create transaction | `signer` (`params.signer` on raw transactions) | any wallet signer locator (recovery or delegated) |
| Add / remove a delegated signer (`/signers`) | `approver` | locator of one of the wallet's **recovery methods** |
| Add / remove a recovery method (`/recovery-methods`) | `approver` | locator of one of the wallet's **recovery methods** (required) |

Locator format: `email:user@example.com`, `phone:+14155550100`, `device:<base64-public-key>`, `external-wallet:G...`, `server:G...`. The `approver` must exactly match one of the wallet's existing recovery methods — otherwise the API returns `400` listing the valid locators. Wallets with exactly one recovery method keep the previous behavior: `signer`/`approver` are optional and fall back to the sole recovery method.

### SDK surface (`@crossmint/wallets-sdk` ≥ 1.15.0)

- `wallet.recovery` — the **primary** recovery method config (unchanged single-signer shape).
- `wallet.recoveryMethods` — the **full list** of recovery method configs.
- `wallet.useSigner(config)` — matches against **every** recovery method in the list, so any of them can be selected to sign and approve — not only the primary one.
- `wallet.addSigner(...)` / `wallet.removeSigner(...)` — always authorized by a recovery method. On single-recovery wallets that is automatic; on multi-recovery wallets you must `useSigner()` with the recovery method first, and its locator is sent to the API as `approver`. Selecting an operational (delegated) signer for these calls throws `SignerRequiredError` before any request is made.
- `recovery` on `createWallet`/`getOrCreateWallet` accepts a **single config or an array** — arrays are supported on Solana and Stellar only; EVM still takes a single entry.

These versions ship the multi-recovery release: `@crossmint/wallets-sdk@1.15.0`, `@crossmint/client-sdk-react-ui@4.6.1`, `@crossmint/client-sdk-react-native-ui@1.6.3`.

---

## 2. Creating new wallets with phone + email recovery methods (server-side)

Use the `config.recoveryMethods` array. `adminSigner` is deprecated and mutually exclusive with `recoveryMethods` — sending both is rejected with code `RECOVERY_ADMIN_SIGNER_CONFLICT`:

```bash
curl -X POST "https://staging.crossmint.com/api/2025-06-09/wallets" \
  -H "X-API-KEY: $CROSSMINT_SERVER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "chainType": "stellar",
    "type": "smart",
    "owner": "userId:user-123",
    "config": {
      "recoveryMethods": [
        { "type": "phone", "phone": "+14155550100" },
        { "type": "email", "email": "user@example.com" }
      ]
    }
  }'
```

Response — `config.recoveryMethods` returns the full resolved list; `config.adminSigner` keeps returning the *first* entry for backward compatibility:

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
    "recoveryMethods": [
      { "type": "phone", "phone": "+14155550100",    "locator": "phone:+14155550100",     "address": "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37" },
      { "type": "email", "email": "user@example.com", "locator": "email:user@example.com", "address": "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ" }
    ],
    "delegatedSigners": []
  }
}
```

SDK equivalent — pass the same list to `recovery` (arrays accepted on Solana and Stellar):

```typescript
const wallet = await crossmintWallets.getOrCreateWallet({
  chain: "stellar",
  recovery: [
    { type: "phone", phone: "+14155550100" },
    { type: "email", email: "user@example.com" },
  ],
  ...
});
```

Validation notes:

- Any mix is valid: phone + email, multiple phones, multiple emails.
- Duplicates are rejected (same locator twice, or two inputs resolving to the same on-chain key).
- All creation-time recovery methods participate in the wallet's address derivation.
- `recoveryMethods` replaces `adminSigner`; a single-entry `recovery` array also maps to `recoveryMethods` on the API side.

---

## 3. Creating transfers server-side, approving on mobile

Create the transfer with the token transfer API and name the signer that will approve it. Either recovery method (phone or email) — or a registered device signer — can be used:

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

`signer` is optional and defaults to the primary (first) recovery method — on multi-recovery wallets, set it whenever you want a non-primary method to authorize. On raw transaction creation the field is `params.signer`, with the same default.

The response's `approvals.pending[]` names that signer's locator. The mobile app then approves it.

### Mobile approval (React Native SDK — `@crossmint/client-sdk-react-native-ui`)

On mobile, select the signer that matches the transaction's pending approval with `wallet.useSigner(...)`, then complete the OTP flow. `useSigner` resolves **any** recovery method in the list, not just the primary:

```tsx
import { useWallet, useWalletOtpSigner } from "@crossmint/client-sdk-react-native-ui";

function ApproveTransaction({ transactionId }: { transactionId: string }) {
  const { wallet } = useWallet();
  const { needsAuth, sendOtp, verifyOtp } = useWalletOtpSigner();

  async function approve() {
    // Switch the active signer to the one named in the transaction's pending approval.
    // Works for recovery methods (phone/email) and registered device signers.
    await wallet.useSigner({ type: "phone", phone: "+14155550100" });

    // Approving triggers the OTP flow for phone/email signers:
    // needsAuth flips to true → sendOtp() → user enters code → verifyOtp(code)
    await wallet.approve({ transactionId });
  }

  // render OTP input when needsAuth is true...
}
```

To approve with the email recovery method instead: `wallet.useSigner({ type: "email", email: "user@example.com" })`.

To read the wallet's methods: `wallet.recovery` (primary) and `wallet.recoveryMethods` (full list).

---

## 4. Adding an email recovery method to existing (phone-only) wallets — not yet enabled

The API publishes dedicated endpoints for post-creation recovery-method management, following the same server-side-create / client-side-approve pattern as delegated-signer registration (the flow this demo implements). **The routes exist in the API reference but are not enabled yet — calls currently return `400`, *"Recovery methods are not supported for this wallet type"*.** The request/response shape below is the released surface.

> Adding a recovery method later does **not** change the wallet address.

**Server-side request:**

```bash
curl -X POST "https://staging.crossmint.com/api/2025-06-09/wallets/$WALLET/recovery-methods" \
  -H "X-API-KEY: $CROSSMINT_SERVER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "recoveryMethods": { "type": "email", "email": "user@example.com" },
    "approver": "phone:+14155550100"
  }'
```

- `recoveryMethods` — one method per request, as a signer object (`{ "type": "email", "email": "..." }`) or a locator string (`"email:user@example.com"`). No `chain` field on Stellar (EVM only).
- `approver` — **required**; the existing recovery method that authorizes the addition.
- Response: `{ "recoveryMethods": <the method being added, with its resolved locator>, "tx": <transaction> }` — the returned transaction's `approvals.pending[]` names the approver.

**Client-side approval (mobile):** identical to section 3 — `useSigner` with the phone recovery method, phone OTP approves the pending transaction. Once confirmed, the email method appears in `config.recoveryMethods` (and `wallet.recoveryMethods`) and can independently sign transactions, approve, add device signers, and recover the wallet.

**Removal:** `DELETE /api/2025-06-09/wallets/$WALLET/recovery-methods/{signer}?approver=<locator>` — returns a transaction that must be approved the same way.

**SDK:** there is no dedicated `wallet.addRecoveryMethod` function yet — recovery-method management is REST-only; `wallet.addSigner`/`wallet.removeSigner` manage **delegated** signers (they already pick up the selected recovery method as `approver` on multi-recovery wallets).

Validations mirror creation: allowed types only (`email`, `phone`, `external-wallet`, `server` — never `device`), duplicate rejection, and the 8-combined-signer cap counting existing recovery methods and delegated signers.

---

## 5. Interaction with the device-signer migration

Wallets migrating to device signers (the flow this demo implements) are unaffected:

- Device signers remain **delegated** signers, added via `POST .../signers` and approved by a recovery method, exactly as in this demo.
- Once the wallet has both phone and email recovery methods, device-signer additions must name which one approves — `"approver": "phone:+14155550100"` on the REST call; via the SDK, `wallet.useSigner(...)` with that recovery method before `wallet.addSigner(...)`.
- Day-to-day transactions keep using the device signer; the recovery methods (phone and/or email) are only needed for approvals, signer management, and recovery on a new device.

---

## 6. Error reference

| Situation | Result |
|---|---|
| `recoveryMethods` and `adminSigner` both set at creation | `400` / `RECOVERY_ADMIN_SIGNER_CONFLICT` — *"'adminSigner' is deprecated and cannot be combined with 'recoveryMethods'. Send 'recoveryMethods' only."* |
| Neither `recoveryMethods` nor `adminSigner` at creation | `400` — *"An admin signer is required: provide 'recoveryMethods' (recommended) or the deprecated 'adminSigner'."* |
| Same locator twice in `recoveryMethods` | `400` — *"Duplicate admin signer '\<locator\>': every admin signer must be distinct."* |
| Two inputs resolving to same on-chain address | `400` — *"Duplicate recovery signer: two signers resolve to the address '\<address\>'."* |
| Over the 8 combined signer cap | `400` / `SIGNER_LIMIT_EXCEEDED` |
| `device` as a recovery method | `400` (not an allowed type) |
| Multi-recovery wallet, no `signer`/`approver` on the request | `400` — *"This wallet has multiple recovery signers. Specify which recovery signer should authorize this request."* |
| `approver` not one of the wallet's recovery methods | `400` — *"'approver' must be one of the wallet's recovery signers. It should be \<valid locators\>"* |
| `POST`/`DELETE /recovery-methods` called today | `400` — *"Recovery methods are not supported for this wallet type"* (endpoints published, not yet enabled) |
