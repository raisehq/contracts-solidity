pragma solidity 0.5.12;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

import "../interfaces/IDepositRegistry.sol";
import "../interfaces/IReferralTracker.sol";
import "../interfaces/IKYCRegistry.sol";

contract DepositNoToken is IDepositRegistry, Ownable {
    mapping(address => Deposit) deposits;
    mapping(address => address) userToDepositRegistry;
    address public admin;
    uint256 constant DEPOSIT_AMNT = 200e18; //200000000000000000000;
    bool public migrationAllowed;

    IERC20 public token;
    IKYCRegistry public kyc;
    IReferralTracker public ref;

    modifier onlyAdmin() {
        require(msg.sender == admin, "caller is not the admin");
        _;
    }

    event UserDepositCompleted(address depositRegistry, address indexed user);
    event UserWithdrawnCompleted(address depositRegistry, address indexed user);
    event AddressUnlockedForWithdrawal(address depositRegistry, address indexed user);
    event MigrationFinished(address depositRegistry);

    constructor(address tokenAddress, address kycAddress) public {
        token = ERC20(tokenAddress);
        kyc = IKYCRegistry(kycAddress);
        migrationAllowed = true;
    }

    function setReferralTracker(address contractAddress) external onlyOwner {
        require(contractAddress != address(0x0), "Address needs to be valid");
        ref = IReferralTracker(contractAddress);
    }

    function setERC20Token(address newToken) external onlyAdmin {
        require(newToken != address(0x0), "Address needs to be valid");
        token = IERC20(newToken);
    }

    function setKYC(address newKYC) external onlyAdmin {
        require(newKYC != address(0x0), "Address needs to be valid");
        kyc = IKYCRegistry(newKYC);
    }

    function setAdministrator(address _admin) external onlyOwner {
        require(_admin != address(0x0), "Address needs to be valid");
        admin = _admin;
    }

    function migrate(address[] calldata depositors, address oldDeposit) external onlyOwner {
        require(migrationAllowed, "Migration already done");
        for (uint256 i = 0; i < depositors.length; i++) {
            require(deposits[depositors[i]].deposited == false, "Depositor already deposited");
            IDepositRegistry oldDepositRegistry = IDepositRegistry(oldDeposit);
            require(
                oldDepositRegistry.hasDeposited(depositors[i]),
                "Depositor does not have deposit in old Registry"
            );
            deposits[depositors[i]].deposited = true;
            userToDepositRegistry[depositors[i]] = oldDeposit;
            emit UserDepositCompleted(address(this), depositors[i]);
        }
    }

    function finishMigration() external onlyOwner {
        require(migrationAllowed, "Migration already done");
        migrationAllowed = false;
        emit MigrationFinished(address(this));
    }

    function _deposit(address user) internal returns (bool) {
        deposits[user].deposited = true;
        userToDepositRegistry[user] = address(this);
        emit UserDepositCompleted(address(this), user);
        return false;
    }

    function depositFor(address from) external returns (bool) {
        require(deposits[from].deposited == false, "already deposited");
        require(
            token.allowance(from, address(this)) >= DEPOSIT_AMNT,
            "address not approved amount"
        );

        require(token.transferFrom(from, address(this), DEPOSIT_AMNT), "Deposit transfer failed");

        return _deposit(from);
    }

    function depositForWithReferral(address from, address referrer) external returns (bool) {
        require(from != referrer, "can not refer to itself");
        require(deposits[referrer].deposited, "referrer has not deposited");
        require(deposits[from].deposited == false, "alredy deposited");
        require(
            token.allowance(from, address(this)) >= DEPOSIT_AMNT,
            "address not approved amount"
        );
        require(msg.sender == from, "cannot deposit with a referral from another address");

        require(ref.registerReferral(referrer, msg.sender), "ref failed");

        require(
            token.transferFrom(from, address(this), DEPOSIT_AMNT),
            "Deposit referal transfer failed"
        );

        return _deposit(from);
    }

    function delegateDeposit(address to) external returns (bool) {
        require(deposits[to].deposited == false, "already deposited");
        require(
            token.allowance(msg.sender, address(this)) >= DEPOSIT_AMNT,
            "address not approved amount"
        );

        require(
            token.transferFrom(msg.sender, address(this), DEPOSIT_AMNT),
            "Deposit transfer failed"
        );

        return _deposit(to);
    }

    function withdraw(address to) external {
        require(deposits[msg.sender].deposited, "address not deposited");
        require(
            userToDepositRegistry[msg.sender] == address(this),
            "run getDepositRegistryByUser to get the deposit address to withdraw"
        );
        require(
            deposits[msg.sender].unlockedForWithdrawal || kyc.isConfirmed(msg.sender),
            "cannot withdraw without KYC or unlocked"
        );

        delete deposits[msg.sender];
        require(token.transfer(to, DEPOSIT_AMNT), "Withdraw transfer failed");
        emit UserWithdrawnCompleted(address(this), msg.sender);
    }

    function unlockAddressForWithdrawal(address user) external onlyAdmin {
        require(deposits[user].deposited, "address has not deposited");
        deposits[user].unlockedForWithdrawal = true;
        emit AddressUnlockedForWithdrawal(address(this), user);
    }

    function hasDeposited(address user) external view returns (bool) {
        return deposits[user].deposited;
    }

    function isUnlocked(address user) external view returns (bool) {
        return deposits[user].unlockedForWithdrawal;
    }

    function getERC20Token() external view returns (address) {
        return address(0);
    }

    function getDepositRegistryByUser(address user) external view returns (address) {
        return userToDepositRegistry[user];
    }
}
