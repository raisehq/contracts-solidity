pragma solidity ^0.5.0;

import 'openzeppelin-solidity/contracts/token/ERC20/ERC20.sol';
import './DAIProxyInterface.sol';
import './LoanContractInterface.sol';

// TODO:
// Add ETH emergency withdraw or reject ETH in payable function, if users sends ETH directly to this contract will be locked forever.
// - Millions of USD value have been stuck and is easy to add without any security issue, this smart contract does not handle ETH per se.

contract LoanContract is LoanContractInterface {
    ERC20 DAIToken;
    DAIProxyInterface proxy;
    address originator;

    uint256 public blockStart;
    uint256 public fundingTimeLimitBlock;
    uint256 public blockFunded;
    uint256 public timestampFunded;
    uint256 public loanRepaymentLength;

    uint256 public alreadyFunded;
    uint256 public totalAmount; // Amount borrower want in Loan
    uint256 public totalAmountWithInterest; // Amount borrower need to repay + interests
    uint256 public bpMaxInterestRate;

    bool alreadyWithdrawn;

    mapping(address => uint256) lenderAmount;

    enum LoanState {
        CREATED, // accepts bids until timelimit initial state
        FAILED_TO_FUND, // not fully funded in timelimit
        ACTIVE, // fully funded, inside timelimit
        DEFAULTED, // not repaid in time loanRepaymentLength
        REPAID, // the borrower repaid in full, lenders have yet to reclaim funds
        CLOSED // from failed_to_fund => last lender to withdraw triggers change / from repaid => fully witdrawn by lenders
    }

    LoanState public currentState;

    event LoanCreated(
        address contractAddr,
        address originator,
        uint256 totalAmount,
        uint256 loanRepaymentLength,
        uint256 fundingBlockStart,
        uint256 fundingBlockLength
    );

    event FullyFunded(address loanAddress, uint256 totalAmountWithInterest, uint256 amount);
    event Funded(address loanAddress, address lender, uint256 amount);
    event LoanRepaid(address loanAddress, uint256 timestampRepaid);
    event RepaymentWithdrawn(address loanAddress, address to, uint256 amount);
    event FullyRepaid(address loanAddress);
    event RefundWithdrawn(address loanAddress, address lender, uint256 amount);
    event FullyRefunded(address loanAddress);
    event FailedToFund(address loanAddress, address lender, uint256 amount);
    event LoanFundsWithdrawn(address loanAddress, address borrower, uint256 amount);
    event LoanDefaulted(address loanAddress);
    event RefundTotalAmount(address loanAddress, uint256 refundTotalAmount);

    modifier onlyCreated() {
        require(currentState == LoanState.CREATED, 'Incorrect loan status');
        _;
    }

    modifier onlyActive() {
        getUpdatedState();
        require(currentState == LoanState.ACTIVE, 'Incorrect loan status');
        _;
    }

    modifier onlyRepaid() {
        getUpdatedState();
        require(currentState == LoanState.REPAID, 'Incorrect loan state');
        _;
    }

    modifier onlyFailedToFund() {
        getUpdatedState();
        require(currentState == LoanState.FAILED_TO_FUND, 'Incorrect loan state');
        _;
    }

    modifier onlyProxy() {
        require(msg.sender == address(proxy), 'Caller is not the proxy');
        _;
    }

    modifier onlyOriginator() {
        require(msg.sender == originator, 'Caller is not the originator');
        _;
    }

    constructor(
        uint256 fundingTimeBlocks,// lengthBlocks,
        uint256 amount,
        uint256 _bpMaxInterestRate,
        uint256 _loanRepaymentLength,
        address _originator,
        address DAITokenAddress,
        address proxyAddress
    ) public {
        originator = _originator;
        totalAmount = amount;
        blockStart = block.number;
        fundingTimeLimitBlock = blockStart + fundingTimeBlocks;
        bpMaxInterestRate = _bpMaxInterestRate;
        alreadyWithdrawn = false;
        loanRepaymentLength = _loanRepaymentLength;

        DAIToken = ERC20(DAITokenAddress);
        proxy = DAIProxyInterface(proxyAddress);

        setState(LoanState.CREATED);
    }

    // Notes:
    // - This function does not track if real ERC20 balance has changed. Needs to blindly "trust" DaiProxy.
    // - If user sent tokens to LoanContract and is expired, it should be able to recover his
    // funds via the withdrawal pattern. Or let DAIProxy to manage the issue if this function returns "false".
    function onFundingReceived(address lender, uint256 amount) public onlyCreated onlyProxy {
        if (isExpired()) {
            setState(LoanState.FAILED_TO_FUND);
            DAIToken.transfer(lender, amount);
            emit FailedToFund(address(this), lender, amount);
            emit RefundTotalAmount(address(this), alreadyFunded);
            return;
        }

        lenderAmount[lender] += amount;
        alreadyFunded += amount;

        if (alreadyFunded > totalAmount) {
            uint256 overflow = alreadyFunded - totalAmount;
            alreadyFunded -= overflow;
            lenderAmount[lender] -= overflow;
            DAIToken.transfer(lender, overflow);
            emit Funded(address(this), lender, amount - overflow);
        } else {
            emit Funded(address(this), lender, amount);
        }

        if (alreadyFunded == totalAmount) {
            setState(LoanState.ACTIVE);
            blockFunded = block.number;
            timestampFunded = now;
            totalAmountWithInterest = calculateValueWithInterest(alreadyFunded);
            emit FullyFunded(address(this), totalAmountWithInterest, timestampFunded);
        }
    }

    //put these in proxy???

    // to == msg.sender ???
    // - IF refund is handled via DAIProxy should have "to" argument
    // - IF not, could be deleted. Currently it bypasses DAIProxy.
    function withdrawRefund(address to) public onlyFailedToFund {
        require(lenderAmount[msg.sender] != 0, 'Not a lender or already withdrawn');
        uint256 amount = lenderAmount[msg.sender];
        lenderAmount[msg.sender] = 0;
        alreadyFunded -= amount;
        emit RefundWithdrawn(address(this), to, amount);

        if (alreadyFunded == 0) {
            setState(LoanState.CLOSED);
            emit FullyRefunded(address(this));
        }

        DAIToken.transfer(to, amount);
    }

    function withdrawRepayment(address to) public onlyRepaid {
        require(lenderAmount[msg.sender] != 0, 'Not a lender or already withdrawn');
        uint256 amount = calculateValueWithInterest(lenderAmount[msg.sender]);
        lenderAmount[msg.sender] = 0; // this line is first because of reentry attack
        totalAmountWithInterest -= amount;
        emit RepaymentWithdrawn(address(this), to, amount);

        if (totalAmountWithInterest == 0) {
            setState(LoanState.CLOSED);
            emit FullyRepaid(address(this));
        }

        DAIToken.transfer(to, amount);
    }

    // TO OR ORIGINATOR????
    function withdrawLoan(address to) public onlyActive onlyOriginator {
        require(!alreadyWithdrawn, 'Already withdrawn');

        if (isDefaulted()) {
            setState(LoanState.DEFAULTED);
            emit LoanDefaulted(address(this));
            return;
        }

        alreadyWithdrawn = true;
        DAIToken.transfer(to, totalAmount);
        emit LoanFundsWithdrawn(address(this), to, totalAmount);
    }

    // this happens after transfer in daiproxy => if Defaulted we need to return funds ???
    function onRepaymentReceived(address from, uint256 amount) public onlyActive onlyProxy {
        require(from == originator, 'from address is not the originator');
        require(
            amount == calculateValueWithInterest(totalAmount),
            'Incorrect sum repaid'
        );

        // hacer modifier en dai proxy con is defaulted
        if (isDefaulted()) {
            setState(LoanState.DEFAULTED);
            DAIToken.transfer(from, amount); // this transfer could be prevented if we control it from daiproxy
            emit LoanDefaulted(address(this));
            return;
        }

        setState(LoanState.REPAID);
        emit LoanRepaid(address(this), now);
    }

    function getAlreadyFundedAmount() public view returns (uint256) {
        return alreadyFunded;
    }

    function getLenderAmount(address lender) public view returns (uint256) {
        return lenderAmount[lender];
    }

    function isExpired() public view returns (bool) {
        return block.number > fundingTimeLimitBlock;
    }

    function isDefaulted() public view returns (bool) {
        if (
            now >= timestampFunded &&
            now <= timestampFunded + loanRepaymentLength
        ) {
            return false;
        }

        return true;
    }

    function setState(LoanState state) internal {
        currentState = state;
    }

    function getUpdatedState() public returns (LoanState) {
        if (isExpired() && currentState == LoanState.CREATED) {
            setState(LoanState.FAILED_TO_FUND);
        }
        if (isDefaulted() && currentState == LoanState.ACTIVE) {
            setState(LoanState.DEFAULTED);
        }
        return currentState;
    }

    function getCurrentState() public view returns (LoanState) {
        return currentState;
    }

    function getFundingTimeLimitBlock() public view returns (uint256) {
        return fundingTimeLimitBlock;        
    }

    function calculateValueWithInterest(uint256 value) public view returns(uint256) {
        return value + (value * getInterestRate() / 10000);
    }

    function getInterestRate() public view returns (uint256) {
        if (currentState == LoanState.CREATED) {
            return bpMaxInterestRate * (block.number - blockStart) / (fundingTimeLimitBlock - blockStart);
        } else if (currentState == LoanState.ACTIVE || currentState == LoanState.REPAID) {
            return bpMaxInterestRate * (blockFunded - blockStart) / (fundingTimeLimitBlock - blockStart);
        } else {
            return 0;
        }
    }

    function getTotalAmountWithInterest() public view returns(uint256) {
        return calculateValueWithInterest(totalAmount);
    }


    function getFinalRepaymentEnd() public view returns (uint256) {
        if (timestampFunded == 0) {
            return 0;
        }
        return timestampFunded + loanRepaymentLength;
    }

    function getMaxRepaymentEnd() public view returns (uint256) {
        return fundingTimeLimitBlock + loanRepaymentLength;
    } 
}