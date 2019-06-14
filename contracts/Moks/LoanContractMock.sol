pragma solidity ^0.5.0;

import 'openzeppelin-solidity/contracts/token/ERC20/ERC20.sol';
import '../LoanContractInterface.sol';

contract LoanContractMock is LoanContractInterface {
    uint256 auctionBalance;
    uint256 maxAmount = 100;
    ERC20 DAIToken;
    mapping(address => uint256) lenderBidAmount;
    enum LoanPhase {Active, Finished, Repaid, Failed}
    LoanPhase currentPhase;

    constructor() public {}

    function getFundedAmount() public view returns (uint256) {
        return auctionBalance;
    }

    function onFundingReceived(address lender, uint256 amount) public {
        lenderBidAmount[lender] += amount;
        auctionBalance += amount;
    }

    function withdrawRepayment(address to) public {
        to;
    }

    function withdrawLoan(address to) public {
        to;
    }

    function onRepaymentReceived(address from, uint256 amount) public {
        from;
        amount;
    }

    function getInterestRate() public view returns (uint256) {
        return 3;
    }

    function getRepaymentStatus() public pure returns (uint256) {
        return 3;
    }

    function calculateValueWithInterest(uint256 value) public view returns(uint256) {
        return value;
    }

    function getLenderWithdrawnAmount(address lender) public pure returns (uint256){
        lender;
        return 2;
    }
}