pragma solidity ^0.5.0;

import 'openzeppelin-solidity/contracts/ownership/Ownable.sol';
import 'openzeppelin-solidity/contracts/token/ERC20/ERC20.sol';

contract ReferralTracker is Ownable {
    uint256 public referralBonus;

    mapping(address => uint256) public unclaimedReferrals;
    address public registryAddress;
    ERC20 token;

    event ReferralRegistered(address referrer);
    event ReferralBonusWithdrawn(address referrer, uint256 amount);

    constructor(uint256 referralBonus_, address registryAddress_, address tokenAdress) public {
        referralBonus = referralBonus_;
        registryAddress = registryAddress_;
        token = ERC20(tokenAdress);
    }

    modifier onlyRegistry() {
        require(msg.sender == registryAddress);
        _;
    }

    function drawFunds(uint256 amount) public onlyOwner {
        token.transferFrom(msg.sender, address(this), amount);
    }

    function registerReferral(address referrer) public onlyRegistry {
        unclaimedReferrals[referrer] += 1;

        emit ReferralRegistered(referrer);
    }

    function withdraw(address to) public {
        require(unclaimedReferrals[msg.sender] > 0);
        uint256 amount = referralBonus*unclaimedReferrals[msg.sender];
        unclaimedReferrals[msg.sender] = 0;

        token.transferFrom(address(this), to, amount);

        emit ReferralBonusWithdrawn(msg.sender, amount);
    }

    function numReferrals(address user) public view returns (uint256) {
        return unclaimedReferrals[user];
    }
}
