pragma solidity 0.5.10;

interface ILoanContractDispatcher {
    event LoanContractCreated(
        address loanDispatcher,
        address contractAddress,
        address indexed originator,
        uint256 minAmount,
        uint256 maxAmount,
        uint256 minInterestRate,
        uint256 maxInterestRate,
        uint256 termEndTimestamp,
        address indexed administrator,
        uint256 operatorFee,
        uint256 auctionLength
    );
    event MinAmountUpdated(uint256 minAmount, address loanDispatcher);
    event MaxAmountUpdated(uint256 maxAmount, address loanDispatcher);
    event MinInterestRateUpdated(uint256 minInterestRate, address loanDispatcher);
    event MaxInterestRateUpdated(uint256 maxInterestRate, address loanDispatcher);
    event OperatorFeeUpdated(uint256 operatorFee, address loanDispatcher, address administrator);
    event AuthAddressUpdated(address newAuthAddress, address administrator);
    event DaiTokenAddressUpdated(address newDaiTokenAddress, address administrator);
    event DaiProxyAddressUpdated(address newDaiProxyAddress, address administrator);
    event AdministratorUpdated(address newAdminAddress);

    function checkLoanContract(address loanAddress) external view returns (bool);

    function setDaiTokenAddress(address daiAddress) external;

    function setAuthAddress(address authAddress) external;

    function setDaiProxyAddress(address daiProxyAddress) external;

    function setAdministrator(address admin) external;

    function setOperatorFee(uint256 newFee) external;

    function setMinAmount(uint256 requestedMinAmount) external;

    function setMaxAmount(uint256 requestedMaxAmount) external;

    function setMinInterestRate(uint256 requestedMinInterestRate) external;

    function setMaxInterestRate(uint256 requestedMaxInterestRate) external;

    function setMinTermLength(uint256 requestedMinTermLength) external;

    function setMinAuctionLength(uint256 requestedMinAuctionLength) external;

    function deploy(
        uint256 loanMinAmount,
        uint256 loanMaxAmount,
        uint256 loanMinInterestRate,
        uint256 loanMaxInterestRate,
        uint256 termLength,
        uint256 auctionLength
    ) external returns (address);
}
