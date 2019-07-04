pragma solidity ^0.5.0;

import 'openzeppelin-solidity/contracts/ownership/Ownable.sol';
import 'openzeppelin-solidity/contracts/token/ERC20/ERC20.sol';
import 'openzeppelin-solidity/contracts/math/SafeMath.sol';

contract ReferralTracker is Ownable {
    uint256 public REFERRAL_BONUS = 100000000000000000000;

    mapping(address => uint256) public unclaimedReferrals;
    address public registryAddress;
    ERC20 token;

    event ReferralRegistered(address referralAddress, address indexed referrer, address indexed user);
    event ReferralBonusWithdrawn(address referralAddress, address indexed referrer, uint256 amount, uint256 currentTrackerBalance);

    constructor(address registryAddress_, address tokenAdress) public {
        registryAddress = registryAddress_;
        token = ERC20(tokenAdress);
    }

    modifier onlyRegistry() {
        require(msg.sender == registryAddress, 'The executor is not the registry');
        _;
    }

    function addFunds(uint256 amount) public onlyOwner {
        token.transferFrom(msg.sender, address(this), amount);
    }

    function registerReferral(address referrer, address user) public onlyRegistry {
        unclaimedReferrals[referrer] = unclaimedReferrals[referrer].add(1);

        emit ReferralRegistered(address(this), referrer, user);
    }

    function withdraw(address to) public {
        require(unclaimedReferrals[msg.sender] > 0, 'no referrals to claim');
        uint256 trackerBalance = token.balanceOf(address(this));
        uint256 amount = REFERRAL_BONUS*unclaimedReferrals[msg.sender];

        require(trackerBalance >= amount, 'Not enough founds');
        unclaimedReferrals[msg.sender] = 0;

        token.transfer(to, amount);

        emit ReferralBonusWithdrawn(address(this), msg.sender, amount, trackerBalance);
    }

    function numReferrals(address user) public view returns (uint256) {
        return unclaimedReferrals[user];
    }
}
