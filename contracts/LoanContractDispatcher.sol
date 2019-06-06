pragma solidity ^0.5.0;

import './Authorization.sol';
import './LoanContract.sol';

contract LoanContractDispatcher {
    Authorization auth;
    address DAITokenAddress;
    address DAIProxyAddress;

    mapping(address => bool) isLoanContract;

    modifier onlyKYC { // check if user is kyced
        require(auth.isKYCConfirmed(msg.sender), 'user does not have KYC');
        _;
    }

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
        uint256 lengthBlocks,
        uint256 amount,
        uint256 bpMaxInterestRate,
        uint256 termLength,
        uint256 graceLength
    )
    public
    onlyKYC
    returns (address)
    {
        LoanContract loanContract = new LoanContract(
            lengthBlocks,
            amount,
            bpMaxInterestRate,
            termLength,
            graceLength,
            msg.sender,
            DAITokenAddress,
            DAIProxyAddress
        );
        isLoanContract[address(loanContract)] = true;
        return address(loanContract);
    }

}