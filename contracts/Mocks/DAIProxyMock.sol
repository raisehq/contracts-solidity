pragma solidity 0.5.12;

import "../interfaces/IDAIProxy.sol";
import "../interfaces/ILoanContract.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

contract DAIProxyMock is IDAIProxy {
    ERC20 DAIToken;

    constructor(address daiAddress) public {
        DAIToken = ERC20(daiAddress);
    }

    function fund(address loanAddress, uint256 fundingAmount) public {
        uint256 newFundingAmount = fundingAmount;
        ILoanContract loanContract = ILoanContract(loanAddress);

        uint256 auctionBalance = loanContract.getAuctionBalance();
        uint256 maxAmount = loanContract.getMaxAmount();

        if (auctionBalance + fundingAmount > maxAmount) {
            newFundingAmount = maxAmount - auctionBalance;
        }
        DAIToken.transferFrom(msg.sender, address(this), newFundingAmount);
        DAIToken.approve(address(loanContract), newFundingAmount);
        require(loanContract.onFundingReceived(msg.sender, newFundingAmount), "bad investment");
    }

    function repay(address loanAddress, uint256 repaymentAmount) public {
        ILoanContract loanContract = ILoanContract(loanAddress);
        bool canTransfer = loanContract.onRepaymentReceived(msg.sender, repaymentAmount);

        if (canTransfer == true) {
            DAIToken.transferFrom(msg.sender, loanAddress, repaymentAmount);
        }
    }
}
