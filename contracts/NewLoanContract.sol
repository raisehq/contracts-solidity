pragma solidity ^0.5.0;

import 'openzeppelin-solidity/contracts/token/ERC20/ERC20.sol';
import './DAIProxyInterface.sol';
import './LoanContractInterface.sol';

contract LoanContract is LoanContractInterface {
    ERC20 DAIToken;
    DAIProxyInterface proxy;
    address originator;

    uint256 blockStart;
    uint256 blockEnd;
    uint256 blockFunded;
    uint256 timestampFunded;
    uint256 termLength;
    uint256 gracePeriodLength;

    uint256 alreadyFunded;
    uint256 totalAmount;
    uint256 bpMaxInterestRate;

    bool alreadyWithdrawn;

    mapping(address => uint256) lenderAmount;

    enum LoanPhase {
        CREATED, // accepts bids until timelimit initial state
        FAILED_TO_FUND, // not fully funded in timelimit
        ACTIVE, // fully funded, inside timelimit
        DEFAULTED, // not repaid in time termlength
        REPAID, // the borrower repaid in full, lenders have yet to reclaim funds
        CLOSED // from failed_to_fund => last lender to withdraw triggers change / from repaid => fully witdrawn by lenders
    }

    LoanPhase currentPhase;

    event LoanCreated(
        address contractAddr,
        address originator,
        uint256 totalAmount,
        uint256 termLength,
        uint256 gracePeriodLength,
        uint256 fundingBlockStart,
        uint256 fundingBlockLength
    );

    event LoanFunded(address lender, uint256 amount);
    event LoanFullyFunded(uint256 timeAtFullyFunded);
    event LoanFailed();
    event LoanWithdrawn(address lender, uint256 amount);
    event LoanRepaid(address loanAddress, uint256 timeAtRepaid);
    event RepaymentWithdrawn(address to, uint256 amount);
}