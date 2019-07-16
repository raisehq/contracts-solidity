pragma solidity 0.5.10;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/lifecycle/Pausable.sol";

contract ReferralTracker is Ownable, Pausable {
    using SafeMath for uint256;
    uint256 public REFERRAL_BONUS = 100000000000000000000;

    mapping(address => uint256) public unclaimedReferrals;
    address public registryAddress;
    address public admin;
    ERC20 token;

    event ReferralRegistered(
        address referralAddress,
        address indexed referrer,
        address indexed user
    );
    event ReferralBonusWithdrawn(
        address referralAddress,
        address indexed referrer,
        uint256 amount,
        uint256 currentTrackerBalance
    );
    event FundsAdded(address referralAddress, address fundsDepositor, uint256 amount);

    constructor(address registryAddress_, address tokenAdress) public {
        registryAddress = registryAddress_;
        token = ERC20(tokenAdress);
    }

    modifier onlyRegistry() {
        require(msg.sender == registryAddress, "the caller is not the registry");
        _;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "the caller is not the admin");
        _;
    }

    function setAdministrator(address _admin) public onlyOwner {
        admin = _admin;
    }

    function addFunds(uint256 amount) public onlyAdmin whenNotPaused {
        token.transferFrom(msg.sender, address(this), amount);
        emit FundsAdded(address(this), msg.sender, amount);
    }

    function registerReferral(address referrer, address user) public onlyRegistry {
        unclaimedReferrals[referrer] = unclaimedReferrals[referrer].add(1);

        emit ReferralRegistered(address(this), referrer, user);
    }

    function withdraw(address to) public whenNotPaused {
        require(unclaimedReferrals[msg.sender] > 0, "no referrals to claim");
        uint256 trackerBalance = token.balanceOf(address(this));
        uint256 amount = REFERRAL_BONUS * unclaimedReferrals[msg.sender];

        require(trackerBalance >= amount, "Not enough funds");
        delete unclaimedReferrals[msg.sender];

        token.transfer(to, amount);

        emit ReferralBonusWithdrawn(address(this), msg.sender, amount, trackerBalance);
    }
}
