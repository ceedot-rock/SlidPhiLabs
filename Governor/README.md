# SpendingGovernor (Base)

Daily cap + merchant allowlist in front of a hot agent wallet.
Native value only in v1. No ERC20 path on purpose.

Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.

## Deploy (needs forge or solc + cast; neither is on the box yet)

```bash
forge create --rpc-url base --private-key $DEPLOYER \
  Governor/SpendingGovernor.sol:SpendingGovernor \
  --constructor-args 100000000000000000  # 0.1 ETH/day starting cap
```

## Configure

1. `setMerchant(<payTo>, true)` for each approved rail address.
2. Send no more than $1 first. Verify `Spent` event and cap math.
3. Move ownership to cold storage before serious funding.
4. `setPaused(true)` is the kill switch. It stays available.

## Out of scope for v1

- ERC20 allowances (USDC path comes with a token governor next).
- Multi-sig ownership (promote owner to a Safe at funding time).
