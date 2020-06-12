const chai = require("chai");
const bnChai = require("bn-chai");
const web3 = global.web3;
const {toWei, fromWei, BN} = web3.utils;
const chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
chai.use(bnChai(BN));
const {expect} = chai;
const truffleAssert = require("truffle-assertions");

const DAIProxyContract = artifacts.require("DAIProxyMock");
const DAITokenContract = artifacts.require("DAIFake");
const LoanInstalments = artifacts.require("LoanInstalments");
const SwapAndDepositContract = artifacts.require("SwapAndDeposit");
const SwapFactoryContract = artifacts.require("SwapAndDepositFactory");
const RaiseTokenContract = artifacts.require("RaiseFake");
const KYCContract = artifacts.require("KYCRegistry");
const AuthContract = artifacts.require("Authorization");
const DepositRegistryContract = artifacts.require("DepositRegistry");
const ERC20WrapperContract = artifacts.require("ERC20Wrapper");
const LoanInstalmentsCloner = artifacts.require("LoanInstalmentsCloner");
const {initializeUniswap} = require("./uniswap.utils");
const helpers = require("./helpers.js");
const {revertToSnapShot, takeSnapshot} = helpers;
const DAI_COST_200_RAISE = new BN("4596059099803939333");

describe.only("LoanInstalments", () => {
  let accounts = [];
  let owner, lender, borrower, admin, bob, otherLender;
  // evm snapshot to revert all state per test
  let startSnapshot;
  let uniswapAddress;
  let DAIProxy;
  let DAIToken;
  let RaiseToken;
  let Loan;
  let Auth;
  let SwapFactory;
  let loanAddress;
  let loanCloner;
  let loanAmount;
  let minInterestRate;
  let maxInterestRate;
  let auctionLength;
  let termLength;
  let currentBlock;
  let DepositRegistry;
  let loanTemplateAddress;
  const operatorPercentFee = toWei(new BN(2));
  const averageMiningBlockTime = 15;

  const initialBalance = toWei("1000000000000");

  const deployDependencies = async () => {
    ERC20Wrapper = await ERC20WrapperContract.new();
    await LoanInstalments.link(ERC20Wrapper);

    DAIToken = await DAITokenContract.new({from: owner});
    await DAIToken.transferAmountToAddress(otherLender, initialBalance, {from: owner});
    await DAIToken.transferAmountToAddress(lender, initialBalance, {from: owner});
    await DAIToken.transferAmountToAddress(borrower, initialBalance, {from: owner});
    await DAIToken.transferAmountToAddress(bob, 1, {from: owner});
    RaiseToken = await RaiseTokenContract.new({from: owner});

    DAIProxy = await DAIProxyContract.new(DAIToken.address, {from: owner});

    currentBlock = await web3.eth.getBlock("latest");

    uniswapAddress = await initializeUniswap(web3, DAIToken.address, RaiseToken.address, owner);

    // adding borrower and lender to KYC
    const KYCRegistry = await KYCContract.new();
    await KYCRegistry.setAdministrator(admin);
    await KYCRegistry.addAddressToKYC(borrower, {from: admin});
    await KYCRegistry.addAddressToKYC(lender, {from: admin});
    await KYCRegistry.addAddressToKYC(otherLender, {from: admin});

    DepositRegistry = await DepositRegistryContract.new(RaiseToken.address, KYCRegistry.address, {
      from: owner
    });

    Auth = await AuthContract.new(KYCRegistry.address, DepositRegistry.address);
    const depositAddress = await Auth.getDepositAddress();

    const SwapAndDepositTemplate = await SwapAndDepositContract.new({from: owner});

    SwapFactory = await SwapFactoryContract.new(
      SwapAndDepositTemplate.address,
      Auth.address,
      uniswapAddress,
      {
        from: owner
      }
    );

    const loanTemplate = await LoanInstalments.new({gas: 10000000});
    loanTemplateAddress = loanTemplate.address;
  };

  const deployLoan = async (
    minAmount,
    maxAmount,
    minInterestRate,
    maxInterestRate,
    termLength,
    auctionLength,
    tokenAddress,
    instalments
  ) => {
    const {
      logs: [
        {
          args: {contractAddress: loanContractAddress}
        }
      ]
    } = await loanCloner.deploy(
      minAmount,
      maxAmount,
      minInterestRate,
      maxInterestRate,
      termLength,
      auctionLength,
      tokenAddress,
      instalments,
      {from: borrower}
    );
    return loanContractAddress;
  };

  before(async function() {
    accounts = await web3.eth.getAccounts();
    owner = accounts[0];
    lender = accounts[1];
    borrower = accounts[2];
    admin = accounts[3];
    bob = accounts[4];
    otherLender = accounts[5];

    await deployDependencies();

    startSnapshot = await takeSnapshot();
  });

  // Deploy contracts related with this test where their params can be mocked
  const onBeforeEach = async () => {
    loanCloner = await LoanInstalmentsCloner.new(
      Auth.address,
      DAIProxy.address,
      SwapFactory.address,
      loanTemplateAddress,
      {
        from: owner
      }
    );

    await loanCloner.setAdministrator(admin, {from: owner});

    loanAddress = await deployLoan(
      minAmount,
      maxAmount,
      minInterestRate,
      maxInterestRate,
      termLength,
      auctionLength,
      DAIToken.address,
      "12"
    );
    Loan = await LoanInstalments.at(loanAddress);
  };

  beforeEach(async () => {
    await revertToSnapShot(startSnapshot);

    // Set default Loan variables
    minAmount = new BN(80);
    maxAmount = new BN(100);
    minInterestRate = new BN("100000000000000000");
    maxInterestRate = new BN("100000000000000000");
    auctionLength = 60 * 60; // 1 hour in seconds
    termLength = 2 * 60 * 60; // 2 hours in seconds

    await onBeforeEach();
  });

  describe("Unit tests for LoanInstalments", () => {
    describe("Method onFundingReceived", () => {
      it("Expect onFundingReceived to revert if caller is NOT DaiProxy", async () => {
        // LoanInstalments state should start with CREATED == 0
        const firstState = await Loan.currentState();
        expect(Number(firstState)).to.equal(0);
        await truffleAssert.fails(
          Loan.onFundingReceived(lender, 100),
          truffleAssert.ErrorType.REVERT,
          "Caller is not the proxy"
        );
      });
      it("Expects Lender to be able to partially fund a Loan in CREATED state.", async () => {
        try {
          // LoanInstalments state should start with CREATED == 0
          const firstState = await Loan.currentState();
          expect(Number(firstState)).to.equal(0);

          await DAIToken.approve(DAIProxy.address, 50, {from: lender});
          await DAIProxy.fund(Loan.address, 50, {from: lender});

          // Loan state after funding
          const loanState = await Loan.currentState();
          // Subscribe to events
          const auctionBalanceAmount = await Loan.auctionBalance({from: owner});
          const fundedByLender = await Loan.getLenderBidAmount(lender, {from: owner});

          expect(Number(fundedByLender)).to.equal(50);
          expect(Number(auctionBalanceAmount)).to.equal(50);

          // LoanInstalments state should still be CREATED == 0, due is partially funded
          expect(Number(loanState)).to.equal(0);
        } catch (error) {
          throw error;
        }
      });
      it("Expects Lender to be able to fully fund a Loan and mutate from CREATED to ACTIVE state.", async () => {
        try {
          // LoanInstalments state should start with CREATED == 0
          const firstState = await Loan.currentState();
          expect(Number(firstState)).to.equal(0);
          const fundAmount = new BN(100);
          await DAIToken.approve(DAIProxy.address, fundAmount, {from: lender});
          await DAIProxy.fund(Loan.address, fundAmount, {from: lender});

          // Loan state after funding
          const loanState = await Loan.currentState();
          // Subscribe to events
          const auctionBalanceAmount = await Loan.auctionBalance({from: owner});

          const fundedByLender = await Loan.getLenderBidAmount(lender, {from: owner});

          expect(fundedByLender).to.eq.BN(fundAmount);
          expect(auctionBalanceAmount).to.eq.BN(fundedByLender);

          // LoanInstalments state should mutate to ACTIVE == 2
          expect(Number(loanState)).to.equal(2);
        } catch (error) {
          throw error;
        }
      });
      it("Expects Lender to be able to send bigger funds to Loan, only loan amunt needed, and mutate from CREATED to ACTIVE state", async () => {
        try {
          // LoanInstalments state should start with CREATED == 0
          const firstState = await Loan.currentState();
          expect(firstState).to.eq.BN(0);
          const fundAmount = new BN(150);
          const balance = await DAIToken.balanceOf(lender);
          await DAIToken.approve(DAIProxy.address, fundAmount, {from: lender});
          await DAIProxy.fund(Loan.address, fundAmount, {from: lender});

          const lenderAfterBalance = await DAIToken.balanceOf(lender);

          // Loan state after funding
          const loanState = await Loan.currentState();

          // Subscribe to events
          const auctionBalanceAmount = await Loan.auctionBalance({from: owner});
          const fundedByLender = await Loan.getLenderBidAmount(lender, {from: owner});

          expect(fundedByLender).to.eq.BN(maxAmount);
          expect(auctionBalanceAmount).to.eq.BN(maxAmount);
          expect(lenderAfterBalance).to.eq.BN(balance.sub(maxAmount));

          // LoanInstalments state should mutate to ACTIVE == 2
          expect(loanState).to.eq.BN(2);
        } catch (error) {
          console.log("the error is:: ", error);
          throw error;
        }
      });
      it("Expects Lender to NOT be able to fund after state is ACTIVE", async () => {
        try {
          const fundAmount = new BN(100);
          const lenderPriorBalance = await DAIToken.balanceOf(lender);

          // LoanInstalments state should start with CREATED == 0
          const firstState = await Loan.currentState();
          expect(Number(firstState)).to.equal(0);

          // First, lender fully fund the Loan.
          await DAIToken.approve(DAIProxy.address, fundAmount, {from: lender});
          await DAIProxy.fund(Loan.address, fundAmount, {from: lender});

          // LoanInstalments state  after fully funded should be  ACTIVE == 2
          const secondState = await Loan.currentState();
          expect(secondState).to.eq.BN(2);
          const extraAmount = new BN(50);
          // After is ACTIVE and fully funded, should not allow fund again the Loan.
          await DAIToken.approve(DAIProxy.address, extraAmount, {from: lender});
          await truffleAssert.fails(
            DAIProxy.fund(Loan.address, extraAmount, {from: lender}),
            truffleAssert.ErrorType.REVERT,
            "Loan status is not CREATED"
          );

          // Loan state after funding
          const loanState = await Loan.currentState();

          // LoanInstalments state should STILL be ACTIVE == 2
          expect(loanState).to.eq.BN(2);

          // Lender should still have 50 bucks

          const lenderAfterBalance = await DAIToken.balanceOf(lender);
          // Subscribe to events
          const auctionBalanceAmount = await Loan.auctionBalance({from: owner});
          const fundedByLender = await Loan.getLenderBidAmount(lender, {from: owner});

          // Check balances
          expect(fundedByLender).to.eq.BN(100);
          expect(auctionBalanceAmount).to.eq.BN(100);
          expect(lenderAfterBalance).to.eq.BN(lenderPriorBalance.sub(fundAmount));
        } catch (error) {
          console.log("the error is:: ", error);
          throw error;
        }
      });
      it("Expects lender to NOT fund Loan if expires in time, mutating from CREATED to FAILED_TO_FUND", async () => {
        try {
          // Contract init state should be CREATED
          const balancePriorState = await DAIToken.balanceOf(lender);
          const initState = await Loan.currentState();
          expect(Number(initState)).to.equal(0);

          // Mine to end of funding
          await helpers.increaseTime(auctionLength + 10);

          /**
           * Contract state should still be CREATED, due Lender did not try
           * to fund or 3º party did not exec updateMachineState method
           */
          const stateAfterDeadline = await Loan.currentState();
          expect(Number(stateAfterDeadline)).to.equal(0);

          // Try to fund the Loan
          await DAIToken.approve(DAIProxy.address, 100, {from: lender});
          await DAIProxy.fund(Loan.address, 100, {from: lender});

          // Check Loan funds inside contract, should be ZERO
          const auctionBalanceAmount = await Loan.auctionBalance({from: owner});
          const loanRawTokens = await DAIToken.balanceOf(Loan.address, {from: owner});
          expect(Number(auctionBalanceAmount)).to.equal(0);
          expect(Number(loanRawTokens)).to.equal(0);

          // Contract state should be mutated to FAILED_TO_FUND
          const stateAfterFailedFund = await Loan.currentState();
          expect(Number(stateAfterFailedFund)).to.equal(1);

          // Lender ERC20 balance should still be initial balance
          const lenderBalance = await DAIToken.balanceOf(lender, {from: lender});
          expect(lenderBalance).to.eq.BN(balancePriorState);
        } catch (error) {
          console.log("the error is:: ", error);
          throw error;
        }
      });
    });
    describe("Method borrower debt calculation", () => {
      beforeEach(async () => {
        try {
          // Set Loan variables
          maxAmount = new BN(toWei("1000"));
          minInterestRate = new BN(toWei("10"));
          maxInterestRate = new BN(toWei("10"));
          auctionLength = 60 * 60; // 1 hour in seconds
          termLength = 1 * 30 * 24 * 60 * 60; // 1 month in seconds

          await onBeforeEach();
        } catch (error) {
          throw error;
        }
      });
      it("Expects borrower debt to equal MIR * Term month length", async () => {
        const fundAmount = maxAmount;
        // LoanInstalments state should start with CREATED == 0
        const firstState = await Loan.currentState();
        expect(Number(firstState)).to.equal(0);

        // First, lender fully fund the Loan.
        await DAIToken.approve(DAIProxy.address, fundAmount, {from: lender});
        await DAIProxy.fund(Loan.address, fundAmount, {from: lender});

        // LoanInstalments state  after fully funded should be  ACTIVE == 2
        const secondState = await Loan.currentState();

        expect(secondState).to.eq.BN(2);

        const borrowerDebt = await Loan.borrowerDebt({from: owner});
        const contractInterest = await Loan.getInterestRate();
        const totalInterest = contractInterest.mul(new BN(termLength)).div(new BN(2592000));
        const desiredBorrowerDebt = fundAmount.add(
          fundAmount.mul(totalInterest).div(new BN(toWei("100")))
        );

        // Check loan interest
        expect(borrowerDebt).to.eq.BN(desiredBorrowerDebt);
      });
    });
    describe("Method getUpdateState", () => {
      it("Expects updateMachineState method to mutate Loan state from CREATED to FAILED_TO_FUND,  if funding is time expired ", async () => {
        try {
          // Contract init state should be CREATED
          const initState = await Loan.currentState();
          expect(Number(initState)).to.equal(0);

          // Mine to end of funding
          await helpers.increaseTime(auctionLength + 10);

          // Contract state should still be CREATED, 3º party did not exec updateMachineState method
          const stateAfterDeadline = await Loan.currentState();
          expect(Number(stateAfterDeadline)).to.equal(0);

          // Correct the state via updateMachineState
          await Loan.updateStateMachine();

          // Contract state should mutate to FAILED_TO_FUND
          // after executing state check (need to send)
          const newState = await Loan.currentState({from: owner});
          expect(Number(newState)).to.equal(1);
        } catch (error) {
          console.log("the error is:: ", error);
          throw error;
        }
      });
      it("Expects updateMachineState method to NOT mutate Loan state if state is CREATED and is not expired", async () => {
        try {
          // Contract init state should be CREATED
          const initState = await Loan.currentState();
          expect(Number(initState)).to.equal(0);

          // Check the state via updateMachineState
          await Loan.updateStateMachine();

          // Contract state should still be CREATED
          // after executing state check (need to send)
          const stateAfterMethod = await Loan.currentState({from: owner});
          expect(Number(stateAfterMethod)).to.equal(0);
        } catch (error) {
          console.log("the error is:: ", error);
          throw error;
        }
      });
      it("Expects updateMachineState method to NOT mutate from FAILED_TO_FUND state", async () => {
        try {
          // Mine to end of funding
          await helpers.increaseTime(auctionLength + 10);
          // Mutate the state to FAILED_TO_FUND via updateMachineState
          const state = await Loan.updateStateMachine.sendTransaction({from: owner});

          // Expect contract state to be FAILED_TO_FUND
          const stateAfterMethod = await Loan.currentState({from: owner});
          expect(stateAfterMethod).to.eq.BN(1);

          // Try to mutate again the state to FAILED_TO_FUND via updateMachineState
          await Loan.updateStateMachine({from: owner});

          const endState = await Loan.currentState({from: owner});
          expect(endState).to.eq.BN(1);
        } catch (error) {
          console.log("the error is:: ", error);
          throw error;
        }
      });
      it("Expects updateMachineState method to NOT mutate from ACTIVE state if not defaulted", async () => {
        try {
          await DAIToken.approve(DAIProxy.address, maxAmount, {from: lender});
          await DAIProxy.fund(Loan.address, maxAmount, {from: lender});

          // Retrieve current state == ACTIVE
          const stateAfterFund = await Loan.currentState({from: owner});
          expect(Number(stateAfterFund)).to.equal(2);

          // Try to mutate state when NOT defaulted
          await Loan.updateStateMachine({from: owner});

          // State should still be ACTIVE
          const endState = await Loan.currentState({from: owner});
          expect(Number(endState)).to.equal(2);
        } catch (error) {
          console.log("the error is:: ", error);
          throw error;
        }
      });
      it("Expects updateMachineState method to mutate from ACTIVE to DEFAULTED if repay expires", async () => {
        try {
          await DAIToken.approve(DAIProxy.address, maxAmount, {from: lender});
          await DAIProxy.fund(Loan.address, maxAmount, {from: lender});

          // Retrieve current state == ACTIVE
          const stateAfterFund = await Loan.currentState({from: owner});
          expect(Number(stateAfterFund)).to.equal(2);

          const repayEndTimestamp = await Loan.termEndTimestamp();
          const currentBlock = await web3.eth.getBlock("latest");
          const secondsToEnd = Number(repayEndTimestamp) - Number(currentBlock.timestamp) + 1;

          // If repayEndTimestamp is zero, Loan should not be in ACTIVE state
          expect(Number(repayEndTimestamp)).greaterThan(0);
          expect(Number(secondsToEnd)).greaterThan(0);

          await helpers.increaseTime(secondsToEnd);

          // Try to mutate again the state after IS defaulted
          await Loan.updateStateMachine({from: owner});

          // State should mutate from ACTIVE to DEFAULTED
          const endState = await Loan.currentState({from: owner});
          expect(Number(endState)).to.equal(3);
        } catch (error) {
          console.log("the error is:: ", error);
          throw error;
        }
      });
    });
    describe("Method withdrawLoan", () => {
      it("Expect withdrawLoan to allow Borrower take loan if state == ACTIVE", async () => {
        try {
          const fundAmount = maxAmount;
          const borrowerBalancePrior = await DAIToken.balanceOf(borrower);

          await DAIToken.approve(DAIProxy.address, fundAmount, {from: lender});
          await DAIProxy.fund(Loan.address, fundAmount, {from: lender});

          // Retrieve current state == ACTIVE
          const stateAfterFund = await Loan.currentState({from: owner});
          expect(stateAfterFund).to.eq.BN(2);

          const auctionBalance = await Loan.auctionBalance();
          const operatorBalance = await Loan.operatorBalance();
          const netBalance = auctionBalance.sub(operatorBalance);
          await Loan.withdrawLoan({from: borrower});
          const borrowerBalance = await DAIToken.balanceOf(borrower);

          expect(borrowerBalance).to.eq.BN(borrowerBalancePrior.add(netBalance));
          // State should still be ACTIVE
          const endState = await Loan.currentState({from: owner});
          expect(endState).to.eq.BN(2);
        } catch (error) {
          throw error;
        }
      });
      it("Expect withdrawLoan to NOT allow Borrower take loan if state == REPAID", async () => {
        try {
          const borrowerBalancePrior = await DAIToken.balanceOf(borrower);

          await DAIToken.approve(DAIProxy.address, maxAmount, {from: lender});
          await DAIProxy.fund(Loan.address, maxAmount, {from: lender});

          // Retrieve current state == ACTIVE
          const stateAfterFund = await Loan.currentState({from: owner});
          expect(Number(stateAfterFund)).to.equal(2);

          await Loan.withdrawLoan({from: borrower});
          const borrowerBalance = await DAIToken.balanceOf(borrower);

          expect(Number(borrowerBalance)).to.equal(Number(borrowerBalancePrior) + 100);
          // State should still be ACTIVE
          const endState = await Loan.currentState({from: owner});
          expect(Number(endState)).to.equal(2);

          const amountToRepay = Number(await Loan.borrowerDebt());
          await DAIToken.approve(DAIProxy.address, amountToRepay, {from: borrower});
          await DAIProxy.repay(Loan.address, amountToRepay, {from: borrower});

          const stateAfterDeadline = await Loan.currentState();
          expect(Number(stateAfterDeadline)).to.equal(4);

          await Loan.withdrawLoan({from: borrower});
        } catch (error) {
          expect(error).to.not.equal(undefined);
        }
      });
      it("Expect withdrawLoan to NOT allow Borrower take loan if state == CREATED", async () => {
        try {
          await Loan.withdrawLoan({from: borrower});
        } catch (error) {
          expect(error).to.not.equal(undefined);
        }
      });
      it("Expect withdrawLoan to NOT allow Borrower take loan if state == FAILED_TO_FUND", async () => {
        try {
          await DAIToken.approve(DAIProxy.address, 50, {from: lender});
          await DAIProxy.fund(Loan.address, 50, {from: lender});

          // Mine to end of funding
          const fundEndBlock = await Loan.auctionEndBlock();
          const currentBlock = await web3.eth.getBlockNumber();
          const blocksToEnd = Number(fundEndBlock) - Number(currentBlock);

          await helpers.waitNBlocks(blocksToEnd + 100);
          await Loan.updateStateMachine();

          const stateAfterDeadline = await Loan.currentState();
          expect(Number(stateAfterDeadline)).to.equal(1);

          await Loan.withdrawLoan({from: borrower});
        } catch (error) {
          expect(error).to.not.equal(undefined);
        }
      });
      it("Expect withdrawLoan to NOT allow Borrower take loan if state == CLOSED", async () => {
        try {
          const borrowerBalancePrior = await DAIToken.balanceOf(borrower);

          await DAIToken.approve(DAIProxy.address, 100, {from: lender});
          await DAIProxy.fund(Loan.address, 100, {from: lender});

          // Retrieve current state == ACTIVE
          const stateAfterFund = await Loan.currentState({from: owner});
          expect(Number(stateAfterFund)).to.equal(2);

          await Loan.withdrawLoan({from: borrower});
          const borrowerBalance = await DAIToken.balanceOf(borrower);

          expect(Number(borrowerBalance)).to.equal(Number(borrowerBalancePrior) + 100);
          // State should still be ACTIVE
          const endState = await Loan.currentState({from: owner});
          expect(Number(endState)).to.equal(2);

          const amountToRepay = Number(await Loan.borrowerDebt());
          await DAIToken.approve(DAIProxy.address, amountToRepay, {from: borrower});
          await DAIProxy.repay(Loan.address, amountToRepay, {from: borrower});

          const stateAfterDeadline = await Loan.currentState();
          expect(Number(stateAfterDeadline)).to.equal(4);

          await Loan.withdrawRepayment({from: lender});
          expect(Number(await Loan.currentState())).to.equal(5);
          await Loan.withdrawLoan({from: borrower});
        } catch (error) {
          expect(error).to.not.equal(undefined);
        }
      });
      it("Expect withdrawLoan to NOT allow Borrower take loan if state == DEFAULTED", async () => {
        try {
          auctionBlockLength = 30 / averageMiningBlockTime; // 1 min in seconds
          termEndTimestamp = currentBlock.timestamp + 2;
          Loan = await loanCloner.deploy(
            minAmount,
            maxAmount,
            minInterestRate,
            maxInterestRate,
            termLength,
            auctionLength,
            DAIToken.address,
            "12"
          );
          await helpers.waitNBlocks(1000);
          const isExpired = await Loan.isDefaulted();
          expect(isExpired).to.equal(true);

          await Loan.withdrawLoan({from: borrower});
        } catch (error) {
          expect(error).to.not.equal(undefined);
        }
      });
      it("Expect withdrawLoan to Not allow Borrower take loan if state == FROZEN", async () => {
        try {
          await Loan.unlockFundsWithdrawal({from: admin});
          await Loan.withdrawLoan({from: borrower});
        } catch (error) {
          expect(error).to.not.equal(undefined);
        }
      });
      it("Expect withdrawLoan to NOT allow Borrower take loan twice.", async () => {
        try {
          const borrowerBalancePrior = await DAIToken.balanceOf(borrower);

          await DAIToken.approve(DAIProxy.address, 100, {from: lender});
          await DAIProxy.fund(Loan.address, 100, {from: lender});

          // Retrieve current state == ACTIVE
          const stateAfterFund = await Loan.currentState({from: owner});
          expect(Number(stateAfterFund)).to.equal(2);

          await Loan.withdrawLoan({from: borrower});
          const borrowerBalance = await DAIToken.balanceOf(borrower);

          expect(Number(borrowerBalance)).to.equal(Number(borrowerBalancePrior) + 100);
          // State should still be ACTIVE
          const endState = await Loan.currentState({from: owner});
          expect(Number(endState)).to.equal(2);
          await Loan.withdrawLoan({from: borrower});
        } catch (error) {
          expect(error).to.not.equal(undefined);
        }
      });
    });
    describe("Method withdrawRepaymentAndDeposit", () => {
      const loanMinAmount = web3.utils.toWei("2000");
      const loanMaxAmount = web3.utils.toWei("2000");

      beforeEach(async () => {
        await revertToSnapShot(startSnapshot);
        termLength = "31540000"; // 1 year in seconds
        minAmount = loanMinAmount;
        maxAmount = loanMaxAmount;
        await onBeforeEach();
      });

      it("Expect withdrawRepaymentAndDeposit to allow Lender take repaid loan + interest if state == REPAID", async () => {
        const balancePrior = await DAIToken.balanceOf(otherLender);
        await DAIToken.approve(DAIProxy.address, loanMaxAmount, {from: otherLender});
        await DAIProxy.fund(Loan.address, loanMaxAmount, {from: otherLender});
        // Retrieve current state == ACTIVE
        const stateAfterFund = await Loan.currentState({from: owner});
        expect(Number(stateAfterFund)).to.equal(2);
        await Loan.withdrawLoan({from: borrower});

        const instalmentLength = await Loan.getInstalmentLenght();
        await helpers.increaseTime(instalmentLength.add(new BN("1")));
        const amountToRepay = await Loan.getTotalDebt();
        const borrowerBalancePrior = await DAIToken.balanceOf(borrower);

        await DAIToken.approve(DAIProxy.address, amountToRepay, {from: borrower});
        await DAIProxy.repay(Loan.address, amountToRepay, {from: borrower});

        const borrowerBalanceAfter = await DAIToken.balanceOf(borrower);
        // Fast way to check. TODO: Use BN.js to exact calc-
        expect(borrowerBalanceAfter).to.be.eq.BN(borrowerBalancePrior.sub(amountToRepay));

        // State should change to REPAID
        const endState = await Loan.currentState({from: owner});
        expect(Number(endState)).to.equal(4);
        const lenderAmount = await Loan.getLenderBidAmount(otherLender);
        const lenderAmountWithInterest = await Loan.calculateValueWithInterest(lenderAmount);
        const lenderBalanceBefore = await DAIToken.balanceOf(otherLender);
        await Loan.withdrawRepaymentAndDeposit({from: otherLender, gas: 8000000});
        const lenderBalanceAfter = await DAIToken.balanceOf(otherLender);
        expect(lenderBalanceAfter).to.be.eq.BN(
          lenderBalanceBefore.add(lenderAmountWithInterest).sub(DAI_COST_200_RAISE)
        );
        // User have deposit inside the DepositRegistry
        const deposited = await DepositRegistry.hasDeposited(otherLender);
        expect(deposited).to.equal(true);
      });
    });
    describe("Method withdrawRepayment 2", () => {
      const loanMinAmount = web3.utils.toWei("2000");
      const loanMaxAmount = web3.utils.toWei("2000");
      beforeEach(async () => {
        await revertToSnapShot(startSnapshot);
        termLength = "31540000"; // 1 year in seconds
        minAmount = loanMinAmount;
        maxAmount = loanMaxAmount;
        minInterestRate = new BN("1000000000000000000");
        maxInterestRate = new BN("1000000000000000000");
        await onBeforeEach();
      });
      it("Expect withdrawRepayment to allow Lender take repaid loan + interest if state == REPAID", async () => {
        await DAIToken.approve(DAIProxy.address, loanMaxAmount, {from: lender});
        await DAIProxy.fund(Loan.address, loanMaxAmount, {from: lender});

        // Retrieve current state == ACTIVE
        const stateAfterFund = await Loan.currentState({from: owner});
        expect(Number(stateAfterFund)).to.equal(2);

        await Loan.withdrawLoan({from: borrower});

        const amountToRepay = await Loan.borrowerDebt();
        const amountToRepay2 = await Loan.getTotalDebt();

        const borrowerBalancePrior = await DAIToken.balanceOf(borrower);

        await DAIToken.approve(DAIProxy.address, amountToRepay, {from: borrower});
        await DAIProxy.repay(Loan.address, amountToRepay, {from: borrower});

        const borrowerBalanceAfter = await DAIToken.balanceOf(borrower);
        expect(borrowerBalanceAfter).eq.BN(borrowerBalancePrior.sub(amountToRepay));

        // State should change to REPAID
        const endState = await Loan.currentState({from: owner});
        expect(Number(endState)).to.equal(4);
        const lenderAmount = await Loan.getLenderBidAmount(lender);
        const lenderAmountWithInterest = await Loan.calculateValueWithInterest(lenderAmount);
        const lenderBalanceBefore = await DAIToken.balanceOf(lender);
        await Loan.withdrawRepayment({from: lender});
        const lenderBalanceAfter = await DAIToken.balanceOf(lender);
        expect(lenderBalanceAfter).to.eq.BN(lenderBalanceBefore.add(lenderAmountWithInterest));
      });
      it("Expect withdrawRepayment to NOT allow Lender take repayament if state == CLOSED", async () => {
        try {
          await DAIToken.approve(DAIProxy.address, loanMaxAmount, {from: lender});
          await DAIProxy.fund(Loan.address, loanMaxAmount, {from: lender});

          // Retrieve current state == ACTIVE
          const stateAfterFund = await Loan.currentState({from: owner});
          expect(Number(stateAfterFund)).to.equal(2);

          await Loan.withdrawLoan({from: borrower});

          const amountToRepay = await Loan.borrowerDebt();
          const borrowerBalancePrior = await DAIToken.balanceOf(borrower);

          await DAIToken.approve(DAIProxy.address, amountToRepay, {from: borrower});
          await DAIProxy.repay(Loan.address, amountToRepay, {from: borrower});

          const borrowerBalanceAfter = await DAIToken.balanceOf(borrower);
          // Fast way to check. TODO: Use BN.js to exact calc-
          expect(borrowerBalanceAfter).eq.BN(borrowerBalancePrior.sub(amountToRepay));

          // State should change to REPAID
          const endState = await Loan.currentState({from: owner});
          expect(Number(endState)).to.equal(4);
          const lenderAmount = await Loan.getLenderBidAmount(lender);
          const lenderAmountWithInterest = await Loan.calculateValueWithInterest(lenderAmount);
          const lenderBalanceBefore = await DAIToken.balanceOf(lender);
          await Loan.withdrawRepayment({from: lender});
          const lenderBalanceAfter = await DAIToken.balanceOf(lender);
          expect(lenderBalanceAfter).to.eq.BN(lenderBalanceBefore.add(lenderAmountWithInterest));

          expect(Number(await Loan.currentState())).to.equal(5);
          await Loan.withdrawRepayment({from: lender});
        } catch (error) {
          expect(error).to.not.equal(undefined);
        }
      });
      it("Expect withdrawRepayment to NOT allow Lender take repayament if state == CREATED", async () => {
        try {
          await Loan.withdrawRepayment({from: lender});
        } catch (error) {
          expect(error).to.not.equal(undefined);
        }
      });
      it("Expect withdrawRepayment to NOT allow Lender take repayament if state == FAILED_TO_FUND", async () => {
        try {
          await DAIToken.approve(DAIProxy.address, 50, {from: lender});
          await DAIProxy.fund(Loan.address, 50, {from: lender});

          // Mine to end of funding
          const fundEndBlock = await Loan.auctionEndBlock();
          const currentBlock = await web3.eth.getBlockNumber();
          const blocksToEnd = Number(fundEndBlock) - Number(currentBlock);

          await helpers.waitNBlocks(blocksToEnd + 100);
          await Loan.updateStateMachine();

          const stateAfterDeadline = await Loan.currentState();
          expect(Number(stateAfterDeadline)).to.equal(1);

          await Loan.withdrawRepayment({from: lender});
        } catch (error) {
          expect(error).to.not.equal(undefined);
        }
      });
      it("Expect withdrawRepayment to NOT allow Lender take repayament if state == DEFAULTED", async () => {
        try {
          auctionBlockLength = 30 / averageMiningBlockTime; // 1 min in seconds
          termEndTimestamp = currentBlock.timestamp + 2;
          Loan = await loanCloner.deploy(
            minAmount,
            maxAmount,
            minInterestRate,
            maxInterestRate,
            termLength,
            auctionLength,
            DAIToken.address,
            "12"
          );
          await helpers.waitNBlocks(1000);
          const isExpired = await Loan.isDefaulted();
          expect(isExpired).to.equal(true);

          await Loan.withdrawRepayment({from: lender});
        } catch (error) {
          expect(error).to.not.equal(undefined);
        }
      });
      it("Expect withdrawRepayment to NOT allow Lender take repayament state == ACTIVE", async () => {
        try {
          await DAIToken.approve(DAIProxy.address, 100, {from: lender});
          await DAIProxy.fund(Loan.address, 100, {from: lender});

          // Retrieve current state == ACTIVE
          const stateAfterFund = await Loan.currentState({from: owner});
          expect(Number(stateAfterFund)).to.equal(2);

          await Loan.withdrawRepayment({from: lender});
        } catch (error) {
          expect(error).to.not.equal(undefined);
        }
      });
      it("Expect withdrawRepayment to NOT allow lender to take repayment state == FROZEN", async () => {
        try {
          await Loan.unlockFundsWithdrawal({from: admin});
          await Loan.withdrawRepayment({from: lender});
        } catch (error) {
          expect(error).to.not.equal(undefined);
        }
      });
      it("Expect withdrawRepayment to NOT allow Borrower take repayament", async () => {
        try {
          await DAIToken.approve(DAIProxy.address, 100, {from: lender});
          await DAIProxy.fund(Loan.address, 100, {from: lender});

          // Retrieve current state == ACTIVE
          const stateAfterFund = await Loan.currentState({from: owner});
          expect(Number(stateAfterFund)).to.equal(2);

          await Loan.withdrawLoan({from: borrower});

          const amountToRepay = await Loan.borrowerDebt();
          const borrowerBalancePrior = await DAIToken.balanceOf(borrower);

          await DAIToken.approve(DAIProxy.address, amountToRepay, {from: borrower});
          await DAIProxy.repay(Loan.address, amountToRepay, {from: borrower});

          const borrowerBalanceAfter = await DAIToken.balanceOf(borrower);
          // Fast way to check. TODO: Use BN.js to exact calc-
          expect(Number(borrowerBalanceAfter)).equal(
            Number(borrowerBalancePrior) - Number(amountToRepay)
          );

          // State should change to REPAID
          const endState = await Loan.currentState({from: owner});
          expect(Number(endState)).to.equal(4);
          await Loan.withdrawRepayment({from: borrower});
        } catch (error) {
          expect(error).to.not.equal(undefined);
        }
      });
    });
    describe("Method withdrawRefund", () => {
      beforeEach(async () => {
        auctionBlockLength = 30 / averageMiningBlockTime; // 1 min in seconds
        termEndTimestamp = currentBlock.timestamp + 2;
        await onBeforeEach();
      });
      it("Expect withdrawRefund to allow Lender refund if state == FAILED_TO_FUND", async () => {
        const lenderBalancePrior = await DAIToken.balanceOf(lender);

        const statePrior = await Loan.currentState();
        console.log("state", Number(statePrior), fromWei(lenderBalancePrior));

        // Partially fund the Loan
        const partialFund = new BN("1");
        await DAIToken.approve(DAIProxy.address, partialFund, {from: lender});
        await DAIProxy.fund(Loan.address, partialFund, {from: lender});

        // Mine to end of funding\

        await helpers.increaseTime(auctionLength + 1000);
        await Loan.updateStateMachine();

        const stateAfterDeadline = await Loan.currentState();
        expect(Number(stateAfterDeadline)).to.equal(1);

        // Lender withdraws refund
        const lenderBalancePriorRefund = await DAIToken.balanceOf(lender);
        await Loan.withdrawRefund({from: lender});
        const lenderBidAmountInContractAfterWithdraw = await Loan.getLenderBidAmount(lender);
        const lenderBalanceAfter = await DAIToken.balanceOf(lender);
        expect(lenderBalancePriorRefund).to.eq.BN(lenderBalancePrior.sub(partialFund));
        expect(lenderBalanceAfter).to.eq.BN(lenderBalancePrior);
        expect(lenderBidAmountInContractAfterWithdraw).to.eq.BN(partialFund);
      });
      it("Expect withdrawRefund to NOT allow Lender refund if already refunded && state == FAILED_TO_FUND ", async () => {
        // Partially fund the Loan
        await DAIToken.approve(DAIProxy.address, 50, {from: lender});
        await DAIProxy.fund(Loan.address, 50, {from: lender});

        await helpers.increaseTime(auctionLength + 10);
        await Loan.updateStateMachine();

        const stateAfterDeadline = await Loan.currentState();
        expect(Number(stateAfterDeadline)).to.equal(1);

        await truffleAssert.passes(Loan.withdrawRefund({from: lender}));
        await truffleAssert.fails(
          Loan.withdrawRefund({from: lender}),
          truffleAssert.ErrorType.REVERT
        );
      });
      it("Expect withdrawRefund to NOT allow Lender refund if state == CREATED", async () => {
        try {
          // Partially fund the Loan
          await DAIToken.approve(DAIProxy.address, 50, {from: lender});
          await DAIProxy.fund(Loan.address, 50, {from: lender});

          await Loan.updateStateMachine();

          const stateAfterDeadline = await Loan.currentState();
          expect(Number(stateAfterDeadline)).to.equal(0);

          await Loan.withdrawRefund({from: lender});
        } catch (error) {
          expect(error).to.not.equal(undefined);
        }
      });
      it("Expect withdrawRefund to NOT allow Lender refund if state == ACTIVE", async () => {
        try {
          // Partially fund the Loan
          await DAIToken.approve(DAIProxy.address, 100, {from: lender});
          await DAIProxy.fund(Loan.address, 100, {from: lender});

          // Mine to end of funding
          const fundEndBlock = await Loan.auctionEndBlock();
          const currentBlock = await web3.eth.getBlockNumber();
          const blocksToEnd = Number(fundEndBlock) - Number(currentBlock);

          await helpers.waitNBlocks(blocksToEnd + 100);
          await Loan.updateStateMachine();

          const stateAfterDeadline = await Loan.currentState();
          expect(Number(stateAfterDeadline)).to.equal(2);

          await Loan.withdrawRefund({from: lender});
        } catch (error) {
          expect(error).to.not.equal(undefined);
        }
      });
      it("Expect withdrawRefund to NOT allow Lender refund if state == DEFAULTED", async () => {
        try {
          // Partially fund the Loan
          await DAIToken.approve(DAIProxy.address, 100, {from: lender});
          await DAIProxy.fund(Loan.address, 100, {from: lender});

          await helpers.waitNBlocks(1000);
          await Loan.updateStateMachine();
          const stateAfterDeadline = await Loan.currentState();
          expect(Number(stateAfterDeadline)).to.equal(3);

          await Loan.withdrawRefund({from: lender});
        } catch (error) {
          expect(error).to.not.equal(undefined);
        }
      });
      it("Expect withdrawRefund to NOT allow Lender refund if state == REPAID", async () => {
        try {
          await DAIToken.approve(DAIProxy.address, 100, {from: lender});
          await DAIProxy.fund(Loan.address, 100, {from: lender});

          await Loan.withdrawLoan({from: borrower});

          const amountToRepay = await Loan.borrowerDebt();
          await DAIToken.approve(DAIProxy.address, amountToRepay, {from: borrower});
          await DAIProxy.repay(Loan.address, amountToRepay, {from: borrower});

          const stateAfterDeadline = await Loan.currentState();
          expect(Number(stateAfterDeadline)).to.equal(4);

          await Loan.withdrawRefund({from: lender});
        } catch (error) {
          expect(error).to.not.equal(undefined);
        }
      });
      it("Expect withdrawRefund to NOT allow Lender refund if state == FROZEN", async () => {
        try {
          await Loan.unlockFundsWithdrawal({from: admin});
          await Loan.withdrawRefund({from: borrower});
        } catch (error) {
          expect(error).to.not.equal(undefined);
        }
      });
    });
    describe("Method onRepaymentReceived", () => {
      it("Expect onRepaymentReceived to let borrower return the loan and mutate state to REPAID", async () => {
        // Partially fund the Loan
        await DAIToken.approve(DAIProxy.address, 100, {from: lender});
        await DAIProxy.fund(Loan.address, 100, {from: lender});

        await Loan.withdrawLoan({from: borrower});
        const borrowerBalance = Number(await DAIToken.balanceOf(borrower));
        const amountToRepay = Number(await Loan.borrowerDebt());
        await DAIToken.approve(DAIProxy.address, amountToRepay, {from: borrower});
        await DAIProxy.repay(Loan.address, amountToRepay, {from: borrower});

        const stateAfterDeadline = await Loan.currentState();
        expect(Number(stateAfterDeadline)).to.equal(4);
      });
      it("Expect onRepaymentReceived to revert borrower not to return the loan if incorrect ammount", async () => {
        try {
          await DAIToken.approve(DAIProxy.address, 100, {from: lender});
          await DAIProxy.fund(Loan.address, 100, {from: lender});

          await Loan.withdrawLoan({from: borrower});
          const amountToRepay = Number(await Loan.borrowerDebt());

          await DAIToken.approve(DAIProxy.address, amountToRepay, {from: borrower});
          await DAIProxy.repay(Loan.address, amountToRepay - 10, {from: borrower});
        } catch (error) {
          expect(error).to.not.equal(undefined);
        }
      });
    });
    describe("Method isAuctionExpired", () => {
      it("Expects to return true when block number is greater than the auction end block", async () => {
        await helpers.increaseTime(auctionLength + 10);
        const isExpired = await Loan.isAuctionExpired();
        expect(isExpired).to.equal(true);
      });
      it("Expects to return false when block is lesser than auction end block ", async () => {
        const isExpired = await Loan.isAuctionExpired();
        expect(isExpired).to.equal(false);
      });
    });
    describe("Method isDefaulted", () => {
      beforeEach(async () => {
        auctionLength = 30; // 1 min in seconds
        termLength = 2;
        await onBeforeEach();
      });
      it("Expects to return true when block timestamp is greater than the termEndTimestamp", async () => {
        await helpers.increaseTime(auctionLength + 10);
        const isExpired = await Loan.isDefaulted();
        expect(isExpired).to.equal(true);
      });
      it("Expects to return false when block timestamp is lesser than the termEndTimestamp", async () => {
        const isExpired = await Loan.isDefaulted();
        expect(isExpired).to.equal(false);
      });
    });
    describe("Method getInterestRate", () => {
      beforeEach(async () => {
        auctionLength = 60; // 1 min in seconds
        termLength = 60;
        minInterestRate = 0;
        await onBeforeEach();
      });
      it("Expects to calculate correctly the interest rate when loan is in state = CREATED", async () => {
        await DAIToken.approve(DAIProxy.address, 50, {from: lender});
        await DAIProxy.fund(Loan.address, 50, {from: lender});

        await helpers.increaseTime(30);
        const calculatedInterest = await Loan.getInterestRate();

        expect(calculatedInterest).to.gt.BN(0);
      });
      it("Expects to return different interest rates through time", async () => {
        await DAIToken.approve(DAIProxy.address, 50, {from: lender});
        await DAIProxy.fund(Loan.address, 50, {from: lender});

        // formula:: maxInterest * (currentBlockNumber - auctionStartBlock) / (auctionEndBlock - auctionStartBlock)

        await helpers.increaseTime(300);
        const calculatedInterest = await Loan.getInterestRate();

        await helpers.increaseTime(500);

        // formula:: maxInterest * (currentBlockNumber - auctionStartBlock) / (auctionEndBlock - auctionStartBlock)
        const calculatedInterest2 = await Loan.getInterestRate();

        expect(calculatedInterest).to.gt.BN(0);
        expect(calculatedInterest2).to.gt.BN(calculatedInterest);
      });
      it("Expects to return same interest rates once auction ended state= ACTIVE", async () => {
        await DAIToken.approve(DAIProxy.address, 100, {from: lender});
        await DAIProxy.fund(Loan.address, 100, {from: lender});

        // formula:: maxInterest * (lastFundedBlock - auctionStartBlock) / (auctionEndBlock - auctionStartBlock)
        await helpers.increaseTime(auctionLength + 10);
        const calculatedInterest = Number(await Loan.getInterestRate());
        await helpers.increaseTime(10);
        const calculatedInterest2 = Number(await Loan.getInterestRate());

        expect(calculatedInterest).to.equal(calculatedInterest2);
      });
    });
    describe("Method withdrawFundsUnlocked", async () => {
      beforeEach(async () => {
        auctionBlockLength = 30 / averageMiningBlockTime; // 1 min in seconds
        termEndTimestamp = currentBlock.timestamp + 2;
        await onBeforeEach();
      });
      it("Expects lender to withdraw funds after unlocked", async () => {
        const balanceBefore = Number(await DAIToken.balanceOf(lender));
        await DAIToken.approve(DAIProxy.address, 100, {from: lender});
        await DAIProxy.fund(Loan.address, 100, {from: lender});

        await Loan.unlockFundsWithdrawal({from: admin});

        const state = Number(await Loan.currentState());
        expect(state).to.equal(6);

        await Loan.withdrawFundsUnlocked({from: lender});
        const balance = Number(await DAIToken.balanceOf(lender));

        expect(balance).to.equal(balanceBefore);
      });
      it("Expects lender to not be able to withdraw funds if not unlocked", async () => {
        try {
          await DAIToken.approve(DAIProxy.address, 100, {from: lender});
          await DAIProxy.fund(Loan.address, 100, {from: lender});

          await Loan.withdrawFundsUnlocked({from: lender});
        } catch (error) {
          expect(error).to.not.equal(undefined);
        }
      });
    });
    describe("Method unlockFundsWithdrawal", () => {
      beforeEach(async () => {
        auctionBlockLength = 30 / averageMiningBlockTime; // 1 min in seconds
        termEndTimestamp = currentBlock.timestamp + 2;
        await onBeforeEach();
      });
      it("Expects to unlock the funds if admin", async () => {
        await Loan.unlockFundsWithdrawal({from: admin});
        const unlocked = Number(await Loan.currentState());
        expect(unlocked).to.equal(6);
      });
      it("Expects to not unlock the funds if not admin", async () => {
        try {
          await Loan.unlockFundsWithdrawal({from: owner});
        } catch (error) {
          expect(error).to.not.equal(undefined);
        }
      });
    });
    describe("Tests for when withdrawn even if DAI is transfered [Community found]", () => {
      beforeEach(async () => {
        try {
          DAIProxy = await DAIProxyContract.new(DAIToken.address, {from: owner});

          currentBlock = await web3.eth.getBlock("latest");

          // Set Loan variables
          minAmount = 80;
          maxAmount = 100;
          minInterestRate = 0;
          maxInterestRate = 3000;
          auctionLength = 60 * 60; // 1 hour in seconds
          termEndTimestamp = 2 * 60 * 60; // 2 hours in seconds
          await onBeforeEach();
        } catch (error) {
          throw error;
        }
      });
      it("Expects to get closed if an abritrary amount of DAI is sent to loan contract when withdrawn", async () => {
        const borrowerBalancePrior = await DAIToken.balanceOf(borrower);
        const fundAmount = new BN(100);
        await DAIToken.approve(DAIProxy.address, fundAmount, {from: lender});
        await DAIProxy.fund(Loan.address, fundAmount, {from: lender});

        // Retrieve current state == ACTIVE
        const stateAfterFund = await Loan.currentState({from: owner});
        expect(stateAfterFund).to.eq.BN(2);

        await Loan.withdrawLoan({from: borrower});
        const borrowerBalance = await DAIToken.balanceOf(borrower);
        const auctionBalance = await Loan.auctionBalance();
        const operatorBalance = await Loan.operatorBalance();
        const netBalance = auctionBalance.sub(operatorBalance);

        expect(borrowerBalance).to.eq.BN(borrowerBalancePrior.add(netBalance));
        // State should still be ACTIVE

        const endState = await Loan.currentState({from: owner});
        expect(endState).to.eq.BN(2);

        const amountToRepay = await Loan.borrowerDebt();
        await DAIToken.approve(DAIProxy.address, amountToRepay, {from: borrower});
        await DAIProxy.repay(Loan.address, amountToRepay, {from: borrower});

        const stateAfterDeadline = await Loan.currentState();
        expect(stateAfterDeadline).to.eq.BN(4);

        //if bobs send an arbitrary amount of dai to the contract it will never go to "CLOSED" state
        await DAIToken.transfer(Loan.address, 1, {from: bob});

        await Loan.withdrawRepayment({from: lender});

        //will fail because state is still REPAID although all repayments where withdrawn
        expect(await Loan.currentState()).to.eq.BN(5);
      });
    });
    describe("Method withdrawFees", () => {
      beforeEach(async () => {
        auctionBlockLength = 30 / averageMiningBlockTime; // 1 min in seconds
        termEndTimestamp = currentBlock.timestamp + 2;
        await onBeforeEach();
      });
      it("Expect operators to withdraw the loan operator fee if borrower has withdraw", async () => {
        const adminBalancePrior = await DAIToken.balanceOf(admin);
        const expectedFee = maxAmount.mul(operatorPercentFee).div(toWei(new BN(100)));
        await DAIToken.approve(DAIProxy.address, maxAmount, {from: lender});
        await DAIProxy.fund(Loan.address, maxAmount, {from: lender});
        await Loan.withdrawLoan({from: borrower});
        await Loan.withdrawFees({from: admin});
        const adminBalanceAfter = await DAIToken.balanceOf(admin);
        expect(adminBalanceAfter).to.eq.BN(adminBalancePrior.add(expectedFee));
      });
      it("Expect operators to NOT withdraw the loan operator fee if borrower did NOT withdraw", async () => {
        const adminBalancePrior = await DAIToken.balanceOf(admin);
        const expectedFee = maxAmount.mul(operatorPercentFee).div(toWei(new BN(100)));
        await DAIToken.approve(DAIProxy.address, maxAmount, {from: lender});
        await DAIProxy.fund(Loan.address, maxAmount, {from: lender});

        await truffleAssert.fails(
          Loan.withdrawFees({from: admin}),
          truffleAssert.ErrorType.REVERT,
          "borrower didnt withdraw"
        );

        const adminBalanceAfter = await DAIToken.balanceOf(admin);
        expect(adminBalanceAfter).to.eq.BN(adminBalancePrior);
      });
      it("Expect operators to NOT withdraw the loan operator fee if already done", async () => {
        const adminBalancePrior = await DAIToken.balanceOf(admin);
        const expectedFee = maxAmount.mul(operatorPercentFee).div(toWei(new BN(100)));
        await DAIToken.approve(DAIProxy.address, maxAmount, {from: lender});
        await DAIProxy.fund(Loan.address, maxAmount, {from: lender});
        await Loan.withdrawLoan({from: borrower});
        await Loan.withdrawFees({from: admin});
        const adminBalanceAfter = await DAIToken.balanceOf(admin);
        expect(adminBalanceAfter).to.eq.BN(adminBalancePrior.add(expectedFee));

        await truffleAssert.fails(
          Loan.withdrawFees({from: admin}),
          truffleAssert.ErrorType.REVERT,
          "no funds to withdraw"
        );
        const adminBalanceAfterError = await DAIToken.balanceOf(admin);
        expect(adminBalanceAfterError).to.eq.BN(adminBalanceAfter);
      });
    });
    describe("Method setDAIProxy", () => {
      it("Update DAI proxy address", async () => {
        const newDAIProxy = await DAIProxyContract.new(DAIToken.address, {from: owner});
        const proxyAddress = await Loan.proxyAddress();
        await Loan.setProxyAddress(newDAIProxy.address, {from: admin});
        const newProxyAddress = await Loan.proxyAddress();
        expect(proxyAddress).to.not.equal(newProxyAddress);
        expect(newProxyAddress).equal(newDAIProxy.address);
      });

      it("Fund from different DAI Proxy", async () => {
        await DAIToken.approve(DAIProxy.address, 50, {from: lender});
        await DAIProxy.fund(Loan.address, 50, {from: lender});

        const newDAIProxy = await DAIProxyContract.new(DAIToken.address, {from: owner});
        await Loan.setProxyAddress(newDAIProxy.address, {from: admin});
        const newProxyAddress = await Loan.proxyAddress();
        expect(newProxyAddress).equal(newDAIProxy.address);
        await DAIToken.approve(newDAIProxy.address, 50, {from: lender});
        await newDAIProxy.fund(Loan.address, 50, {from: lender});
        // Retrieve current state == ACTIVE
        const stateAfterFund = await Loan.currentState();
        expect(Number(stateAfterFund)).to.equal(2);
      });
    });
  });
});
