---
"@opa.sh/sdk": patch
---

Remove `bearerToken` auth option and `idempotencyKey` request option — the Opa API only accepts `x-api-key` and does not support an `Idempotency-Key` header. Both were exposed by mistake.
