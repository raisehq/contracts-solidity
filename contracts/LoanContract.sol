pragma solidity ^0.5.0;

import 'openzeppelin-solidity/contracts/token/ERC20/ERC20.sol';
import 'openzeppelin-solidity/contracts/math/SafeMath.sol';
import './DAIProxyInterface.sol';
import './LoanContractInterface.sol';

// TODO:
// 1. Add ETH emergency withdraw or reject ETH in payable function, if users sends ETH directly to this contract will be locked forever.
// - Millions of USD value have been stuck and is easy to add without any security issue, this smart contract does not handle ETH per se.
// 2. Add minimum possible loan amount in 18 decimal format. Like 1 DAI in Wei, so is possible to do divisions.
contract LoanContract is LoanContractInterface {
    using SafeMath for uint256;
    ERC20 DAIToken;
    DAIProxyInterface proxy;
    address originator;

    uint256 public minAmount;
    uint256 public maxAmount;

    uint256 public auctionStartBlock;
    uint256 public auctionEndBlock;
    uint256 public auctionBlockLength;

    uint256 public termStartTimestamp;
    uint256 public termEndTimestamp;


    uint256 public auctionBalance;
    uint256 public borrowerDebt; // Amount borrower need to repay == auctionBalance + interests
    uint256 public bpMaxInterestRate;

    uint256 internal interestRate;

    bool public loanWithdrawn;
    bool public minimumReached;
    bool public auctionEnded;

    mapping(address => uint256) public lenderBidAmount;
    mapping(address => bool) public lenderWithdrawn;

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
        address indexed contractAddr,
        address indexed originator,
        uint256 minAmount,
        uint256 maxAmount,
        uint256 bpMaxInterestRate,
        uint256 auctionStartBlock,
        uint256 auctionEndBlock
    );

    event MinimumFundingReached(address loanAddress, uint256 currentBalance);
    event FullyFunded(address loanAddress, uint256 balanceToRepay, uint256 auctionBalance);
    event Funded(address loanAddress, address indexed lender, uint256 amount);
    event LoanRepaid(address loanAddress, uint256 timestampRepaid);
    event RepaymentWithdrawn(address loanAddress, address to, uint256 amount);
    event FullyRepaid(address loanAddress);
    event RefundWithdrawn(address loanAddress, address lender, uint256 amount);
    event FullyRefunded(address loanAddress);
    event FailedToFund(address loanAddress, address lender, uint256 amount);
    event LoanFundsWithdrawn(address loanAddress, address borrower, uint256 amount);
    event LoanDefaulted(address loanAddress);
    event RefundmaxAmount(address loanAddress, uint256 refundmaxAmount);

    modifier onlyCreated() {
        require(currentState == LoanState.CREATED, 'Incorrect loan status');
        _;
    }

    modifier onlyActive() {
        updateMachineState();
        require(currentState == LoanState.ACTIVE, 'Incorrect loan status');
        _;
    }

    modifier onlyRepaid() {
        updateMachineState();
        require(currentState == LoanState.REPAID, 'Incorrect loan state');
        _;
    }

    modifier onlyFailedToFund() {
        updateMachineState();
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
        uint256 _auctionBlockLength,
        uint256 _termEndTimestamp,
        uint256 _minAmount,
        uint256 _maxAmount,
        uint256 _bpMaxInterestRate,
        address _originator,
        address DAITokenAddress,
        address proxyAddress
    ) public {
        DAIToken = ERC20(DAITokenAddress);
        proxy = DAIProxyInterface(proxyAddress);
        originator = _originator;
        
        bpMaxInterestRate = _bpMaxInterestRate;
        minAmount = _minAmount;
        maxAmount = _maxAmount;
        
        auctionBlockLength = _auctionBlockLength;
        auctionStartBlock = block.number;
        auctionEndBlock = auctionStartBlock.add(_auctionBlockLength);
        
        termEndTimestamp = _termEndTimestamp;

        setState(LoanState.CREATED);
    }

    // Notes:
    // - This function does not track if real ERC20 balance has changed. Needs to blindly "trust" DaiProxy.
    // - If user sent tokens to LoanContract and is expired, it should be able to recover his
    // funds via the withdrawal pattern. Or let DAIProxy to manage the issue if this function returns "false".
    function onFundingReceived(address lender, uint256 amount) public onlyCreated onlyProxy {
        if (auctionBalance < minAmount && isAuctionExpired()) {
            setState(LoanState.FAILED_TO_FUND);
            DAIToken.transfer(lender, amount);
            emit FailedToFund(address(this), lender, amount);
            emit RefundmaxAmount(address(this), auctionBalance);
            return;
        }

        lenderBidAmount[lender] = lenderBidAmount[lender].add(amount);
        auctionBalance = auctionBalance.add(amount);

        if (auctionBalance > maxAmount) {
            uint256 overflow = auctionBalance.sub(maxAmount);
            auctionBalance = auctionBalance.sub(overflow);
            lenderBidAmount[lender] = lenderBidAmount[lender].sub(overflow);
            DAIToken.transfer(lender, overflow);
            emit Funded(address(this), lender, amount.sub(overflow));
        } else if (auctionBalance >= minAmount && !minimumReached) {
            minimumReached = true;
            emit Funded(address(this), lender, amount);
            emit MinimumFundingReached(address(this), auctionBalance);
        } else {
            emit Funded(address(this), lender, amount);
        }

        if ( (auctionBalance == maxAmount) ||
             (minimumReached && isAuctionExpired() && currentState == LoanState.CREATED)
        ) {
            setState(LoanState.ACTIVE);
            auctionEndBlock = block.number;

            termStartTimestamp = block.timestamp;
            borrowerDebt = calculateValueWithInterest(auctionBalance);
            emit FullyFunded(address(this), borrowerDebt, block.timestamp);
        } 
    }

    //put these in proxy??? 
    // Seems this function bypass KYC? A user that we detect that did fraudulent KYC procedure
    // after the auction can be removed from KYC registry, but the fraud users could still refund from this method.

    // to == msg.sender ???
    // - IF refund is handled via DAIProxy should have "to" argument
    // - IF not, could be deleted. Currently it bypasses DAIProxy.
    function withdrawRefund(address to) public onlyFailedToFund {
        require(!lenderWithdrawn[msg.sender], 'Lender already withdrawn');
        require(lenderBidAmount[msg.sender] > 0, 'Account did not deposited.');
        
        lenderWithdrawn[msg.sender] = true;
        
        DAIToken.transfer(to, lenderBidAmount[msg.sender]);

        emit RefundWithdrawn(address(this), to, lenderBidAmount[msg.sender]);

        if (DAIToken.balanceOf(address(this)) == 0) {
            setState(LoanState.CLOSED);
            emit FullyRefunded(address(this));
        }
    }

    function withdrawRepayment(address to) public onlyRepaid {
        require(!lenderWithdrawn[msg.sender], 'Lender already withdrawn');
        require(lenderBidAmount[msg.sender] != 0, 'Account did not deposited');
        uint256 amount = calculateValueWithInterest(lenderBidAmount[msg.sender]);
        lenderWithdrawn[msg.sender] = false;
        emit RepaymentWithdrawn(address(this), to, amount);

        DAIToken.transfer(to, amount);

        if (DAIToken.balanceOf(address(this)) == 0) {
            setState(LoanState.CLOSED);
            emit FullyRefunded(address(this));
        }
    }

    // TO OR ORIGINATOR????
    function withdrawLoan(address to) public onlyActive onlyOriginator {
        require(!loanWithdrawn, 'Already withdrawn');

        if (isDefaulted()) {
            setState(LoanState.DEFAULTED);
            emit LoanDefaulted(address(this));
            return;
        }

        loanWithdrawn = true;
        DAIToken.transfer(to, auctionBalance);
        emit LoanFundsWithdrawn(address(this), to, auctionBalance);
    }

    // this happens after transfer in daiproxy => if Defaulted we need to return funds ???
    function onRepaymentReceived(address from, uint256 amount) public onlyActive onlyProxy {
        require(from == originator, 'from address is not the originator');
        require(
            amount == borrowerDebt,
            'Incorrect sum repaid'
        );
        require(borrowerDebt != 0, 'Borrower does not have any debt.');
        require(DAIToken.balanceOf(address(this)) == borrowerDebt, 'Repayment amount is not the same');

        // hacer modifier en dai proxy con is defaulted
        if (isDefaulted()) {
            setState(LoanState.DEFAULTED);
            DAIToken.transfer(from, amount); // this transfer could be prevented if we control it from daiproxy
            emit LoanDefaulted(address(this));
            return;
        }

        setState(LoanState.REPAID);
        emit LoanRepaid(address(this), block.timestamp);
    }

    function isAuctionExpired() public view returns (bool) {
        return block.number > auctionEndBlock;
    }

    function isDefaulted() public view returns (bool) {
        if (
            block.timestamp >= termStartTimestamp &&
            block.timestamp <= termEndTimestamp
        ) {
            return false;
        }

        return true;
    }

    function setState(LoanState state) internal {
        currentState = state;
    }

    function updateMachineState() public returns (LoanState) {
        if (isAuctionExpired() && currentState == LoanState.CREATED) {
            setState(LoanState.FAILED_TO_FUND);
        }
        if (isDefaulted() && currentState == LoanState.ACTIVE) {
            setState(LoanState.DEFAULTED);
        }
        return currentState;
    }

    function calculateValueWithInterest(uint256 value) public view returns(uint256) {
        return value.add(value.mul(getInterestRate()).div(10000));
    }

    function getInterestRate() public view returns (uint256) {
        if (currentState == LoanState.CREATED) {
            return bpMaxInterestRate.mul(block.number.sub(auctionStartBlock)).div(auctionBlockLength.sub(auctionStartBlock));
        } else if (currentState == LoanState.ACTIVE || currentState == LoanState.REPAID) {
            return bpMaxInterestRate.mul(auctionEndBlock.sub(auctionStartBlock)).div(auctionBlockLength.sub(auctionStartBlock));
        } else {
            return 0;
        }
    }
}