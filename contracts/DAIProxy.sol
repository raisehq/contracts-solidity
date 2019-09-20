pragma solidity 0.5.10;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "./Authorization.sol";
import "./LoanContractInterface.sol";
import "./DAIProxyInterface.sol";

contract DAIProxy is DAIProxyInterface, Ownable {
    ERC20 DAIToken;
    Authorization auth;
    address public administrator;

    event LoanFunded(address indexed funder, address indexed loanAddress, uint256 amount);
    event RepaymentReceived(address indexed repayer, address indexed loanAddress, uint256 amount);

    event AuthAddressUpdated(address newAuthAddress, address administrator);
    event DaiTokenAddressUpdated(address newDaiTokenAddress, address administrator);
    event AdministratorUpdated(address newAdministrator);

    constructor(address authAddress, address DAIAddress) public {
        auth = Authorization(authAddress);
        DAIToken = ERC20(DAIAddress);
    }

    function setAdministrator(address admin) external onlyOwner {
        administrator = admin;
        emit AdministratorUpdated(administrator);
    }

    function setDaiTokenAddress(address daiAddress) external onlyAdmin {
        DAIToken = ERC20(daiAddress);
        emit DaiTokenAddressUpdated(daiAddress, administrator);
    }

    function setAuthAddress(address authAddress) external onlyAdmin {
        auth = Authorization(authAddress);
        emit AuthAddressUpdated(authAddress, administrator);
    }

    function fund(address loanAddress, uint256 fundingAmount)
        external
        onlyKYCanFund
        onlyHasDepositCanFund
    {
        uint256 newFundingAmount = fundingAmount;
        LoanContractInterface loanContract = LoanContractInterface(loanAddress);

        uint256 auctionBalance = loanContract.getAuctionBalance();
        uint256 maxAmount = loanContract.getMaxAmount();

        if (auctionBalance + fundingAmount > maxAmount) {
            newFundingAmount = maxAmount - auctionBalance;
        }

        bool canTransfer = loanContract.onFundingReceived(msg.sender, newFundingAmount);
        if (canTransfer == true) {
            transfer(loanAddress, newFundingAmount);
        }
    }

    function repay(address loanAddress, uint256 repaymentAmount) external onlyKYCanFund {
        LoanContractInterface loanContract = LoanContractInterface(loanAddress);
        bool canTransfer = loanContract.onRepaymentReceived(msg.sender, repaymentAmount);

        if (canTransfer == true) {
            transfer(loanAddress, repaymentAmount);
        }
    }

    function transfer(address loanAddress, uint256 amount) internal {
        require(DAIToken.allowance(msg.sender, address(this)) >= amount, "funding not approved");
        uint256 balance = DAIToken.balanceOf(msg.sender);
        require(balance >= amount, "Not enough funds");
        DAIToken.transferFrom(msg.sender, loanAddress, amount);
    }

    modifier onlyKYCanFund {
        require(auth.isKYCConfirmed(msg.sender), "user does not have KYC");
        _;
    }

    modifier onlyHasDepositCanFund {
        require(auth.hasDeposited(msg.sender), "user does not have a deposit");
        _;
    }

    modifier onlyAdmin() {
        require(msg.sender == administrator, "Caller is not an administrator");
        _;
    }
}
