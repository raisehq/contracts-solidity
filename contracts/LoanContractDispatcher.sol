pragma solidity 0.5.10;

import "./Authorization.sol";
import "./LoanContract.sol";

contract LoanContractDispatcher is Ownable {
    Authorization auth;
    address DAITokenAddress;
    address DAIProxyAddress;

    address administrator;

    uint256 fixedMinAmount;
    uint256 fixedMaxAmount;

    uint256 fixedMinInterest;
    uint256 fixedMaxInterest;

    mapping(address => bool) public isLoanContract;

    modifier onlyKYC {
        require(auth.isKYCConfirmed(msg.sender), "user does not have KYC");
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

    constructor(address authAddress, address _DAITokenAddress, address _DAIProxyAddress) public {
        auth = Authorization(authAddress);
        DAITokenAddress = _DAITokenAddress;
        DAIProxyAddress = _DAIProxyAddress;

        fixedMinAmount = 10000;
        fixedMaxAmount = 2500000;

        fixedMinInterest = 0;
        fixedMaxInterest = 3;
    }

    function setAdministrator(address admin) public onlyOwner {
        administrator = admin;
    }


    function deploy(
        uint256 auctionBlockLength,
        uint256 minAmount,
        uint256 maxAmount,
        uint256 maxInterestRate,
        uint256 termEndTimestamp
    )
    public onlyKYC returns (address) {
        require(administrator != address(0), 'There is no administrator set');
        require();
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
