pragma solidity ^0.5.0;

import './DAI.sol';
import './Authorization.sol';

contract DAIProxy {
    DAI DAIToken;
    Authorization auth;

    function fund(address loanAddress, address lender, uint256 fundingAmount) public onlyKYCandDeposit {}
    function repay(address loanAddress, address originator, uint256 repaymentAmount) public {}
}
