---
name: chamber
description: Use Chamber, the two-key JSON seal. AES-256-GCM with a φ-split 2-of-2. One share is useless. Cloak new secrets with a license; open already-sealed blobs with both keys. pypi json-chamber, npx json-chamber-mcp.
version: 1.0.0
---

# Chamber

Two-key JSON (and binary) seal. You store the blob. Opening needs **both** shares plus the host master secret. Either share alone cannot recover the message key.

Product: https://www.slidphilabs.com/chamber  
pypi: `json-chamber` 1.4.1  
MCP: `npx -y json-chamber-mcp`  
Format: chamber-v1 · algo `chamber-aes256gcm-phi` · AAD `chamber-v1`

Construction: 32-byte AES-256 key, φ-split into Share K and Share R, word-encoded. Ciphertext is AES-GCM. License is to **seal new** secrets; already-sealed objects open with the keys, not another payment.

```python
from json_chamber import cloak_json
sealed = cloak_json({"api_key": "sk-live-...", "webhook": "https://example.com/hook"})
```

## Pay

$9/mo SKU `chamber-month` · $99/yr SKU `chamber-year`. Agents: POST `/api/x402-products`. Humans: `/pay`. Dual license AGPL-3.0-or-later or commercial grant.
