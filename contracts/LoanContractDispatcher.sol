pragma solidity 0.5.10;

import "./Authorization.sol";
import "./LoanContract.sol";

contract LoanContractDispatcher is Ownable {
    Authorization auth;
    address DAITokenAddress;
    address DAIProxyAddress;

    address public administrator;

    uint256 public fixedMinAmount;
    uint256 public fixedMaxAmount;

    uint256 public fixedMinInterest;
    uint256 public fixedMaxInterest;

    mapping(address => bool) public isLoanContract;

    modifier onlyKYC {
        require(auth.isKYCConfirmed(msg.sender), "user does not have KYC");
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
        uint256 auctionBlockLength,
        uint256 minAmount,
        uint256 maxAmount,
        uint256 maxInterestRate,
        uint256 termEndTimestamp,
        address indexed administrator
    );

    constructor(address authAddress, address _DAITokenAddress, address _DAIProxyAddress) public {
        auth = Authorization(authAddress);
        DAITokenAddress = _DAITokenAddress;
        DAIProxyAddress = _DAIProxyAddress;

        fixedMinAmount = 1000;
        fixedMaxAmount = 2500000;

        fixedMinInterest = 0;
        fixedMaxInterest = 3000;
    }

    function setAdministrator(address admin) public onlyOwner {
        administrator = admin;
    }

    function setFixedMinAmount(uint256 minAmount) public onlyAdmin {
        require(
            minAmount <= fixedMaxAmount,
            "Minimum amount needs to be lesser or equal than maximum amount"
        );
        fixedMinAmount = minAmount;
    }

    function setFixedMaxAmount(uint256 maxAmount) public onlyAdmin {
        require(
            maxAmount >= fixedMinAmount,
            "Maximum amount needs to be greater or equal than minimum amount"
        );
        fixedMaxAmount = maxAmount;
    }

    function setFixedMinInterest(uint256 minInterest) public onlyAdmin {
        require(
            minInterest <= fixedMaxInterest,
            "Minimum interest needs to be lesser or equal than maximum interest"
        );
        fixedMinInterest = minInterest;
    }

    function setFixedMaxInterest(uint256 maxInterest) public onlyAdmin {
        require(
            maxInterest >= fixedMinInterest,
            "Maximum interest needs to be greater or equal than minimum interest"
        );
        fixedMaxInterest = maxInterest;
    }

    function deploy(
        uint256 auctionBlockLength,
        uint256 minAmount,
        uint256 maxAmount,
        uint256 maxInterestRate,
        uint256 termEndTimestamp
    ) public onlyKYC returns (address) {
        require(administrator != address(0), "There is no administrator set");
        require(
            minAmount >= fixedMinAmount && minAmount <= fixedMaxAmount && minAmount <= maxAmount,
            "minimum amount not correct"
        );
        require(
            maxAmount >= fixedMinAmount && maxAmount <= fixedMaxAmount && maxAmount >= minAmount,
            "maximum amount not correct"
        );
        require(
            maxInterestRate >= fixedMinInterest && maxInterestRate <= fixedMaxInterest,
            "maximum interest rate not correct"
        );

        LoanContract loanContract = new LoanContract(
            auctionBlockLength,
            termEndTimestamp,
            minAmount,
            maxAmount,
            maxInterestRate,
            msg.sender,
            DAITokenAddress,
            DAIProxyAddress,
            administrator
        );
        isLoanContract[address(loanContract)] = true;

        emit LoanContractCreated(
            address(this),
            address(loanContract),
            msg.sender,
            block.number + auctionBlockLength,
            minAmount,
            maxAmount,
            maxInterestRate,
            termEndTimestamp,
            administrator
        );

        return address(loanContract);
    }

}
