pragma solidity 0.5.10;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "../interfaces/ILoanContract.sol";

contract LoanContractMock is ILoanContract {
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

    function onFundingReceived(address lender, uint256 amount) public returns (bool) {
        lenderBidAmount[lender] += amount;
        auctionBalance += amount;
        return true;
    }

    function withdrawRepayment() public {}

    function withdrawLoan() public {}

    function onRepaymentReceived(address from, uint256 amount) public returns (bool) {
        from;
        amount;
        return true;
    }

    function getInterestRate() public view returns (uint256) {
        return 3;
    }

    function getRepaymentStatus() public pure returns (uint256) {
        return 3;
    }

    function calculateValueWithInterest(uint256 value) public view returns (uint256) {
        return value;
    }

    function getLenderWithdrawnAmount(address lender) public pure returns (uint256) {
        lender;
        return 2;
    }
    function getMaxAmount() external view returns (uint256) {
        return 200;
    }
    function getAuctionBalance() external view returns (uint256) {
        return 0;
    }
}
