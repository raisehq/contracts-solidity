pragma solidity ^0.5.0;

import 'openzeppelin-solidity/contracts/token/ERC20/ERC20.sol';
import './Authorization.sol';
import './LoanContractInterface.sol';
import './DAIProxyInterface.sol';

contract DAIProxy is DAIProxyInterface {
    ERC20 DAIToken;
    Authorization auth;

    event LoanFunded(address indexed funder, address indexed loanAddress, uint256 amount);
    event RepaymentReceived(address indexed repayer, address indexed loanAddress, uint256 amount);

    constructor(address authAddress, address DAIAddress) public {
        auth = Authorization(authAddress);
        DAIToken = ERC20(DAIAddress);
    }

    function fund(address loanAddress, uint256 fundingAmount) public onlyKYCanFund onlyHasDepositCanFund  {
        transfer(loanAddress, fundingAmount);

        LoanContractInterface loanContract = LoanContractInterface(loanAddress);
        loanContract.onFundingReceived(msg.sender, fundingAmount);

        emit LoanFunded(msg.sender, loanAddress, fundingAmount);
    }

    function repay(address loanAddress, uint256 repaymentAmount) public onlyKYCanFund {
        transfer(loanAddress, repaymentAmount);

        LoanContractInterface loanContract = LoanContractInterface(loanAddress);
        loanContract.onRepaymentReceived(msg.sender, repaymentAmount);

        emit RepaymentReceived(msg.sender, loanAddress, repaymentAmount);
    }

    function transfer(address loanAddress, uint256 amount) internal {
        require(
            DAIToken.allowance(msg.sender, address(this)) >= amount,
            'funding not approved'
        );
        uint256 balance = DAIToken.balanceOf(msg.sender);
        require(balance >= amount, 'Not enough funds');
        DAIToken.transferFrom(msg.sender, loanAddress, amount);
    }

    modifier onlyKYCanFund {
        require(auth.isKYCConfirmed(msg.sender), 'user does not have KYC');
        _;
    }

    modifier onlyHasDepositCanFund {
        require(auth.hasDeposited(msg.sender), 'user does not have a deposit');
        _;
    }
}
