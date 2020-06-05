pragma solidity 0.5.12;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/lifecycle/Pausable.sol";


contract ReferralTracker is Ownable, Pausable {
    using SafeMath for uint256;
    ERC20 token;
    address public admin;
    uint256 public REFERRAL_BONUS;

    mapping(address => uint256) public unclaimedAmount;
    mapping(address => bool) public registryAddresses;

    event ReferralRegistered(
        address referralAddress,
        address indexed referrer,
        address indexed user,
        uint256 referralAmount
    );
    event ReferralBonusWithdrawn(
        address referralAddress,
        address indexed referrer,
        uint256 amount,
        uint256 currentTrackerBalance
    );
    event FundsAdded(address referralAddress, address fundsDepositor, uint256 amount);
    event FundsRemoved(address referralAddress, address fundsWithdrawer, uint256 amount);

    constructor(address registryAddress_, address tokenAdress, uint256 referralBonus)
        public
        PauserRole()
    {
        registryAddresses[registryAddress_] = true;
        REFERRAL_BONUS = referralBonus;
        token = ERC20(tokenAdress);
    }

    modifier onlyRegistry() {
        require(registryAddresses[msg.sender], "the caller is not the registry");
        _;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "the caller is not the admin");
        _;
    }

    function addRegistryAddress(address newRegistryAddress) external onlyAdmin {
        require(newRegistryAddress != address(0), "Address can not be 0x00");
        // require(registryAddresses[newRegistryAddress] != true, "Address already in registry");
        registryAddresses[newRegistryAddress] = true;
    }

    function removeRegistryAddress(address registryAddressToRemove) external onlyAdmin {
        require(registryAddresses[registryAddressToRemove], "Address not in registry");
        delete registryAdresses[registryAddressToRemove];
    }

    function setReferralBonus(uint256 newBonus) external onlyAdmin {
        REFERRAL_BONUS = newBonus;
    }

    function setAdministrator(address _admin) external onlyOwner {
        admin = _admin;
    }

    function setToken(address _token, uint256 _bonus) external onlyOwner whenPaused {
        require(_bonus > 0, "Bonus needs to be greater than 0");
        require(_token != address(0), "Address can not be 0x00");
        token = ERC20(_token);
        REFERRAL_BONUS = _bonus;
    }

    function addFunds(uint256 amount) external onlyAdmin whenNotPaused {
        require(token.transferFrom(msg.sender, address(this), amount), "Transfer of funds failed");
        emit FundsAdded(address(this), msg.sender, amount);
    }

    function removeFunds(address to) external onlyAdmin {
        uint256 amount = token.balanceOf(address(this));
        require(amount > 0, "ReferralTracker has no funds to withdraw");
        require(token.transfer(to, amount), "Remove funds failed");
        emit FundsRemoved(address(this), msg.sender, amount);
    }

    function registerReferral(address referrer, address user)
        public
        onlyRegistry
        whenNotPaused
        returns (bool)
    {
        referrals[referrer] = referrals[referrer].add(REFERRAL_BONUS);

        emit ReferralRegistered(address(this), referrer, user, REFERRAL_BONUS);
        return true;
    }

    function withdraw(address to) external whenNotPaused {
        uint256 amount = unclaimedAmount[msg.sender]
        require(amount > 0, "no referral amount to claim");
        uint256 trackerBalance = token.balanceOf(address(this));

        require(trackerBalance >= amount, "Not enough funds");
        delete unclaimedAmount[msg.sender];

        require(token.transfer(to, amount), "Withdraw funds failed");

        emit ReferralBonusWithdrawn(address(this), msg.sender, amount, token.balanceOf(address(this));
    }

    function getTrackerBalance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }

    function getUnclaimedAmount(address _address) external view returns (uint256) {
        return unclaimedAmount[_address];
    }
}
