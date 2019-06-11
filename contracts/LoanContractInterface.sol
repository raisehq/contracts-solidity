pragma solidity ^0.5.0;

interface LoanContractInterface {
    function onFundingReceived(address lender, uint256 amount) external;
    function withdrawRepayment(address to) external;
    function withdrawLoan(address to) external;
    function onRepaymentReceived(address from, uint256 amount) external;
    function getInterestRate() external view returns (uint256);
    function calculateValueWithInterest(uint256 value) external view returns(uint256);
}