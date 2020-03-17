pragma solidity 0.5.12;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "../ReferralTracker.sol";
import "../KYCRegistry.sol";

contract OldDepositRegistry is Ownable {
    struct Deposit {
        bool deposited;
        bool unlockedForWithdrawal;
    }
    mapping(address => Deposit) deposits;
    address public admin;
    uint256 DEPOSIT_AMNT = 200000000000000000000;
    ERC20 token;

    KYCRegistry kyc;
    ReferralTracker public ref;

    modifier onlyAdmin() {
        require(msg.sender == admin, "caller is not the admin");
        _;
    }

    event UserDepositCompleted(address depositRegistry, address indexed user);
    event UserWithdrawnCompleted(address depositRegistry, address indexed user);
    event AddressUnlockedForWithdrawal(address depositRegistry, address indexed user);

    constructor(address tokenAddress, address kycAddress) public {
        token = ERC20(tokenAddress);
        kyc = KYCRegistry(kycAddress);
    }

    function setReferralTracker(address contractAddress) public onlyOwner {
        ref = ReferralTracker(contractAddress);
    }

    function setAdministrator(address _admin) public onlyOwner {
        admin = _admin;
    }

    function depositFor(address from) public {
        require(deposits[from].deposited == false, "already deposited");
        require(
            token.allowance(from, address(this)) >= DEPOSIT_AMNT,
            "address not approved amount"
        );

        deposits[from].deposited = true;
        token.transferFrom(from, address(this), DEPOSIT_AMNT);

        emit UserDepositCompleted(address(this), from);
    }

    function depositForWithReferral(address from, address referrer) public {
        require(from != referrer, "can not refer to itself");
        require(deposits[referrer].deposited, "referrer has not deposited");
        require(deposits[from].deposited == false, "alredy deposited");
        require(
            token.allowance(from, address(this)) >= DEPOSIT_AMNT,
            "address not approved amount"
        );
        require(msg.sender == from, "cannot deposit with a referral from another address");

        deposits[from].deposited = true;

        ref.registerReferral(referrer, msg.sender);

        token.transferFrom(from, address(this), DEPOSIT_AMNT);

        emit UserDepositCompleted(address(this), from);
    }

    function withdraw(address to) public {
        require(deposits[msg.sender].deposited, "address not deposited");
        require(
            deposits[msg.sender].unlockedForWithdrawal || kyc.isConfirmed(msg.sender),
            "cannot withdraw without KYC or unlocked"
        );

        delete deposits[msg.sender];
        token.transfer(to, DEPOSIT_AMNT);
        emit UserWithdrawnCompleted(address(this), msg.sender);
    }

    function unlockAddressForWithdrawal(address user) public onlyAdmin {
        require(deposits[user].deposited, "address has not deposited");
        deposits[user].unlockedForWithdrawal = true;
        emit AddressUnlockedForWithdrawal(address(this), user);
    }

    function hasDeposited(address user) public view returns (bool) {
        return deposits[user].deposited;
    }

    function isUnlocked(address user) public view returns (bool) {
        return deposits[user].unlockedForWithdrawal;
    }
}
