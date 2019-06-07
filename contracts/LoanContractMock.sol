pragma solidity ^0.5.0;

import 'openzeppelin-solidity/contracts/token/ERC20/ERC20.sol';
import './LoanContractInterface.sol';

contract LoanContractMock is LoanContractInterface {
    uint256 alreadyFunded;
    uint256 totalAmount = 100;
    ERC20 DAIToken;
    mapping(address => uint256) lenderAmount;
    enum LoanPhase {Active, Finished, Repaid, Failed}
    LoanPhase currentPhase;

    constructor() public {}

    function getFundedAmount() public view returns (uint256) {
        return alreadyFunded;
    }

    function onFundingReceived(address lender, uint256 amount) public {
        lenderAmount[lender] += amount;
        alreadyFunded += amount;
    }

    function withdrawRepayment(address to) public {
        to;
    }

    function withdrawLoan(address to) public returns (uint256) {
        to;
        return 3;
    }

    function onRepaymentReceived(address from, uint256 amount) public returns (uint256) {
        from;
        amount;
        return 3;
    }

    function getInterestRate() public view returns (uint256) {
        return 3;
    }

    function getRepaymentStatus() public view returns (uint256) {
        return 3;
    }

    function calculateValueWithInterest(uint256 value) public view returns(uint256) {
        return value;
    }

    function getLenderWithdrawnAmount(address lender) public view returns (uint256){
        lender;
        return 2;
    }
}