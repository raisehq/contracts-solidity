pragma solidity 0.5.12;

interface ILoanContract {
    function onFundingReceived(address lender, uint256 amount) external returns (bool);
    function withdrawRepayment() external;
    function withdrawRepaymentAndDeposit() external;
    function withdrawLoan() external;
    function onRepaymentReceived(address from, uint256 amount) external returns (bool);
    function getInterestRate() external view returns (uint256);
    function calculateValueWithInterest(uint256 value) external view returns (uint256);
    function getMaxAmount() external view returns (uint256);
    function getAuctionBalance() external view returns (uint256);
}
