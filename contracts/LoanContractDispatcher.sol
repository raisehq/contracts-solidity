pragma solidity ^0.5.0;

import './Authorization.sol';
import './LoanToken.sol';
import './LoanContract.sol';

contract LoanContractDispatcher {
    Authorization auth;
    LoanToken loanToken;
    mapping(address => bool) isLoanContract;

    modifier onlyKYC { // check if user is kyced
        require(auth.isKYCConfirmed(msg.sender), 'user does not have KYC');
        _;
    }

    modifier onlyLoanContract {
        // no idea what to do here
    }

    constructor(address authAddress, address loanTokenAddress) public {
        auth = Authorization(authAddress);
        loanToken = LoanToken(loanTokenAddress);
    }

    function deploy(uint256[] curveData, uint25 lengthBlocks, uint256 amount) public onlyKYC returns (address) {

    }

    function mintRequest(address to, uint256 tokenId) public onlyLoanContract {

    }

    function burnRequest(uint256 tokenId) public onlyLoanContract {

    }

    function checkOwnership(address addr, uint256 tokenId) public returns (bool) {

    }

}