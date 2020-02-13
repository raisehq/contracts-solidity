pragma solidity 0.5.10;

interface IDAIProxy {
    function fund(address loanAddress, uint256 fundingAmount) external;
    function repay(address loanAddress, uint256 repaymentAmount) external;
}
