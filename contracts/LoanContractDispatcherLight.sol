pragma solidity 0.5.10;

import "./Authorization.sol";
import "./LoanContract.sol";
import "./DAIProxy.sol";

contract LoanContractDispatcherLight is Ownable {
    Authorization auth;
    DAIProxy DAIProxyInstance;

    address public administrator;

    uint256 public operatorFee;
    uint256 public minAmount;

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
        uint256 minAmount,
        uint256 maxAmount,
        uint256 minInterestRate,
        uint256 maxInterestRate,
        uint256 termEndTimestamp,
        address indexed administrator,
        uint256 operatorFee,
        uint256 auctionLength
    );

    event OperatorFeeUpdated(uint256 operatorFee, address loanDispatcher, address administrator);

    event AuthAddressUpdated(address newAuthAddress, address administrator);
    event DaiProxyAddressUpdated(address newDaiProxyAddress, address administrator);

    event AdministratorUpdated(address newAdminAddress);

    constructor(address authAddress, address _DAIProxyAddress) public {
        auth = Authorization(authAddress);
        DAIProxyInstance = DAIProxy(_DAIProxyAddress);

        operatorFee = 1e18; //1000000000000000000; // 1 % operator fee, expressed in wei
    }

    function setAuthAddress(address authAddress) external onlyAdmin {
        auth = Authorization(authAddress);
        emit AuthAddressUpdated(authAddress, administrator);
    }

    function setDaiProxyAddress(address daiProxyAddress) external onlyAdmin {
        DAIProxyInstance = DAIProxy(daiProxyAddress);
        emit DaiProxyAddressUpdated(address(DAIProxyInstance), administrator);
    }

    function setAdministrator(address admin) external onlyOwner {
        administrator = admin;
        emit AdministratorUpdated(administrator);
    }

    function setOperatorFee(uint256 newFee) external onlyAdmin {
        operatorFee = newFee;
        emit OperatorFeeUpdated(operatorFee, address(this), msg.sender);
    }

    function deploy(
        uint256 loanMinAmount,
        uint256 loanMaxAmount,
        uint256 loanMinInterestRate,
        uint256 loanMaxInterestRate,
        uint256 termLength,
        uint256 auctionLength
    ) external onlyKYC returns (address) {
        require(administrator != address(0), "There is no administrator set");
        require(
            loanMinAmount > 0 && loanMaxAmount > 0 && loanMinAmount <= loanMaxAmount,
            "amounts not correct"
        );
        require(
            loanMaxInterestRate >= loanMinInterestRate,
            "minimum interest should not be greater than maximum interest"
        );

        LoanContract loanContract = new LoanContract(
            termLength,
            loanMinAmount,
            loanMaxAmount,
            loanMinInterestRate,
            loanMaxInterestRate,
            msg.sender,
            DAIProxyInstance.getTokenAddress(),
            address(DAIProxyInstance),
            administrator,
            operatorFee,
            auctionLength
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
            auctionLength
        );

        return address(loanContract);
    }

}
