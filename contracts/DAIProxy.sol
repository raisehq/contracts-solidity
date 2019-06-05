pragma solidity ^0.5.0;

import './DAI.sol';
import './Authorization.sol';
import './LoanContract.sol';

contract DAIProxy {
    DAI DAIToken;
    Authorization auth;

    event LoanFunded(address indexed funder, address indexed loanAddress, uint256 amount);
    event RepaymentReceived(address indexed repayer, address indexed loanAddress, uint256 amount);

    constructor(address authAddress, uint256 tokenId) public {
        auth = Authorization(authAddress);
        DAIToken = DAI(tokenId);
    }

    function fund(address loanAddress, uint256 fundingAmount) public onlyKYCanFund onlyHasDepositCandFund  {
        transfer(loanAddress, fundingAmount);

        LoanContract loanContract = LoanContract(loanAddress);
        loanContract.onFundingReceived(msg.sender, fundingAmount);

        emit LoanFunded(msg.sender, loanAddress, fundingAmount);
    }

    function repay(address loanAddress, uint256 repaymentAmount) public onlyKYCanFund {
        transfer(loandAddress, repaymentAmount);

        LoanContract loanContract = LoanContract(loanAddress);
        loanContract.onRepaymentReceived(msg.sender, repaymentAmount);

        emit RepaymentReceived(msg.sender, loanAddress, repaymentAmount);
    }

    function transfer(address loanAddress, uint256 amount) internal {
        require(DAIToken.allawance(msg.sender, address(this)), 'funding not approved');
        balance = DAIToken.balanceOf(msg.sender);
        require(balance >= fundingAmount, 'Not enough founds');
        DAIToken.transferFrom(msg.sender, loanAddress, amount);
    }

    modifier onlyKYCanFund {
        require(auth.isKYCConfirmed(msg.sender), 'user does not have KYC');
        _;
    }

    modifier onlyHasDepositCandFund {
        require(auth.hasDeposited(msg.sender), 'user does not have a deposit');
        _;
    }
}
