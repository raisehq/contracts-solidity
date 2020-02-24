pragma solidity 0.5.10;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./interfaces/IAuthorization.sol";
import "./interfaces/ILoanContract.sol";
import "./interfaces/IDAIProxy.sol";

contract DAIProxy is IDAIProxy, Ownable {
    // IERC20 private DAIToken;
    IAuthorization auth;
    address public administrator;
    bool public hasToDeposit;

    event AuthAddressUpdated(address newAuthAddress, address administrator);
    event AdministratorUpdated(address newAdministrator);
    event HasToDeposit(bool value, address administrator);

    constructor(address authAddress) public {
        auth = IAuthorization(authAddress);
    }

    function setDepositRequeriment(bool value) external onlyAdmin {
        hasToDeposit = value;
        emit HasToDeposit(value, administrator);
    }
    function setAdministrator(address admin) external onlyOwner {
        administrator = admin;
        emit AdministratorUpdated(administrator);
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
        address tokenAddress = loanContract.getTokenAddress();

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
        require(transfer(loanAddress, newFundingAmount, tokenAddress), "erc20 transfer failed");
    }

    function repay(address loanAddress, uint256 repaymentAmount) external onlyKYCCanFund {
        ILoanContract loanContract = ILoanContract(loanAddress);
        address tokenAddress = loanContract.getTokenAddress();
        require(
            loanContract.onRepaymentReceived(msg.sender, repaymentAmount),
            "repayment failed at loan contract"
        );
        require(transfer(loanAddress, repaymentAmount, tokenAddress), "erc20 repayment failed");
    }

    function transfer(address loanAddress, uint256 amount, address tokenAddress)
        internal
        returns (bool)
    {
        IERC20 ERC20Token = IERC20(tokenAddress);

        require(ERC20Token.allowance(msg.sender, address(this)) >= amount, "funding not approved");
        uint256 balance = ERC20Token.balanceOf(msg.sender);
        require(balance >= amount, "Not enough funds");
        require(ERC20Token.transferFrom(msg.sender, loanAddress, amount), "failed at transferFrom");
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
