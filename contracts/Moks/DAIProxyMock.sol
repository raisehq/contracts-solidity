pragma solidity ^0.5.0;

import '../DAIProxyInterface.sol';
import '../LoanContractInterface.sol';
import 'openzeppelin-solidity/contracts/token/ERC20/ERC20.sol';


contract DAIProxyMock is DAIProxyInterface {
    ERC20 DAIToken;

    constructor(address daiAddress) public {
        DAIToken = ERC20(daiAddress);
    }
    function fund(address loanAddress, uint256 fundingAmount) public {
        uint256 newFundingAmount = fundingAmount;
        LoanContractInterface loanContract = LoanContractInterface(loanAddress);

        uint256 auctionBalance = loanContract.getAuctionBalance();
        uint256 maxAmount = loanContract.getMaxAmount();

        if (auctionBalance + fundingAmount > maxAmount) {
            newFundingAmount = maxAmount - auctionBalance;
        }

        bool canTransfer = loanContract.onFundingReceived(msg.sender, newFundingAmount);
        require(canTransfer == true, 'Transfer for funding not possible');

        DAIToken.transferFrom(msg.sender, loanAddress, fundingAmount);
    }
    function repay(address loanAddress, uint256 repaymentAmount) public {
        DAIToken.transferFrom(msg.sender, loanAddress, repaymentAmount);
        LoanContractInterface loanContract = LoanContractInterface(loanAddress);
        loanContract.onRepaymentReceived(msg.sender, repaymentAmount);
    }
}