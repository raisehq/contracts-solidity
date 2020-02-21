pragma solidity 0.5.12;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./interfaces/IAuthorization.sol";
import "./interfaces/ILoanContract.sol";
import "./interfaces/IDAIProxy.sol";

contract DAIProxy is IDAIProxy, Ownable {
    IERC20 private DAIToken;
    IAuthorization auth;
    address public administrator;
    bool public hasToDeposit;

    event LoanFunded(address indexed funder, address indexed loanAddress, uint256 amount);
    event RepaymentReceived(address indexed repayer, address indexed loanAddress, uint256 amount);

    event AuthAddressUpdated(address newAuthAddress, address administrator);
    event DaiTokenAddressUpdated(address newDaiTokenAddress, address administrator);
    event AdministratorUpdated(address newAdministrator);
    event HasToDeposit(bool value, address administrator);

    constructor(address authAddress, address DAIAddress) public {
        auth = IAuthorization(authAddress);
        DAIToken = IERC20(DAIAddress);
    }

    function getTokenAddress() public view returns (address) {
        return address(DAIToken);
    }

    function setDepositRequeriment(bool value) external onlyAdmin {
        hasToDeposit = value;
        emit AdministratorUpdated(administrator);
    }
    function setAdministrator(address admin) external onlyOwner {
        administrator = admin;
        emit AdministratorUpdated(administrator);
    }

    function setDaiTokenAddress(address daiAddress) external onlyAdmin {
        DAIToken = IERC20(daiAddress);
        emit DaiTokenAddressUpdated(daiAddress, administrator);
    }

    function setAuthAddress(address authAddress) external onlyAdmin {
        auth = IAuthorization(authAddress);
        emit AuthAddressUpdated(authAddress, administrator);
    }

    function fund(address loanAddress, uint256 fundingAmount)
        external
        onlyHasDepositCanFund
        onlyKYCCanFund
    {
        uint256 newFundingAmount = fundingAmount;
        ILoanContract loanContract = ILoanContract(loanAddress);

        uint256 auctionBalance = loanContract.getAuctionBalance();
        uint256 maxAmount = loanContract.getMaxAmount();

        if (auctionBalance + fundingAmount > maxAmount) {
            newFundingAmount = maxAmount - auctionBalance;
        }
        require(newFundingAmount > 0, "funding amount can not be zero");
        require(
            loanContract.onFundingReceived(msg.sender, newFundingAmount),
            "funding failed at loan contract"
        );
        require(transfer(loanAddress, newFundingAmount), "erc20 transfer failed");
    }

    function repay(address loanAddress, uint256 repaymentAmount) external onlyKYCCanFund {
        ILoanContract loanContract = ILoanContract(loanAddress);
        require(
            loanContract.onRepaymentReceived(msg.sender, repaymentAmount),
            "repayment failed at loan contract"
        );
        require(transfer(loanAddress, repaymentAmount), "erc20 repayment failed");
    }

    function transfer(address loanAddress, uint256 amount) internal returns (bool) {
        require(DAIToken.allowance(msg.sender, address(this)) >= amount, "funding not approved");
        uint256 balance = DAIToken.balanceOf(msg.sender);
        require(balance >= amount, "Not enough funds");
        require(DAIToken.transferFrom(msg.sender, loanAddress, amount), "failed at transferFrom");
        return true;
    }

    modifier onlyKYCCanFund {
        require(auth.isKYCConfirmed(msg.sender), "user does not have KYC");
        _;
    }

    modifier onlyHasDepositCanFund {
        if (hasToDeposit) {
            require(auth.hasDeposited(msg.sender), "user does not have a deposit");
        }
        _;
    }

    modifier onlyAdmin() {
        require(msg.sender == administrator, "Caller is not an administrator");
        _;
    }
}
