pragma solidity 0.5.12;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./interfaces/IDAIProxy.sol";
import "./interfaces/ILoanInstalments.sol";
import "./interfaces/ISwapAndDeposit.sol";
import "./interfaces/ISwapAndDepositFactory.sol";
import "./libs/MonkCalcs.sol";
import "./libs/ERC20Wrapper.sol";
import "@nomiclabs/buidler/console.sol";

contract LoanInstalments is ILoanInstalments {
    using SafeMath for uint256;

    address public swapFactory;
    address public proxyAddress;
    address public tokenAddress;
    address public originator;
    address public administrator;

    uint256 public minAmount;
    uint256 public investors;
    uint256 public totalWithdraws;
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
    uint256 public instalments;
    uint256 public instalmentsPaid;
    uint256 public penaltiesPaid;
    uint256 public loanAmountPaid;

    uint256 constant MONTH_SECONDS = 2592000;
    uint256 constant ONE_HUNDRED = 100 ether;

    struct Position {
        uint256 bidAmount;
        bool loanWithdrawn;
        uint256 instalmentsWithdrawed;
        uint256 penaltiesWithdrawed;
    }

    mapping(address => Position) public lenderPosition;

    enum LoanState {
        CREATED, // accepts bids until timelimit initial state
        FAILED_TO_FUND, // not fully funded in timelimit
        ACTIVE, // fully funded, inside timelimit
        DEFAULTED, // not repaid in time loanRepaymentLength
        REPAID, // All loan instalments paid
        CLOSED, // from failed_to_fund => last lender to withdraw triggers change / from repaid => fully witdrawn by lenders
        FROZEN // when admin unlocks withdrawals
    }

    LoanState public currentState;

    bool public loanWithdrawn;
    bool public minimumReached;
    bool private isTemplate;

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
    event DaiProxyAddressUpdated(
        address newDaiProxyAddress,
        address administrator,
        address loanDispatcher
    );

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

    modifier onlyActiveOrRepaid() {
        updateStateMachine();
        require(
            currentState == LoanState.ACTIVE || currentState == LoanState.REPAID,
            "Loan status is not ACTIVE or REPAID"
        );
        _;
    }

    modifier onlyFailedToFund() {
        updateStateMachine();
        require(currentState == LoanState.FAILED_TO_FUND, "Loan status is not FAILED_TO_FUND");
        _;
    }

    modifier onlyProxy() {
        require(msg.sender == address(proxyAddress), "Caller is not the proxy");
        _;
    }

    modifier onlyOriginator() {
        require(msg.sender == originator, "Caller is not the originator");
        _;
    }

    constructor() public {
        isTemplate = true;
    }

    function init(
        uint256 _termLength,
        uint256 _minAmount,
        uint256 _maxAmount,
        uint256 _minInterestRate,
        uint256 _maxInterestRate,
        uint256 _operatorFee,
        uint256 _auctionLength,
        uint256 _instalments,
        address _originator,
        address _tokenAddress,
        address _proxyAddress,
        address _administrator,
        address _swapFactory
    ) public notTemplate returns (bool) {
        require(tokenAddress == address(0), "loan have been initialized");
        tokenAddress = _tokenAddress;
        proxyAddress = _proxyAddress;
        originator = _originator;
        administrator = _administrator;
        swapFactory = _swapFactory;
        instalments = _instalments;

        minInterestRate = _minInterestRate;
        maxInterestRate = _maxInterestRate;
        minAmount = _minAmount;
        maxAmount = _maxAmount;

        auctionLength = _auctionLength;
        auctionStartTimestamp = block.timestamp;
        auctionEndTimestamp = auctionStartTimestamp.add(auctionLength);

        termLength = _termLength;

        termEndTimestamp = auctionEndTimestamp.add(termLength);

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

        return true;
    }

    function isTemplateContract() external view returns (bool) {
        return isTemplate;
    }

    modifier notTemplate() {
        require(isTemplate == false, "you cant call template contract");
        _;
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
        return lenderPosition[lender].loanWithdrawn;
    }

    function getLenderInstalmentsWithdrawed(address lender) external view returns (uint256) {
        return lenderPosition[lender].instalmentsWithdrawed;
    }

    function getTokenAddress() external view returns (address) {
        return tokenAddress;
    }

    function onFundingReceived(address lender, uint256 amount)
        external
        onlyCreated
        onlyProxy
        notTemplate
        returns (bool)
    {
        require(block.timestamp > auctionStartTimestamp, "can not invest prior the start");
        require(amount > 0, "amount must be greater than 0");
        require(!isAuctionExpired(), "auction is expired, lenders can withdrawRefund");

        require(
            ERC20Wrapper.transferFrom(tokenAddress, msg.sender, address(this), amount),
            "failed to transfer"
        );

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
        if (lenderPosition[lender].bidAmount == 0) {
            investors += 1;
        }
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

    function unlockFundsWithdrawal() external onlyAdmin notTemplate {
        setState(LoanState.FROZEN);
        emit LoanFundsUnlocked(auctionBalance);
    }

    function withdrawFees() external onlyAdmin notTemplate returns (bool) {
        require(loanWithdrawn == true, "borrower didnt withdraw");
        require(operatorBalance > 0, "no funds to withdraw");
        uint256 allFees = operatorBalance;
        operatorBalance = 0;
        require(ERC20Wrapper.transfer(tokenAddress, msg.sender, allFees), "transfer failed");
        emit OperatorWithdrawn(allFees, msg.sender);
        return true;
    }

    function withdrawFundsUnlocked() external onlyFrozen notTemplate {
        require(!loanWithdrawn, "Loan already withdrawn");
        require(!lenderPosition[msg.sender].loanWithdrawn, "Lender already withdrawn");
        require(lenderPosition[msg.sender].bidAmount > 0, "Account did not deposit");

        lenderPosition[msg.sender].loanWithdrawn = true;

        loanWithdrawnAmount = loanWithdrawnAmount.add(lenderPosition[msg.sender].bidAmount);

        if (loanWithdrawnAmount == auctionBalance) {
            setState(LoanState.CLOSED);
            emit FullyFundsUnlockedWithdrawn(address(this));
        }

        require(
            ERC20Wrapper.transfer(tokenAddress, msg.sender, lenderPosition[msg.sender].bidAmount),
            "error while transfer"
        );

        emit FundsUnlockedWithdrawn(
            address(this),
            msg.sender,
            lenderPosition[msg.sender].bidAmount
        );
    }

    function withdrawRefund() external onlyFailedToFund notTemplate {
        require(!lenderPosition[msg.sender].loanWithdrawn, "Lender already withdrawn");
        require(lenderPosition[msg.sender].bidAmount > 0, "Account did not deposited.");

        lenderPosition[msg.sender].loanWithdrawn = true;

        loanWithdrawnAmount = loanWithdrawnAmount.add(lenderPosition[msg.sender].bidAmount);

        emit RefundWithdrawn(address(this), msg.sender, lenderPosition[msg.sender].bidAmount);

        if (loanWithdrawnAmount == auctionBalance) {
            setState(LoanState.CLOSED);
            emit FullyRefunded(address(this));
        }

        require(
            ERC20Wrapper.transfer(tokenAddress, msg.sender, lenderPosition[msg.sender].bidAmount),
            "error while transfer"
        );
    }

    function getWithdrawAmount(address lender) public view returns (uint256) {
        uint256 _instalmentAmount;
        uint256 _penaltyAmount;
        uint256 pendingInstalments = instalmentsPaid -
            lenderPosition[msg.sender].instalmentsWithdrawed;
        uint256 pendingPenalties = penaltiesPaid - lenderPosition[msg.sender].penaltiesWithdrawed;
        if (getInstalmentAmount().mul(instalmentsPaid) > 0) {
            _instalmentAmount =
                lenderPosition[lender].bidAmount.mul(getInstalmentAmount()).mul(
                    pendingInstalments
                ) /
                auctionBalance;
        }
        if (getInstalmentPenalty().mul(penaltiesPaid) > 0) {
            _penaltyAmount =
                lenderPosition[lender].bidAmount.mul(getInstalmentPenalty()).mul(pendingPenalties) /
                auctionBalance;
        }
        return _instalmentAmount.add(_penaltyAmount);
    }

    function withdrawRepayment() external onlyActiveOrRepaid notTemplate {
        uint256 amount = priorLenderWithdrawal();
        emit RepaymentWithdrawn(address(this), msg.sender, amount);
        require(ERC20Wrapper.transfer(tokenAddress, msg.sender, amount), "error while transfer");
    }

    function withdrawRepaymentAndDeposit() external onlyActiveOrRepaid notTemplate {
        require(swapFactory != address(0), "swap factory is 0");
        address swapAddress = ISwapAndDepositFactory(swapFactory).deploy();
        require(swapAddress != address(0), "error swap deploy");

        uint256 amount = priorLenderWithdrawal();
        ERC20Wrapper.approve(tokenAddress, swapAddress, amount);
        ISwapAndDeposit(swapAddress).swapAndDeposit(msg.sender, tokenAddress, amount);
        require(
            ISwapAndDeposit(swapAddress).isDestroyed(),
            "Swap contract error, should self-destruct"
        );
        emit RepaymentWithdrawn(address(this), msg.sender, amount);
    }

    function priorLenderWithdrawal() internal onlyActiveOrRepaid notTemplate returns (uint256) {
        require(lenderPosition[msg.sender].bidAmount != 0, "Account did not deposited");
        require(!lenderPosition[msg.sender].loanWithdrawn, "Lender already withdrawn");
        require(
            lenderPosition[msg.sender].instalmentsWithdrawed < instalmentsPaid,
            "Lender already withdrawn this instalment"
        );
        require(totalWithdraws < investors, "can not withdraw more");
        // calculate value with pending instalments from the user
        uint256 amount = getWithdrawAmount(msg.sender);
        lenderPosition[msg.sender].instalmentsWithdrawed = instalmentsPaid;
        lenderPosition[msg.sender].penaltiesWithdrawed = penaltiesPaid;

        loanWithdrawnAmount = loanWithdrawnAmount.add(amount);

        // If lender withdraw all payments, then cant claim frozen funds
        if (lenderPosition[msg.sender].instalmentsWithdrawed == instalments) {
            lenderPosition[msg.sender].loanWithdrawn = true;
            totalWithdraws = totalWithdraws.add(1);
        }
        if (totalWithdraws == investors.mul(instalments)) {
            setState(LoanState.CLOSED);
            if (borrowerDebt > loanWithdrawnAmount) {
                ERC20Wrapper.transfer(
                    tokenAddress,
                    administrator,
                    borrowerDebt.sub(loanWithdrawnAmount)
                );
            }
            emit FullyRefunded(address(this));
        }
        return amount;
    }

    function withdrawLoan() external onlyActive notTemplate {
        require(!loanWithdrawn, "Already withdrawn");
        loanWithdrawn = true;
        emit LoanFundsWithdrawn(address(this), originator, auctionBalance.sub(operatorBalance));
        require(
            ERC20Wrapper.transfer(tokenAddress, originator, auctionBalance.sub(operatorBalance)),
            "error while transfer"
        );
    }

    function getInstalmentDebt() public view returns (uint256) {
        uint256 remainder = 0;
        uint256 penaltyInstalments = 0;
        // Return 0 debt if all instalments are paid, or if current instalment is paid
        if (instalments == instalmentsPaid || getCurrentInstalment() == instalmentsPaid) {
            return 0;
        }
        // Handle integer division remainder in the latest payment
        if (getCurrentInstalment() == instalments) {
            remainder = borrowerDebt.sub(getInstalmentAmount().mul(instalments));
        }
        if (getCurrentInstalment() > instalmentsPaid.add(1)) {
            penaltyInstalments = getCurrentInstalment().sub(instalmentsPaid).sub(1);
        }
        return
            getInstalmentAmount()
                .mul(getCurrentInstalment().sub(instalmentsPaid))
                .add(getInstalmentPenalty().mul(penaltyInstalments))
                .add(remainder);
    }

    function getTotalDebt() public view returns (uint256) {
        if (instalments == instalmentsPaid) {
            return 0;
        }

        uint256 totalDebt = getInstalmentAmount().mul(instalments.sub(instalmentsPaid)).add(
            borrowerDebt.sub(getInstalmentAmount().mul(instalments))
        );
        if (getCurrentInstalment() > instalmentsPaid.add(1)) {
            totalDebt = totalDebt.add(
                getInstalmentPenalty().mul(getCurrentInstalment().sub(instalmentsPaid).sub(1))
            );
        }
        return totalDebt;
    }

    function onRepaymentReceived(address from, uint256 amount)
        external
        onlyActive
        onlyProxy
        notTemplate
        returns (bool)
    {
        require(amount > 0, "amount can not be zero");
        require(loanAmountPaid < borrowerDebt, "debt is paid");
        require(instalmentsPaid < instalments, "instalments paid");
        require(from == originator, "from address is not the originator");

        if (getCurrentInstalment() > instalmentsPaid.add(1)) {
            borrowerDebt = borrowerDebt.add(
                getInstalmentPenalty().mul(getCurrentInstalment().sub(instalmentsPaid).sub(1))
            );
            penaltiesPaid = penaltiesPaid.add(getCurrentInstalment().sub(instalmentsPaid).sub(1));
        }

        if (amount == getInstalmentDebt()) {
            instalmentsPaid = getCurrentInstalment();
        } else if (amount == getTotalDebt()) {
            instalmentsPaid = instalments;
        } else {
            revert("amount to be eq than getInstalmentDebt or getTotalDebt");
        }

        loanAmountPaid = loanAmountPaid.add(amount);

        if (instalmentsPaid == instalments) {
            setState(LoanState.REPAID);
            emit LoanRepaid(address(this), block.timestamp);
        }

        return true;
    }

    function isAuctionExpired() public view returns (bool) {
        return block.timestamp > auctionEndTimestamp;
    }

    function isDefaulted() public view returns (bool) {
        if (
            block.timestamp <= auctionEndTimestamp ||
            block.timestamp <= termEndTimestamp.add(getInstalmentLenght())
        ) {
            return false;
        }

        return true;
    }

    function updateStateMachine() public notTemplate returns (LoanState) {
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
            value.div(instalments).mul(instalments).add(
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
        } else if (
            currentState == LoanState.ACTIVE ||
            currentState == LoanState.REPAID ||
            currentState == LoanState.CLOSED
        ) {
            return
                (maxInterestRate.sub(minInterestRate))
                    .mul(lastFundedTimestamp.sub(auctionStartTimestamp))
                    .div(auctionEndTimestamp.sub(auctionStartTimestamp))
                    .add(minInterestRate);
        } else {
            return 0;
        }
    }

    function setState(LoanState state) internal notTemplate {
        currentState = state;
    }

    function setSuccessfulAuction() internal notTemplate onlyCreated returns (bool) {
        setState(LoanState.ACTIVE);
        borrowerDebt = calculateValueWithInterest(auctionBalance);
        operatorBalance = auctionBalance.mul(operatorFee).div(ONE_HUNDRED);

        if (block.timestamp < auctionEndTimestamp) {
            termEndTimestamp = block.timestamp.add(termLength);
        }

        auctionEndTimestamp = block.timestamp;

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

    function setProxyAddress(address _proxyAddress) external onlyAdmin notTemplate {
        proxyAddress = _proxyAddress;
        emit DaiProxyAddressUpdated(_proxyAddress, administrator, address(this));
    }

    /*
     * Formula to calculate in which instalment is the loan in this point in time:
     * First we need to calculate the length of every instalment.
     * then we calculate the amount of thime passed between the start of the term and the
     * current point in time we devide it by the length of the instalment, and we add 1
     * because the instalment end time is also included in the instalment
     */

    function getInstalmentLenght() public view returns (uint256) {
        return (termEndTimestamp.sub(auctionEndTimestamp)).div(instalments);
    }

    function getNextInstalmentDate() public view returns (uint256) {
        return auctionEndTimestamp.add((getCurrentInstalment().add(1)).mul(getInstalmentLenght()));
    }

    function getCurrentInstalment() public view returns (uint256) {
        uint256 timeSinceLoan = block.timestamp.sub(auctionEndTimestamp);
        if (timeSinceLoan < getInstalmentLenght()) {
            return 0;
        }
        uint256 currentInstalmentNumber = timeSinceLoan.div(getInstalmentLenght());
        if (currentInstalmentNumber <= 0) {
            return 0;
        }
        if (currentInstalmentNumber > instalments) {
            return instalments;
        }
        return currentInstalmentNumber;
    }

    function getInstalmentAmount() public view returns (uint256) {
        console.log("i amount", borrowerDebt.div(instalments));
        console.log("mul again", borrowerDebt.div(instalments) * instalments);
        console.log("debt", borrowerDebt);
        return borrowerDebt.div(instalments);
    }

    function getInstalmentPenalty() public view returns (uint256) {
        return
            auctionBalance.mul(getInterestRate().mul(2).mul(termLength).div(MONTH_SECONDS)).div(
                ONE_HUNDRED
            );
    }
}
