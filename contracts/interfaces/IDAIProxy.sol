pragma solidity 0.5.12;

interface IDAIProxy {
    function fund(address loanAddress, uint256 fundingAmount) external;
    function repay(address loanAddress, uint256 repaymentAmount) external;
    function checkAllowance(address tokenAddress) external view returns (uint256);
    function checkBalance(address tokenAddress) external view returns (uint256);
}
