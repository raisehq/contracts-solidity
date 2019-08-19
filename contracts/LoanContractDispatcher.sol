pragma solidity 0.5.10;

import './Authorization.sol';
import './LoanContract.sol';

contract LoanContractDispatcher is Ownable {
    Authorization auth;
    address DAITokenAddress;
    address DAIProxyAddress;

    address public administrator;

    uint256 public operatorFee;
    uint256 public minAmount;
    uint256 public maxAmount;

    uint256 public minInterestRate;
    uint256 public maxInterestRate;

    mapping(address => bool) public isLoanContract;

    modifier onlyKYC {
        require(auth.isKYCConfirmed(msg.sender), 'user does not have KYC');
        _;
    }

    modifier onlyAdmin() {
        require(msg.sender == administrator, 'Caller is not an administrator');
        _;
    }

    event LoanContractCreated(
        address loanDispatcher,
        address contractAddress,
        address indexed originator,
        uint256 auctionBlockLength,
        uint256 minAmount,
        uint256 maxAmount,
        uint256 maxInterestRate,
        uint256 termEndTimestamp,
        address indexed administrator
    );

    event MinAmountUpdated(uint256 minAmount, address loanDispatcher);
    event MaxAmountUpdated(uint256 maxAmount, address loanDispatcher);
    event MinInterestRateUpdated(uint256 minInterestRate, address loanDispatcher);
    event MaxInterestRateUpdated(uint256 maxInterestRate, address loanDispatcher);
    event OperatorFeeUpdated(uint256 operatorFee, address loanDispatcher, address administrator);

    constructor(address authAddress, address _DAITokenAddress, address _DAIProxyAddress) public {
        auth = Authorization(authAddress);
        DAITokenAddress = _DAITokenAddress;
        DAIProxyAddress = _DAIProxyAddress;

        minAmount = 1000000000000000000; // Minimum 1 DAI
        maxAmount = 2500000000000000000000000; // Maximum 2.5 Million DAI

        minInterestRate = 0;
        maxInterestRate = 24000;

        operatorFee = 1000000000000000000; // 1 % operator fee, expressed in wei
    }

    function setAdministrator(address admin) public onlyOwner {
        administrator = admin;
    }

    function setOperatorFee(uint256 newFee) public onlyAdmin {
        operatorFee = newFee;
        emit OperatorFeeUpdated(operatorFee, address(this), msg.sender);
    }

    function setMinAmount(uint256 requestedMinAmount) public onlyAdmin {
        require(
            requestedMinAmount <= maxAmount,
            'Minimum amount needs to be lesser or equal than maximum amount'
        );
        minAmount = requestedMinAmount;
        emit MinAmountUpdated(minAmount, address(this));
    }

    function setMaxAmount(uint256 requestedMaxAmount) public onlyAdmin {
        require(
            requestedMaxAmount >= minAmount,
            'Maximum amount needs to be greater or equal than minimum amount'
        );
        maxAmount = requestedMaxAmount;
        emit MaxAmountUpdated(maxAmount, address(this));
    }

    function setMinInterestRate(uint256 requestedMinInterestRate) public onlyAdmin {
        require(
            requestedMinInterestRate <= maxInterestRate,
            'Minimum interest needs to be lesser or equal than maximum interest'
        );
        minInterestRate = requestedMinInterestRate;
        emit MinInterestRateUpdated(minInterestRate, address(this));
    }

    function setMaxInterestRate(uint256 requestedMaxInterestRate) public onlyAdmin {
        require(
            requestedMaxInterestRate >= minInterestRate,
            'Maximum interest needs to be greater or equal than minimum interest'
        );
        maxInterestRate = requestedMaxInterestRate;
        emit MaxInterestRateUpdated(maxInterestRate, address(this));
    }

    function deploy(
        uint256 auctionBlockLength,
        uint256 loanMinAmount,
        uint256 loanMaxAmount,
        uint256 loanMaxInterestRate,
        uint256 termEndTimestamp
    ) public onlyKYC returns (address) {
        require(administrator != address(0), 'There is no administrator set');
        require(
            loanMinAmount >= minAmount &&
                loanMinAmount <= maxAmount &&
                loanMinAmount <= loanMaxAmount,
            'minimum amount not correct'
        );
        require(
            loanMaxAmount >= minAmount &&
                loanMaxAmount <= maxAmount &&
                loanMaxAmount >= loanMinAmount,
            'maximum amount not correct'
        );
        require(
            loanMaxInterestRate >= minInterestRate && loanMaxInterestRate <= maxInterestRate,
            'maximum interest rate not correct'
        );

        LoanContract loanContract = new LoanContract(
            auctionBlockLength,
            termEndTimestamp,
            loanMinAmount,
            loanMaxAmount,
            loanMaxInterestRate,
            msg.sender,
            DAITokenAddress,
            DAIProxyAddress,
            administrator,
            operatorFee
        );
        isLoanContract[address(loanContract)] = true;

        emit LoanContractCreated(
            address(this),
            address(loanContract),
            msg.sender,
            block.number + auctionBlockLength,
            loanMinAmount,
            loanMaxAmount,
            loanMaxInterestRate,
            termEndTimestamp,
            administrator
        );

        return address(loanContract);
    }

}
