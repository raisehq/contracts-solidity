pragma solidity 0.5.12;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/lifecycle/Pausable.sol";
import "./interfaces/IAuthorization.sol";


contract ReferralTracker is Ownable, Pausable {
    using SafeMath for uint256;
    ERC20 public token;
    IAuthorization auth;

    address public admin;
    uint256 public REFERRAL_BONUS;

    mapping(address => uint256) public unclaimedAmount;
    mapping(address => bool) public referredAddresses;
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
    event UpdateToken(address referralAddress, address newToken, uint256 bonus);
    event AddRegistryAddress(address referralAddress, address newRegistryAddress);
    event RemoveRegistryAddress(address referralAddress, address addressToRemove);
    event UpdateReferralBonus(address referralAddress, uint256 bonus);
    event UpdateAdministrator(address referralAddress, address admin);
    event ReferralTrackerCreated(
        address referralAddress,
        address auth,
        address registryAddress,
        address tokenAddress,
        uint256 referralBonus
    );
    event AuthAddressUpdated(address referralAddress, address authAddress);

    constructor(
        address authAddress,
        address registryAddress_,
        address tokenAddress,
        uint256 referralBonus
    ) public PauserRole() {
        auth = IAuthorization(authAddress);
        registryAddresses[registryAddress_] = true;
        REFERRAL_BONUS = referralBonus;
        token = ERC20(tokenAddress);

        emit ReferralTrackerCreated(
            address(this),
            address(auth),
            registryAddress_,
            tokenAddress,
            referralBonus
        );
    }

    modifier onlyRegistry() {
        require(registryAddresses[msg.sender], "the caller is not the registry");
        _;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "the caller is not the admin");
        _;
    }

    modifier onlyKYC {
        require(auth.isKYCConfirmed(msg.sender), "user does not have KYC");
        _;
    }

    function setAuthAddress(address authAddress) external onlyAdmin {
        auth = IAuthorization(authAddress);
        emit AuthAddressUpdated(address(this), authAddress);
    }

    function addRegistryAddress(address newRegistryAddress) external onlyAdmin {
        require(newRegistryAddress != address(0), "Address can not be 0x00");
        // require(registryAddresses[newRegistryAddress] != true, "Address already in registry");
        registryAddresses[newRegistryAddress] = true;
        emit AddRegistryAddress(address(this), newRegistryAddress);
    }

    function removeRegistryAddress(address registryAddressToRemove) external onlyAdmin {
        require(registryAddresses[registryAddressToRemove], "Address not in registry");
        delete registryAddresses[registryAddressToRemove];
        emit RemoveRegistryAddress(address(this), registryAddressToRemove);
    }

    function setReferralBonus(uint256 newBonus) external onlyAdmin {
        require(newBonus > 0, "Bonus needs to be greater than 0");
        REFERRAL_BONUS = newBonus;
        emit UpdateReferralBonus(address(this), REFERRAL_BONUS);
    }

    function setAdministrator(address _admin) external onlyOwner {
        admin = _admin;
        emit UpdateAdministrator(address(this), admin);
    }

    function setToken(address _token, uint256 _bonus) external onlyAdmin whenPaused {
        require(_bonus > 0, "Bonus needs to be greater than 0");
        require(_token != address(0), "Address can not be 0x00");
        token = ERC20(_token);
        REFERRAL_BONUS = _bonus;
        emit UpdateToken(address(this), _token, _bonus);
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
        require(referredAddresses[user] != true, "This user has been referenced before");

        referredAddresses[user] = true;
        unclaimedAmount[referrer] = unclaimedAmount[referrer].add(REFERRAL_BONUS);

        emit ReferralRegistered(address(this), referrer, user, REFERRAL_BONUS);

        return true;
    }

    function withdraw(address to) external whenNotPaused onlyKYC {
        uint256 amount = unclaimedAmount[msg.sender];
        require(amount > 0, "no referral amount to claim");
        uint256 trackerBalance = token.balanceOf(address(this));

        require(trackerBalance >= amount, "Not enough funds");
        delete unclaimedAmount[msg.sender];

        require(token.transfer(to, amount), "Withdraw funds failed");

        emit ReferralBonusWithdrawn(
            address(this),
            msg.sender,
            amount,
            token.balanceOf(address(this))
        );
    }

    function getTrackerBalance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }

    function getUnclaimedAmount(address _address) external view returns (uint256) {
        return unclaimedAmount[_address];
    }

    function isAddressInRegistry(address _address) external view returns (bool) {
        return registryAddresses[_address];
    }

    function isAddressReferred(address _address) external view returns (bool) {
        return referredAddresses[_address];
    }
}
