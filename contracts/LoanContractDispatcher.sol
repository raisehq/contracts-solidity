pragma solidity ^0.5.0;

import './Authorization.sol';
import './LoanContract.sol';

contract LoanContractDispatcher {
    Authorization auth;
    address DAITokenAddress;
    address DAIProxyAddress;

    mapping(address => bool) public isLoanContract;

    modifier onlyKYC { // check if user is kyced
        require(auth.isKYCConfirmed(msg.sender), 'user does not have KYC');
        _;
    }

    event LoanContractCreated(
        address contractAddress,
        address originator,
        uint256 auctionEndBlock,
        uint256 minAmount,
        uint256 maxAmount,
        uint256 bpMaxInterestRate,
        uint256 termEndTimestamp
    );

    constructor(
        address authAddress,
        address _DAITokenAddress,
        address _DAIProxyAddress
    ) public {
        auth = Authorization(authAddress);
        DAITokenAddress = _DAITokenAddress;
        DAIProxyAddress = _DAIProxyAddress;
    }

    function deploy(
        uint256 auctionEndBlock,
        uint256 minAmount,
        uint256 maxAmount,
        uint256 bpMaxInterestRate,
        uint256 termEndTimestamp
    )
    public
    onlyKYC
    returns (address)
    {
        LoanContract loanContract = new LoanContract(
            auctionEndBlock,
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
            address(loanContract),
            msg.sender,
            auctionEndBlock,
            minAmount,
            maxAmount,
            bpMaxInterestRate,
            termEndTimestamp
        );

        return address(loanContract);
    }

}