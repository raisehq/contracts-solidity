pragma solidity ^0.5.0;

import 'openzeppelin-solidity/contracts/token/ERC20/ERC20.sol';
import './DAIProxy.sol';
import './LoanContractDispatcher.sol';

contract LoanContract {
    ERC20 DAIToken;
    DAIProxy proxy;
    LoanContractDispatcher dispatcher;
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
    enum LoanPhase {Active, Finished, Repaid, Failed}

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
    event LoanRepaid(uint256 timeAtRepaid);

    modifier onlyActive() {
        require(currentPhase == LoanPhase.Active, "Incorrect loan status");
        _;
    }

    modifier onlyRepaidOrFailed() {
        require(
            currentPhase == LoanPhase.Repaid || currentPhase == LoanPhase.Failed,
            "Incorrect loan status"
        );
        _;
    }

    modifier onlyFinished() {
        require(currentPhase == LoanPhase.Finished, "Incorrect loan status");
        _;
    }

    modifier onlyFinishedOrFailed() {
        require(
            currentPhase == LoanPhase.Finished || currentPhase == LoanPhase.Failed,
            "Incorrect loan status"
        );
        _;
    }

    modifier onlyProxy() {
        require(msg.sender == address(proxy), "Caller is not the proxy");
        _;
    }

    constructor(
        uint256 lengthBlocks,
        uint256 amount,
        uint256 _bpMaxInterestRate,
        uint256 _termLength,
        uint256 _gracePeriodLength,
        address _originator,
        address creator,
        address DAITokenAddress,
        address proxyAddress
    )
    public
    {
        originator = _originator;
        totalAmount = amount;
        blockStart = block.number;
        blockEnd = blockStart + lengthBlocks;
        bpMaxInterestRate = _bpMaxInterestRate;
        alreadyWithdrawn = false;
        termLength = _termLength;
        gracePeriodLength = _gracePeriodLength;

        dispatcher = LoanContractDispatcher(creator);
        DAIToken = ERC20(DAITokenAddress);
        proxy = DAIProxy(proxyAddress);
    }

    function onFundingReceived(address lender, uint256 amount) public onlyActive onlyProxy {

        if (block.number > blockEnd) {
            setPhase(LoanPhase.Failed);
            emit LoanFailed();
            return;
        }

        lenderAmount[lender] += amount;
        alreadyFunded += amount;
        uint256 diff = (alreadyFunded - totalAmount);

        if (diff > 0) {
            DAIToken.transfer(lender, diff);
            alreadyFunded -= diff;
            emit LoanFunded(lender, diff);
        }

        if (alreadyFunded == totalAmount) {
            setPhase(LoanPhase.Finished);
            blockFunded = block.number;
            timestampFunded = now;
            emit LoanFullyFunded(timestampFunded);
        }
    }

    function withdrawRepayment(address to) public onlyRepaidOrFailed {
        require(lenderAmount[msg.sender] != 0, "Not a lender or already withdrawn");
        uint256 amount = calculateValueWithInterest(lenderAmount[msg.sender]);
        DAIToken.transfer(to, amount);
        lenderAmount[msg.sender] = 0;
    }

    function withdrawLoan(address to) public onlyFinished onlyProxy returns (uint256) {
        require(!alreadyWithdrawn, "Already withdrawn");
        DAIToken.transfer(to, totalAmount);
        alreadyWithdrawn = true;
        emit LoanWithdrawn(to, totalAmount);
    }

    function onRepaymentReceived(
        address from,
        uint256 amount
        )
        public
        onlyFinished
        onlyProxy
        returns (uint256)
        {
            require(originator == from, "Not from originator");
            require(
                amount == calculateValueWithInterest(totalAmount),
                "Incorrect sum repaid"
            );
            require(
                getRepaymentStatus() != 6,
                "Loan is already defaulted"
            );
            setPhase(LoanPhase.Repaid);
            emit LoanRepaid(now);
        } // only one public

    function setPhase(LoanPhase phase) internal {
        currentPhase = phase;
    }

    function getInterestRate() public view returns (uint256) {
        if (currentPhase == LoanPhase.Active) {
            return bpMaxInterestRate * (block.number - blockStart) / (blockEnd - blockStart);
        } else if (currentPhase == LoanPhase.Finished || currentPhase == LoanPhase.Repaid) {
            return bpMaxInterestRate * (blockFunded - blockStart) / (blockEnd - blockStart);
        } else {
            return 0;
        }
    }
    // 1 - repaid
    // 2 - non-funded
    // 3 - failed
    // 4 - not-repaid
    // 5 - grace
    // 6 - default
    function getRepaymentStatus() public view returns (uint256) {

        if (currentPhase == LoanPhase.Repaid) {
            return 1;
        }
        if (currentPhase == LoanPhase.Active) {
            return 2;
        }
        if (currentPhase == LoanPhase.Failed) {
            return 3;
        }

        if (now >= timestampFunded  && now <= timestampFunded + termLength) {
            return 4;
        } else if (
            now >= timestampFunded + termLength &&
            now <= timestampFunded + termLength + gracePeriodLength
        )
        {
            return 5;
        } else {
            return 6;
        }
    }

    function calculateValueWithInterest(uint256 value) public view returns(uint256) {
        return value + (value * getInterestRate() / 10000);
    }

    function getLenderWithdrawnAmount(address lender) public view returns (uint256) {
        return (currentPhase == LoanPhase.Repaid)
            ? calculateValueWithInterest(lenderAmount[lender]) : 0;
    }
}