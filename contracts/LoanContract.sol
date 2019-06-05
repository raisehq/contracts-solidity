pragma solidity ^0.5.0;

import './DAI.sol';
import './DAIProxy.sol';
import './LoanContractDispatcher.sol';

contract LoanContract {
    DAI DAIToken;
    DAIProxy proxy;
    LoanContractDispatcher dispatcher;
    uint256[] curveData; // what is this??
    address originator;
    uint256 blockStart;
    uint256 blockEnd;
    uint256 blockFunded;
    uint256 alreadyFunded;
    uint256 totalAmount;

    mapping(uint256 => uint256) tokenValue;
    mapping(address => uint256) lenderAmount;

    LoanPhase currentPhase; // does this need to be defined somewhere??

    constructor(uint256[] curveData, uint256 lengthBlocks, uint256 amount, address originator, address creator, address authAddress) public {

    }

    function onFundingReceived(address lender, uint256 amount) public onlyActive onlyProxy {}
    function claimToken(address to) public onlyFinishedOrFailed onlyLender returns (uint256) {}
    function withdrawRepayment(uint256 tokenId, address to) public onlyRepaidOrFailed {}
    function getInterestRate() public view returns (uint256) {}
    function withdrawLoan(address to) public view returns (uint256) public onlyFinished onlyOriginator {} // only one public
    function onRepaymentReceived(address from, uint256 amount) public view returns (uint256) public onlyFinished onlyOriginator {} // only one public
}