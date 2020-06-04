pragma solidity 0.5.12;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./interfaces/IDAIProxy.sol";
import "./interfaces/ILoanInstalments.sol";
import "./interfaces/ISwapAndDeposit.sol";
import "./interfaces/ISwapAndDepositFactory.sol";
import "./libs/ERC20Wrapper.sol";

contract LoanInstalments is ILoanInstalments {
    using SafeMath for uint256;
    address public swapFactory;
    address public proxyAddress;
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
    uint256 public instalments;
    uint256 public instalmentsPaid;

    uint256 constant MONTH_SECONDS = 2592000;
    uint256 constant ONE_HUNDRED = 100000000000000000000;

    struct Position {
        uint256 bidAmount;
        bool loanWithdrawn;
        uint256 instalmentsWithdrawed;
    }

    mapping(address => Position) public lenderPosition;

    enum LoanState {
        CREATED, // accepts bids until timelimit initial state
        FAILED_TO_FUND, // not fully funded in timelimit
        ACTIVE, // fully funded, inside timelimit
        DEFAULTED, // not repaid in time loanRepaymentLength
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
        address _originator,
        address _tokenAddress,
        address _proxyAddress,
        address _administrator,
        uint256 _operatorFee,
        uint256 _auctionLength,
        address _swapFactory,
        uint256 _instalments
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

    // Notes:
    // - This function does not track if real IERC20 balance has changed. Needs to blindly "trust" DaiProxy.
    function onFundingReceived(address lender, uint256 amount)
        external
        onlyCreated
        onlyProxy
        notTemplate
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

    function withdrawFundsUnlocked() external onlyFrozen notTemplate  {
        require(!loanWithdrawn, "Loan already withdrawn");
        require(!lenderPosition[msg.sender].loanWithdrawn, "Lender already withdrawn");
        require(lenderPosition[msg.sender].bidAmount > 0, "Account did not deposit");

        lenderPosition[msg.sender].loanWithdrawn = true;

        loanWithdrawnAmount = loanWithdrawnAmount.add(lenderPosition[msg.sender].bidAmount);

        if (loanWithdrawnAmount == auctionBalance.add(operatorBalance)) {
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

    function getWithdrawAmount(address lender, uint256 pendingInstalments)
        public
        view
        returns (uint256)
    {
        return
            lenderPosition[lender]
                .bidAmount
                .mul(100)
                .div(auctionBalance)
                .mul(getInstalmentAmount().mul(pendingInstalments))
                .div(100);
    }

    function withdrawRepayment() external onlyActive notTemplate {
        require(lenderPosition[msg.sender].bidAmount != 0, "Account did not deposited");
        require(!lenderPosition[msg.sender].loanWithdrawn, "Lender already withdrawn");
        require(
            lenderPosition[msg.sender].instalmentsWithdrawed < instalmentsPaid,
            "Lender already withdrawn this instalment"
        );
        uint256 pendingInstalments = instalmentsPaid -
            lenderPosition[msg.sender].instalmentsWithdrawed;
        uint256 amount = getWithdrawAmount(msg.sender, pendingInstalments);
        lenderPosition[msg.sender].instalmentsWithdrawed = instalmentsPaid;

        loanWithdrawnAmount = loanWithdrawnAmount.add(amount);

        // If lender withdraw all payments, then cant claim frozen funds
        if (lenderPosition[msg.sender].instalmentsWithdrawed == instalments) {
            lenderPosition[msg.sender].loanWithdrawn = true;
        }
        if (loanWithdrawnAmount == borrowerDebt) {
            setState(LoanState.CLOSED);
            emit FullyRefunded(address(this));
        }
        emit RepaymentWithdrawn(address(this), msg.sender, amount);
        require(ERC20Wrapper.transfer(tokenAddress, msg.sender, amount), "error while transfer");
    }

    function withdrawRepaymentAndDeposit() external onlyActive notTemplate {
        require(swapFactory != address(0), "swap factory is 0");
        require(lenderPosition[msg.sender].bidAmount != 0, "Account did not deposited");
        require(!lenderPosition[msg.sender].loanWithdrawn, "Lender already withdrawn");
        require(
            lenderPosition[msg.sender].instalmentsWithdrawed < instalmentsPaid,
            "Lender already withdrawn this instalment"
        );
        // calculate value with pending instalments from the user
        uint256 pendingInstalments = instalmentsPaid -
            lenderPosition[msg.sender].instalmentsWithdrawed;
        uint256 amount = getWithdrawAmount(msg.sender, pendingInstalments);
        loanWithdrawnAmount = loanWithdrawnAmount.add(amount);
        // If lender withdraw all payments, then cant claim frozen funds
        if (lenderPosition[msg.sender].instalmentsWithdrawed == instalments) {
            lenderPosition[msg.sender].loanWithdrawn = true;
        }
        address swapAddress = ISwapAndDepositFactory(swapFactory).deploy();
        require(swapAddress != address(0), "error swap deploy");
        if (loanWithdrawnAmount == borrowerDebt) {
            setState(LoanState.CLOSED);
            emit FullyRefunded(address(this));
        }
        ERC20Wrapper.approve(tokenAddress, swapAddress, amount);
        ISwapAndDeposit(swapAddress).swapAndDeposit(msg.sender, tokenAddress, amount);
        require(
            ISwapAndDeposit(swapAddress).isDestroyed(),
            "Swap contract error, should self-destruct"
        );
        emit RepaymentWithdrawn(address(this), msg.sender, amount);
    }

    function withdrawLoan() external onlyActive notTemplate {
        require(!loanWithdrawn, "Already withdrawn");
        loanWithdrawn = true;
        emit LoanFundsWithdrawn(address(this), originator, auctionBalance);
        require(
            ERC20Wrapper.transfer(tokenAddress, originator, auctionBalance),
            "error while transfer"
        );
    }

    function getInstalmentDebt() public view returns (uint256) {
        if (instalments == instalmentsPaid) {
            return 0;
        }
        uint256 pendingInstalments = instalments.sub(instalmentsPaid);

        return
            getInstalmentAmount().add(
                getInstalmentAmount().mul(getInstalmentPenalty()).mul(pendingInstalments.sub(1))
            );
    }

    function onRepaymentReceived(address from, uint256 amount)
        external
        onlyActive
        onlyProxy
        notTemplate
        returns (bool)
    {
        require(from == originator, "from address is not the originator");
        require(getCurrentInstalment().sub(instalmentsPaid) > 0, "no instalments to pay for now");
        require(amount == getInstalmentDebt(), "debt should be equal than sent amount");
        instalmentsPaid = getCurrentInstalment();
        if (instalmentsPaid == instalments) {
            emit LoanRepaid(address(this), block.timestamp);
        }

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
        } else if (currentState == LoanState.ACTIVE) {
            return
                (maxInterestRate.sub(minInterestRate))
                    .mul(lastFundedTimestamp.sub(auctionStartTimestamp))
                    .div(auctionEndTimestamp.sub(auctionStartTimestamp))
                    .add(minInterestRate);
        } else {
            return 0;
        }
    }

    function setState(LoanState state) notTemplate internal {
        currentState = state;
    }

    function setSuccessfulAuction() internal notTemplate onlyCreated returns (bool) {
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

    function getCurrentInstalment() public view returns (uint256) {
        uint256 currentInstalmentNumber = (block.timestamp.sub(auctionEndTimestamp)).mul(1000).div(
            getInstalmentLenght()
        );
        currentInstalmentNumber = ceil(currentInstalmentNumber, 1000).div(1000);
        if (currentInstalmentNumber > instalments) {
            return instalments;
        }
        return currentInstalmentNumber;
    }

    function getInstalmentAmount() public view returns (uint256) {
        uint256 instalmentLengthProportion = termEndTimestamp.sub(auctionEndTimestamp) /
            instalments /
            2592000;
        return
            auctionBalance.mul(
                uint256(1).div(instalments).add(getInterestRate().mul(instalmentLengthProportion))
            );
    }

    function getInstalmentPenalty() public view returns (uint256) {
        return auctionBalance.mul(getInterestRate().mul(2).div(instalments));
    }

    function ceil(uint256 a, uint256 m) internal pure returns (uint256) {
        return ((a.mul(m).sub(1)).div(m)).mul(m);
    }
}
