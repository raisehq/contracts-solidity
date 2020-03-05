pragma solidity 0.5.12;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./interfaces/IDAIProxy.sol";
import "./interfaces/ILoanContract.sol";
import "./interfaces/ISwapAndDeposit.sol";
import "./interfaces/ISwapAndDepositFactory.sol";

contract LoanContract is ILoanContract {
    using SafeMath for uint256;
    address public swapFactory;
    address public proxyContractAddress;
    address public tokenAddress;
    address public originator;
    address public administrator;

    uint256 public minAmount;
    uint256 public maxAmount;
    uint256 public auctionEndTimestamp;
    uint256 public auctionStartTimestamp;
    uint256 public auctionLength;
    uint256 public lastFundedTimestamp;
    uint256 public termEndTimestamp;
    uint256 public termLength;
    uint256 public auctionBalance;
    uint256 public loanWithdrawnAmount;
    uint256 public borrowerDebt;
    uint256 public minInterestRate;
    uint256 public maxInterestRate;
    uint256 public operatorFee;
    uint256 public operatorBalance;
    uint256 constant MONTH_SECONDS = 2592000;
    uint256 constant ONE_HUNDRED = 100000000000000000000;

    struct Position {
        uint256 bidAmount;
        bool withdrawn;
    }

    mapping(address => Position) public lenderPosition;

    enum LoanState {
        CREATED, // accepts bids until timelimit initial state
        FAILED_TO_FUND, // not fully funded in timelimit
        ACTIVE, // fully funded, inside timelimit
        DEFAULTED, // not repaid in time loanRepaymentLength
        REPAID, // the borrower repaid in full, lenders have yet to reclaim funds
        CLOSED, // from failed_to_fund => last lender to withdraw triggers change / from repaid => fully witdrawn by lenders
        FROZEN // when admin unlocks withdrawals
    }

    LoanState public currentState;

    IERC20 public ERC20Token;
    IDAIProxy public proxy;

    bool public loanWithdrawn;
    bool public minimumReached;

    event LoanCreated(
        address indexed contractAddr,
        address indexed originator,
        uint256 minAmount,
        uint256 maxAmount,
        uint256 minInterestRate,
        uint256 maxInterestRate,
        uint256 auctionStartTimestamp,
        uint256 auctionEndTimestamp,
        address indexed administrator,
        uint256 operatorFee,
        address tokenAddress
    );

    event MinimumFundingReached(address loanAddress, uint256 currentBalance, uint256 interest);
    event FullyFunded(
        address loanAddress,
        uint256 balanceToRepay,
        uint256 auctionBalance,
        uint256 interest,
        uint256 fundedTimestamp
    );
    event Funded(
        address loanAddress,
        address indexed lender,
        uint256 amount,
        uint256 interest,
        uint256 fundedTimestamp
    );
    event LoanRepaid(address loanAddress, uint256 indexed timestampRepaid);
    event RepaymentWithdrawn(address loanAddress, address indexed to, uint256 amount);
    event RefundWithdrawn(address loanAddress, address indexed lender, uint256 amount);
    event FullyRefunded(address loanAddress);
    event FailedToFund(address loanAddress, address indexed lender, uint256 amount);
    event LoanFundsWithdrawn(address loanAddress, address indexed borrower, uint256 amount);
    event LoanDefaulted(address loanAddress);
    event AuctionSuccessful(
        address loanAddress,
        uint256 balanceToRepay,
        uint256 auctionBalance,
        uint256 operatorBalance,
        uint256 interest,
        uint256 fundedTimestamp
    );
    event FundsUnlockedWithdrawn(address loanAddress, address indexed lender, uint256 amount);
    event FullyFundsUnlockedWithdrawn(address loanAddress);
    event LoanFundsUnlocked(uint256 auctionBalance);
    event OperatorWithdrawn(uint256 amount, address administrator);

    modifier onlyFrozen() {
        require(currentState == LoanState.FROZEN, "Loan status is not FROZEN");
        _;
    }

    modifier onlyAdmin() {
        require(msg.sender == administrator, "Caller is not an administrator");
        _;
    }

    modifier onlyCreated() {
        require(currentState == LoanState.CREATED, "Loan status is not CREATED");
        _;
    }

    modifier onlyActive() {
        updateStateMachine();
        require(currentState == LoanState.ACTIVE, "Loan status is not ACTIVE");
        _;
    }

    modifier onlyRepaid() {
        updateStateMachine();
        require(currentState == LoanState.REPAID, "Loan status is not REPAID");
        _;
    }

    modifier onlyFailedToFund() {
        updateStateMachine();
        require(currentState == LoanState.FAILED_TO_FUND, "Loan status is not FAILED_TO_FUND");
        _;
    }

    modifier onlyProxy() {
        require(msg.sender == address(proxy), "Caller is not the proxy");
        _;
    }

    modifier onlyOriginator() {
        require(msg.sender == originator, "Caller is not the originator");
        _;
    }

    constructor(
        uint256 _termLength,
        uint256 _minAmount,
        uint256 _maxAmount,
        uint256 _minInterestRate,
        uint256 _maxInterestRate,
        address _originator,
        address ERC20TokenAddress,
        address proxyAddress,
        address _administrator,
        uint256 _operatorFee,
        uint256 _auctionLength,
        address _swapFactory
    ) public {
        tokenAddress = ERC20TokenAddress;
        proxyContractAddress = proxyAddress;
        ERC20Token = IERC20(tokenAddress);
        proxy = IDAIProxy(proxyContractAddress);
        originator = _originator;
        administrator = _administrator;
        swapFactory = _swapFactory;

        minInterestRate = _minInterestRate;
        maxInterestRate = _maxInterestRate;
        minAmount = _minAmount;
        maxAmount = _maxAmount;

        auctionLength = _auctionLength;
        auctionStartTimestamp = block.timestamp;
        auctionEndTimestamp = auctionStartTimestamp + auctionLength;

        termLength = _termLength;

        loanWithdrawnAmount = 0;

        operatorFee = _operatorFee;

        setState(LoanState.CREATED);
        emit LoanCreated(
            address(this),
            originator,
            minAmount,
            maxAmount,
            minInterestRate,
            maxInterestRate,
            auctionStartTimestamp,
            auctionEndTimestamp,
            administrator,
            operatorFee,
            tokenAddress
        );
    }

    function getMaxAmount() external view returns (uint256) {
        return maxAmount;
    }

    function getAuctionBalance() external view returns (uint256) {
        return auctionBalance;
    }

    function getLenderBidAmount(address lender) external view returns (uint256) {
        return lenderPosition[lender].bidAmount;
    }

    function getLenderWithdrawn(address lender) external view returns (bool) {
        return lenderPosition[lender].withdrawn;
    }

    function getTokenAddress() external view returns (address) {
        return tokenAddress;
    }
    // Notes:
    // - This function does not track if real IERC20 balance has changed. Needs to blindly "trust" DaiProxy.
    function onFundingReceived(address lender, uint256 amount)
        external
        onlyCreated
        onlyProxy
        returns (bool)
    {
        if (isAuctionExpired()) {
            if (auctionBalance < minAmount) {
                setState(LoanState.FAILED_TO_FUND);
                emit FailedToFund(address(this), lender, amount);
                return false;
            } else {
                require(setSuccessfulAuction(), "error while transitioning to successful auction");
                emit FailedToFund(address(this), lender, amount);
                return false;
            }
        }
        uint256 interest = getInterestRate();
        lenderPosition[lender].bidAmount = lenderPosition[lender].bidAmount.add(amount);
        auctionBalance = auctionBalance.add(amount);

        lastFundedTimestamp = block.timestamp;

        if (auctionBalance >= minAmount && !minimumReached) {
            minimumReached = true;
            emit Funded(address(this), lender, amount, interest, lastFundedTimestamp);
            emit MinimumFundingReached(address(this), auctionBalance, interest);
        } else {
            emit Funded(address(this), lender, amount, interest, lastFundedTimestamp);
        }

        if (auctionBalance == maxAmount) {
            require(setSuccessfulAuction(), "error while transitioning to successful auction");
            emit FullyFunded(
                address(this),
                borrowerDebt,
                auctionBalance,
                interest,
                lastFundedTimestamp
            );
        }
        return true;
    }

    function unlockFundsWithdrawal() external onlyAdmin {
        setState(LoanState.FROZEN);
        emit LoanFundsUnlocked(auctionBalance);
    }

    function withdrawFees() external onlyAdmin returns (bool) {
        require(loanWithdrawn == true, "borrower didnt withdraw");
        require(operatorBalance > 0, "no funds to withdraw");
        uint256 allFees = operatorBalance;
        operatorBalance = 0;
        require(ERC20Token.transfer(msg.sender, allFees), "transfer failed");
        emit OperatorWithdrawn(allFees, msg.sender);
        return true;
    }

    function withdrawFundsUnlocked() external onlyFrozen {
        require(!loanWithdrawn, "Loan already withdrawn");
        require(!lenderPosition[msg.sender].withdrawn, "Lender already withdrawn");
        require(lenderPosition[msg.sender].bidAmount > 0, "Account did not deposit");

        lenderPosition[msg.sender].withdrawn = true;

        loanWithdrawnAmount = loanWithdrawnAmount.add(lenderPosition[msg.sender].bidAmount);

        require(
            ERC20Token.transfer(msg.sender, lenderPosition[msg.sender].bidAmount),
            "error while transfer"
        );

        emit FundsUnlockedWithdrawn(
            address(this),
            msg.sender,
            lenderPosition[msg.sender].bidAmount
        );

        if (loanWithdrawnAmount == auctionBalance.add(operatorBalance)) {
            setState(LoanState.CLOSED);
            emit FullyFundsUnlockedWithdrawn(address(this));
        }
    }

    function withdrawRefund() external onlyFailedToFund {
        require(!lenderPosition[msg.sender].withdrawn, "Lender already withdrawn");
        require(lenderPosition[msg.sender].bidAmount > 0, "Account did not deposited.");

        lenderPosition[msg.sender].withdrawn = true;

        loanWithdrawnAmount = loanWithdrawnAmount.add(lenderPosition[msg.sender].bidAmount);

        emit RefundWithdrawn(address(this), msg.sender, lenderPosition[msg.sender].bidAmount);

        require(
            ERC20Token.transfer(msg.sender, lenderPosition[msg.sender].bidAmount),
            "error while transfer"
        );

        if (loanWithdrawnAmount == auctionBalance) {
            setState(LoanState.CLOSED);
            emit FullyRefunded(address(this));
        }
    }

    function withdrawRepayment() external onlyRepaid {
        require(!lenderPosition[msg.sender].withdrawn, "Lender already withdrawn");
        require(lenderPosition[msg.sender].bidAmount != 0, "Account did not deposited");
        uint256 amount = calculateValueWithInterest(lenderPosition[msg.sender].bidAmount);
        lenderPosition[msg.sender].withdrawn = true;

        loanWithdrawnAmount = loanWithdrawnAmount.add(amount);
        require(ERC20Token.transfer(msg.sender, amount), "error while transfer");

        emit RepaymentWithdrawn(address(this), msg.sender, amount);
        if (loanWithdrawnAmount == borrowerDebt) {
            setState(LoanState.CLOSED);
            emit FullyRefunded(address(this));
        }
    }

    function withdrawRepaymentAndDeposit() external onlyRepaid {
        require(swapFactory != address(0), "swap factory is 0");
        require(!lenderPosition[msg.sender].withdrawn, "Lender already withdrawn");
        require(lenderPosition[msg.sender].bidAmount != 0, "Account did not deposited");
        uint256 amount = calculateValueWithInterest(lenderPosition[msg.sender].bidAmount);
        lenderPosition[msg.sender].withdrawn = true;
        loanWithdrawnAmount = loanWithdrawnAmount.add(amount);
        address swapAddress = ISwapAndDepositFactory(swapFactory).deploy();
        require(swapAddress != address(0), "error swap deploy");
        ERC20Token.approve(swapAddress, amount);
        ISwapAndDeposit(swapAddress).swapAndDeposit(msg.sender, tokenAddress, amount);
        require(
            ISwapAndDeposit(swapAddress).isDestroyed(),
            "Swap contract error, should self-destruct"
        );
        emit RepaymentWithdrawn(address(this), msg.sender, amount);
        if (loanWithdrawnAmount == borrowerDebt) {
            setState(LoanState.CLOSED);
            emit FullyRefunded(address(this));
        }
    }

    function withdrawLoan() external onlyActive onlyOriginator {
        require(!loanWithdrawn, "Already withdrawn");
        loanWithdrawn = true;
        emit LoanFundsWithdrawn(address(this), msg.sender, auctionBalance);
        require(ERC20Token.transfer(msg.sender, auctionBalance), "error while transfer");
    }

    function onRepaymentReceived(address from, uint256 amount)
        external
        onlyActive
        onlyProxy
        returns (bool)
    {
        require(from == originator, "from address is not the originator");
        require(borrowerDebt == amount, "Repayment amount is not the same");

        setState(LoanState.REPAID);
        emit LoanRepaid(address(this), block.timestamp);
        return true;
    }

    function isAuctionExpired() public view returns (bool) {
        return block.timestamp > auctionEndTimestamp;
    }

    function isDefaulted() public view returns (bool) {
        if (block.timestamp <= auctionEndTimestamp || block.timestamp <= termEndTimestamp) {
            return false;
        }

        return true;
    }

    function updateStateMachine() public returns (LoanState) {
        if (isAuctionExpired() && currentState == LoanState.CREATED) {
            if (!minimumReached) {
                setState(LoanState.FAILED_TO_FUND);
            } else {
                require(setSuccessfulAuction(), "error while transitioning to successful auction");
            }
        }
        if (isDefaulted() && currentState == LoanState.ACTIVE) {
            setState(LoanState.DEFAULTED);
            emit LoanDefaulted(address(this));
        }

        return currentState;
    }

    function calculateValueWithInterest(uint256 value) public view returns (uint256) {
        return
            value.add(
                value.mul(getInterestRate().mul(termLength).div(MONTH_SECONDS)).div(ONE_HUNDRED)
            );
    }

    function getInterestRate() public view returns (uint256) {
        if (currentState == LoanState.CREATED) {
            return
                (maxInterestRate.sub(minInterestRate))
                    .mul(block.timestamp.sub(auctionStartTimestamp))
                    .div(auctionEndTimestamp.sub(auctionStartTimestamp))
                    .add(minInterestRate);
        } else if (currentState == LoanState.ACTIVE || currentState == LoanState.REPAID) {
            return
                (maxInterestRate.sub(minInterestRate))
                    .mul(lastFundedTimestamp.sub(auctionStartTimestamp))
                    .div(auctionEndTimestamp.sub(auctionStartTimestamp))
                    .add(minInterestRate);
        } else {
            return 0;
        }
    }

    function setState(LoanState state) internal {
        currentState = state;
    }

    function setSuccessfulAuction() internal onlyCreated returns (bool) {
        setState(LoanState.ACTIVE);
        borrowerDebt = calculateValueWithInterest(auctionBalance);
        operatorBalance = auctionBalance.mul(operatorFee).div(ONE_HUNDRED);
        auctionBalance = auctionBalance - operatorBalance;

        if (block.timestamp < auctionEndTimestamp) {
            termEndTimestamp = block.timestamp.add(termLength);
        } else {
            termEndTimestamp = auctionEndTimestamp.add(termLength);
        }

        emit AuctionSuccessful(
            address(this),
            borrowerDebt,
            auctionBalance,
            operatorBalance,
            getInterestRate(),
            lastFundedTimestamp
        );
        return true;
    }
}
