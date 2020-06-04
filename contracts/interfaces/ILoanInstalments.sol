pragma solidity 0.5.12;

interface ILoanInstalments {
    function init(
        uint256 _termLength,
        uint256 _minAmount,
        uint256 _maxAmount,
        uint256 _minInterestRate,
        uint256 _maxInterestRate,
        address _originator,
        address _tokenAddress,
        address _proxyAddress,
        address _administrator,
        uint256 _operatorFee,
        uint256 _auctionLength,
        address _swapFactory,
        uint256 _instalments
    ) external returns (bool);

    function onFundingReceived(address lender, uint256 amount) external returns (bool);

    function withdrawRepayment() external;

    function withdrawRepaymentAndDeposit() external;

    function withdrawLoan() external;

    function onRepaymentReceived(address from, uint256 amount) external returns (bool);

    function getInterestRate() external view returns (uint256);

    function calculateValueWithInterest(uint256 value) external view returns (uint256);

    function getMaxAmount() external view returns (uint256);

    function getAuctionBalance() external view returns (uint256);

    function getTokenAddress() external view returns (address);
}
