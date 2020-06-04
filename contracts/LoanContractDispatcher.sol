pragma solidity 0.5.12;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./interfaces/ILoanContractDispatcher.sol";
import "./interfaces/IAuthorization.sol";
import "./LoanContract.sol";

contract LoanContractDispatcher is ILoanContractDispatcher, Ownable {
    address public auth;
    address public DAIProxyAddress;
    address public swapFactory;

    address public administrator;

    uint256 public operatorFee;
    uint256 public minAmount;
    uint256 public maxAmount;
    uint256 public minTermLength;
    uint256 public minAuctionLength;

    uint256 public minInterestRate;
    uint256 public maxInterestRate;

    mapping(address => bool) public acceptedTokens;

    mapping(address => bool) public isLoanContract;

    modifier onlyKYC {
        require(IAuthorization(auth).isKYCConfirmed(msg.sender), "user does not have KYC");
        _;
    }

    modifier onlyAdmin() {
        require(msg.sender == administrator, "Caller is not an administrator");
        _;
    }

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

    constructor(
        address authAddress,
        address _DAIProxyAddress,
        address _swapFactory
    ) public {
        auth = authAddress;
        DAIProxyAddress = _DAIProxyAddress;
        swapFactory = _swapFactory;
        minAmount = 1e18;
        maxAmount = 2500000e18;

        maxInterestRate = 20e18;
        minInterestRate = 0e18;
        operatorFee = 2e18;

        minAuctionLength = 604800;
        minTermLength = 2592000;

        emit LoanDispatcherCreated(
            address(this),
            auth,
            DAIProxyAddress,
            swapFactory,
            minAmount,
            maxAmount,
            maxInterestRate,
            minInterestRate,
            operatorFee,
            minAuctionLength,
            minTermLength
        );
    }

    function isTokenAccepted(address tokenAddress) external view returns (bool) {
        return acceptedTokens[tokenAddress];
    }

    function addTokenToAcceptedList(address tokenAddress) external onlyAdmin {
        acceptedTokens[tokenAddress] = true;
        emit AddTokenToAcceptedList(tokenAddress, address(this));
    }

    function removeTokenFromAcceptedList(address tokenAddress) external onlyAdmin {
        acceptedTokens[tokenAddress] = false;
        emit RemoveTokenFromAcceptedList(tokenAddress, address(this));
    }

    function setAuthAddress(address authAddress) external onlyAdmin {
        auth = authAddress;
        emit AuthAddressUpdated(authAddress, administrator, address(this));
    }

    function setDaiProxyAddress(address daiProxyAddress) external onlyAdmin {
        DAIProxyAddress = daiProxyAddress;
        emit DaiProxyAddressUpdated(DAIProxyAddress, administrator, address(this));
    }

    function setSwapFactory(address _swapFactory) external onlyAdmin {
        swapFactory = _swapFactory;
        emit SwapFactoryAddressUpdated(swapFactory, administrator, address(this));
    }

    function setAdministrator(address admin) external onlyOwner {
        administrator = admin;
        emit AdministratorUpdated(administrator, address(this));
    }

    function setOperatorFee(uint256 newFee) external onlyAdmin {
        operatorFee = newFee;
        emit OperatorFeeUpdated(operatorFee, address(this), msg.sender);
    }

    function setMinAmount(uint256 requestedMinAmount) external onlyAdmin {
        require(
            requestedMinAmount <= maxAmount,
            "Minimum amount needs to be lesser or equal than maximum amount"
        );
        minAmount = requestedMinAmount;
        emit MinAmountUpdated(minAmount, address(this));
    }

    function setMaxAmount(uint256 requestedMaxAmount) external onlyAdmin {
        require(
            requestedMaxAmount >= minAmount,
            "Maximum amount needs to be greater or equal than minimum amount"
        );
        maxAmount = requestedMaxAmount;
        emit MaxAmountUpdated(maxAmount, address(this));
    }

    function setMinInterestRate(uint256 requestedMinInterestRate) external onlyAdmin {
        require(
            requestedMinInterestRate <= maxInterestRate,
            "Minimum interest needs to be lesser or equal than maximum interest"
        );
        minInterestRate = requestedMinInterestRate;
        emit MinInterestRateUpdated(minInterestRate, address(this));
    }

    function setMaxInterestRate(uint256 requestedMaxInterestRate) external onlyAdmin {
        require(
            requestedMaxInterestRate >= minInterestRate,
            "Maximum interest needs to be greater or equal than minimum interest"
        );
        maxInterestRate = requestedMaxInterestRate;
        emit MaxInterestRateUpdated(maxInterestRate, address(this));
    }

    function setMinTermLength(uint256 requestedMinTermLength) external onlyAdmin {
        minTermLength = requestedMinTermLength;
        emit MinTermLengthUpdated(minTermLength, address(this));
    }

    function setMinAuctionLength(uint256 requestedMinAuctionLength) external onlyAdmin {
        minAuctionLength = requestedMinAuctionLength;
        emit MinAuctionLengthUpdated(minAuctionLength, address(this));
    }

    function deploy(
        uint256 loanMinAmount,
        uint256 loanMaxAmount,
        uint256 loanMinInterestRate,
        uint256 loanMaxInterestRate,
        uint256 termLength,
        uint256 auctionLength,
        address tokenAddress
    ) external onlyKYC returns (address) {
        require(administrator != address(0), "There is no administrator set");
        require(
            loanMinAmount >= minAmount &&
                loanMinAmount <= maxAmount &&
                loanMinAmount <= loanMaxAmount,
            "minimum amount not correct"
        );
        require(
            loanMaxAmount >= minAmount &&
                loanMaxAmount <= maxAmount &&
                loanMaxAmount >= loanMinAmount,
            "maximum amount not correct"
        );
        require(
            loanMaxInterestRate >= minInterestRate && loanMaxInterestRate <= maxInterestRate,
            "maximum interest rate not correct"
        );
        require(
            loanMinInterestRate >= minInterestRate && loanMinInterestRate <= maxInterestRate,
            "minimum interest rate not correct"
        );
        require(
            loanMaxInterestRate >= loanMinInterestRate,
            "minimum interest should not be greater than maximum interest"
        );
        require(termLength >= minTermLength, "Term length is to small");
        require(auctionLength >= minAuctionLength, "Auction length is to small");
        require(acceptedTokens[tokenAddress] == true, "TokenAddress not accepted");

        LoanContract loanContract = new LoanContract(
            termLength,
            loanMinAmount,
            loanMaxAmount,
            loanMinInterestRate,
            loanMaxInterestRate,
            msg.sender,
            tokenAddress,
            DAIProxyAddress,
            administrator,
            operatorFee,
            auctionLength,
            swapFactory
        );
        isLoanContract[address(loanContract)] = true;

        emit LoanContractCreated(
            address(this),
            address(loanContract),
            msg.sender,
            loanMinAmount,
            loanMaxAmount,
            loanMinInterestRate,
            loanMaxInterestRate,
            termLength,
            administrator,
            operatorFee,
            auctionLength,
            tokenAddress
        );

        return address(loanContract);
    }

    function checkLoanContract(address loanAddress) external view returns (bool) {
        return isLoanContract[loanAddress];
    }
}
