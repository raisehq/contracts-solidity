pragma solidity 0.5.10;

import "./Authorization.sol";
import "./LoanContract.sol";

contract LoanContractDispatcher {
    Authorization auth;
    address DAITokenAddress;
    address DAIProxyAddress;

    mapping(address => bool) public isLoanContract;

    modifier onlyKYC {
        require(auth.isKYCConfirmed(msg.sender), "user does not have KYC");
        _;
    }

    event LoanContractCreated(
        address loanDispatcher,
        address contractAddress,
        address indexed originator,
        uint256 auctionBlockLength,
        uint256 minAmount,
        uint256 maxAmount,
        uint256 bpMaxInterestRate,
        uint256 termEndTimestamp
    );

    constructor(address authAddress, address _DAITokenAddress, address _DAIProxyAddress) public {
        auth = Authorization(authAddress);
        DAITokenAddress = _DAITokenAddress;
        DAIProxyAddress = _DAIProxyAddress;
    }

    function deploy(
        uint256 auctionBlockLength,
        uint256 minAmount,
        uint256 maxAmount,
        uint256 bpMaxInterestRate,
        uint256 termEndTimestamp
    ) public onlyKYC returns (address) {
        LoanContract loanContract = new LoanContract(
            auctionBlockLength,
            termEndTimestamp,
            minAmount,
            maxAmount,
            bpMaxInterestRate,
            msg.sender,
            DAITokenAddress,
            DAIProxyAddress
        );
        isLoanContract[address(loanContract)] = true;

        emit LoanContractCreated(
            address(this),
            address(loanContract),
            msg.sender,
            block.number + auctionBlockLength,
            minAmount,
            maxAmount,
            bpMaxInterestRate,
            termEndTimestamp
        );

        return address(loanContract);
    }

}
