// SPDX-License-Identifier: AGPL-3.0-or-later
// Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
pragma solidity 0.8.24;

/// @title SpendingGovernor — daily cap + merchant allowlist for a hot agent wallet.
/// @notice Funds move IN here; the agent spends OUT within policy. Owner sets
/// policy and sweeps. Move ownership to cold storage before serious funding.
contract SpendingGovernor {
    address public owner;
    uint256 public dailyCap;
    uint256 public spentToday;
    uint256 public dayStart;
    mapping(address => bool) public merchant;
    bool public paused;

    event Spent(address indexed to, uint256 amount, uint256 day);
    event Funded(address indexed from, uint256 amount);
    event Capped(uint256 dailyCap);
    event MerchantSet(address indexed who, bool ok);
    event Swept(address indexed to, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "not-owner");
        _;
    }

    constructor(uint256 _dailyCap) {
        owner = msg.sender;
        dailyCap = _dailyCap;
        dayStart = block.timestamp / 1 days;
    }

    receive() external payable {
        emit Funded(msg.sender, msg.value);
    }

    function setCap(uint256 c) external onlyOwner {
        dailyCap = c;
        emit Capped(c);
    }

    function setMerchant(address who, bool ok) external onlyOwner {
        merchant[who] = ok;
        emit MerchantSet(who, ok);
    }

    function setPaused(bool p) external onlyOwner {
        paused = p;
    }

    /// @dev No ERC20 path in v1: native value only. Tokens stay out.
    function spend(address payable to, uint256 amount) external onlyOwner {
        require(!paused, "paused");
        require(merchant[to], "not-merchant");
        uint256 day = block.timestamp / 1 days;
        if (day != dayStart) {
            dayStart = day;
            spentToday = 0;
        }
        require(spentToday + amount <= dailyCap, "over-cap");
        spentToday += amount;
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "send-failed");
        emit Spent(to, amount, day);
    }

    function sweep(address payable to, uint256 amount) external onlyOwner {
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "send-failed");
        emit Swept(to, amount);
    }
}
