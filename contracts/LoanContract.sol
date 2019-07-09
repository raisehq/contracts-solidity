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
    address public originator;

    uint256 public minAmount;
    uint256 public maxAmount;

    uint256 public auctionStartBlock;
    uint256 public auctionEndBlock;
    uint256 public auctionFundedBlock;
    uint256 public auctionBlockLength;

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
    event FullyFunded(address loanAddress, uint256 balanceToRepay, uint256 auctionBalance, uint256 indexed fundedTimestamp);
    event Funded(address loanAddress, address indexed lender, uint256 amount);
    event LoanRepaid(address loanAddress, uint256 indexed timestampRepaid);
    event RepaymentWithdrawn(address loanAddress, address indexed to, uint256 amount);
    event FullyRepaid(address loanAddress);
    event RefundWithdrawn(address loanAddress, address indexed lender, uint256 amount);
    event FullyRefunded(address loanAddress);
    event FailedToFund(address loanAddress, address indexed lender, uint256 amount);
    event LoanFundsWithdrawn(address loanAddress, address indexed borrower, uint256 amount);
    event LoanDefaulted(address loanAddress);

    modifier onlyCreated() {
        require(currentState == LoanState.CREATED, 'Incorrect loan status');
        _;
    }

    modifier onlyActive() {
        updateStateMachine();
        require(currentState == LoanState.ACTIVE, 'Incorrect loan status');
        _;
    }

    modifier onlyRepaid() {
        updateStateMachine();
        require(currentState == LoanState.REPAID, 'Incorrect loan state');
        _;
    }

    modifier onlyFailedToFund() {
        updateStateMachine();
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
        auctionEndBlock = auctionStartBlock.add(auctionBlockLength);

        termEndTimestamp = _termEndTimestamp;

        setState(LoanState.CREATED);
    }

    // Notes:
    // - This function does not track if real ERC20 balance has changed. Needs to blindly "trust" DaiProxy.
    function onFundingReceived(address lender, uint256 amount) public onlyCreated onlyProxy returns (bool) {
        if (isAuctionExpired()) {
            if (auctionBalance < minAmount) {
                setState(LoanState.FAILED_TO_FUND);
                emit FailedToFund(address(this), lender, amount);
                return false;
            } else {
                setState(LoanState.ACTIVE);
                emit FailedToFund(address(this), lender, amount);
                emit FullyFunded(address(this), borrowerDebt, auctionBalance, block.timestamp);
                return false;
            }
        }

        lenderBidAmount[lender] = lenderBidAmount[lender].add(amount);
        auctionBalance = auctionBalance.add(amount);

        auctionFundedBlock = block.number;
        borrowerDebt = calculateValueWithInterest(auctionBalance);

        if (auctionBalance >= minAmount && !minimumReached) {
            minimumReached = true;
            emit Funded(address(this), lender, amount);
            emit MinimumFundingReached(address(this), auctionBalance);
        } else {
            emit Funded(address(this), lender, amount);
        }

        if (auctionBalance == maxAmount) {
            setState(LoanState.ACTIVE);
            emit FullyFunded(address(this), borrowerDebt, auctionBalance, block.timestamp);
        }
        return true;
    }

    //put these in proxy???
    // Seems this function bypass KYC? A user that we detect that did fraudulent KYC procedure
    // after the auction can be removed from KYC registry, but the fraud users could still refund from this method.
    function withdrawRefund() public onlyFailedToFund {
        require(!lenderWithdrawn[msg.sender], 'Lender already withdrawn');
        require(lenderBidAmount[msg.sender] > 0, 'Account did not deposited.');

        lenderWithdrawn[msg.sender] = true;

        emit RefundWithdrawn(address(this), msg.sender, lenderBidAmount[msg.sender]);

        DAIToken.transfer(msg.sender, lenderBidAmount[msg.sender]);
        
        if (DAIToken.balanceOf(address(this)) == 0) {
            setState(LoanState.CLOSED);
            emit FullyRefunded(address(this));
        }
    }

    function withdrawRepayment() public onlyRepaid {
        require(!lenderWithdrawn[msg.sender], 'Lender already withdrawn');
        require(lenderBidAmount[msg.sender] != 0, 'Account did not deposited');
        uint256 amount = calculateValueWithInterest(lenderBidAmount[msg.sender]);
        lenderWithdrawn[msg.sender] = true;
        emit RepaymentWithdrawn(address(this), msg.sender, amount);

        DAIToken.transfer(msg.sender, amount);

        if (DAIToken.balanceOf(address(this)) == 0) {
            setState(LoanState.CLOSED);
            emit FullyRefunded(address(this));
        }
    }

    function withdrawLoan() public onlyActive onlyOriginator {
        require(!loanWithdrawn, 'Already withdrawn');

        if (isDefaulted()) {
            setState(LoanState.DEFAULTED);
            emit LoanDefaulted(address(this));
            return;
        }

        loanWithdrawn = true;
        emit LoanFundsWithdrawn(address(this), msg.sender, auctionBalance);
        DAIToken.transfer(msg.sender, auctionBalance);
    }

    function onRepaymentReceived(address from, uint256 amount) public onlyActive onlyProxy returns (bool) {
        require(from == originator, 'from address is not the originator');
        require(
            amount == borrowerDebt,
            'Incorrect sum repaid'
        );
        require(borrowerDebt != 0, 'Borrower does not have any debt.');
        require(borrowerDebt == amount, 'Repayment amount is not the same');

        if (isDefaulted()) {
            setState(LoanState.DEFAULTED);
            emit LoanDefaulted(address(this));
            return false;
        }

        setState(LoanState.REPAID);
        emit LoanRepaid(address(this), block.timestamp);
        return true;
    }

    function isAuctionExpired() public view returns (bool) {
        return block.number > auctionEndBlock;
    }

    function isDefaulted() public view returns (bool) {
        if (
            block.timestamp <= termEndTimestamp
        ) {
            return false;
        }

        return true;
    }

    function setState(LoanState state) internal {
        currentState = state;
    }

    function updateStateMachine() public returns (LoanState) {
        if (isAuctionExpired() && currentState == LoanState.CREATED) {
            if (!minimumReached) {
                setState(LoanState.FAILED_TO_FUND);
            } else {
                setState(LoanState.ACTIVE);
                emit FullyFunded(address(this), borrowerDebt, auctionBalance, block.timestamp);
            }
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
            return bpMaxInterestRate.mul(block.number.sub(auctionStartBlock)).div(auctionEndBlock.sub(auctionStartBlock));
        } else if (currentState == LoanState.ACTIVE || currentState == LoanState.REPAID) {
            return bpMaxInterestRate.mul(auctionFundedBlock.sub(auctionStartBlock)).div(auctionEndBlock.sub(auctionStartBlock));
        } else {
            return 0;
        }
    }

    function getMaxAmount() public view returns (uint256) {
        return maxAmount;
    }

    function getAuctionBalance() public view returns (uint256) {
        return auctionBalance;
    }

    function getLenderBidAmount(address lender) public view returns (uint256) {
        return lenderBidAmount[lender];
    }

    function getLenderWithdrawn(address lender) public view returns (bool) {
        return lenderWithdrawn[lender];
    }
}