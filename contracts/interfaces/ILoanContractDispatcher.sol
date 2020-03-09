pragma solidity 0.5.12;

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
        uint256 auctionLength,
        address indexed tokenAddress
    );

    event MinAmountUpdated(uint256 minAmount, address loanDispatcher);
    event MaxAmountUpdated(uint256 maxAmount, address loanDispatcher);
    event MinInterestRateUpdated(uint256 minInterestRate, address loanDispatcher);
    event MaxInterestRateUpdated(uint256 maxInterestRate, address loanDispatcher);
    event MinTermLengthUpdated(uint256 minTermLength, address loanDispatcher);
    event MinAuctionLengthUpdated(uint256 minAuctionLength, address loanDispatcher);
    event OperatorFeeUpdated(uint256 operatorFee, address loanDispatcher, address administrator);

    event AuthAddressUpdated(address newAuthAddress, address administrator, address loanDispatcher);
    event DaiProxyAddressUpdated(
        address newDaiProxyAddress,
        address administrator,
        address loanDispatcher
    );
    event SwapFactoryAddressUpdated(
        address newSwapFactory,
        address administrator,
        address loanDispatcher
    );

    event AdministratorUpdated(address newAdminAddress, address loanDispatcher);
    event AddTokenToAcceptedList(address tokenAddress, address loanDispatcher);
    event RemoveTokenFromAcceptedList(address tokenAddress, address loanDispatcher);

    event LoanDispatcherCreated(
        address loanDispatcher,
        address auth,
        address DAIProxyAddress,
        address swapFactory,
        uint256 minAmount,
        uint256 maxAmount,
        uint256 maxInterestRate,
        uint256 minInterestRate,
        uint256 operatorFee,
        uint256 minAuctionLength,
        uint256 minTermLength
    );

    function checkLoanContract(address loanAddress) external view returns (bool);

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
        uint256 auctionLength,
        address tokenAddress
    ) external returns (address);
}
