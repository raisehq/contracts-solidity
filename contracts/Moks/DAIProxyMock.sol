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
        DAIToken.transferFrom(msg.sender, loanAddress, fundingAmount);
        LoanContractInterface loanContract = LoanContractInterface(loanAddress);
        loanContract.onFundingReceived(msg.sender, fundingAmount);
    }
    function repay(address loanAddress, uint256 repaymentAmount) public {
        DAIToken.transferFrom(msg.sender, loanAddress, repaymentAmount);
        LoanContractInterface loanContract = LoanContractInterface(loanAddress);
        loanContract.onRepaymentReceived(msg.sender, repaymentAmount);

    }
}