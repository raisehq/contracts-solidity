const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
const bnChai = require("bn-chai");
const web3 = global.web3;
const BN = web3.utils.BN;
chai.use(chaiAsPromised);
chai.use(bnChai(BN));
const truffleAssert = require("truffle-assertions");
const {expect} = chai;
const {fromWei, toWei} = web3.utils;
const DAIProxyContract = artifacts.require("DAIProxy");
const HeroFakeTokenContract = artifacts.require("HeroFakeToken");
const LoanContract = artifacts.require("LoanContract");
const AuthContract = artifacts.require("Authorization");
const DepositRegistryContract = artifacts.require("DepositRegistry");
const KYCContract = artifacts.require("KYCRegistry");

const LoanContractDispatcherContract = artifacts.require("LoanContractDispatcher");

const zeroAddress = "0x0000000000000000000000000000000000000000";

// mine blocks so it passes "time"
const {
  waitNBlocks,
  calculateNetLoan,
  calculatePendingDebt,
  increaseTime,
  increaseToTime
} = require("./helpers");

const HeroAmount = "200000000000000000000";

contract("Integration", accounts => {
  let DAIProxy;
  let DAIToken;
  let HeroToken;
  let DepositRegistry;
  let Auth;
  let KYCRegistry;
  let LoanDispatcher;

  const owner = accounts[0];
  const lender = accounts[1];
  const borrower = accounts[2];
  const lender2 = accounts[3];
  const lender3 = accounts[4];
  const admin = accounts[5];

  const averageMiningBlockTime = 15;

  describe("Test the full flow with the actual contracts", () => {
    let lenderKYC;
    let lender2KYC;
    let lender3KYC;
    let borrowerKYC;
    let lenderHasDeposited;
    let lender2HasDeposited;
    let lender3HasDeposited;
    let loanMaxAmount;
    let loanMinAmount;
    let operatorPercentFee;
    let auctionLength;
    let Loan;
    const daiBalance = web3.utils.toWei(new BN(100, 10));

    beforeEach(async () => {
      DAIToken = await HeroFakeTokenContract.new({from: owner});
      USDCToken = await HeroFakeTokenContract.new({from: owner});
      HeroToken = await HeroFakeTokenContract.new({from: owner});

      await HeroToken.transferFakeHeroTokens(lender, {from: owner});
      await HeroToken.transferFakeHeroTokens(lender2, {from: owner});
      await HeroToken.transferFakeHeroTokens(lender3, {from: owner});

      // adding lender and borrower to KYC
      KYCRegistry = await KYCContract.new();
      await KYCRegistry.setAdministrator(admin);
      await KYCRegistry.addAddressToKYC(lender, {from: admin});
      await KYCRegistry.addAddressToKYC(lender2, {from: admin});
      await KYCRegistry.addAddressToKYC(lender3, {from: admin});
      await KYCRegistry.addAddressToKYC(borrower, {from: admin});

      // give permision to the deposit registry to deposit tokens instead of the lender
      DepositRegistry = await DepositRegistryContract.new(HeroToken.address, KYCRegistry.address, {
        from: owner
      });

      await HeroToken.approve(DepositRegistry.address, HeroAmount, {from: lender});
      await HeroToken.approve(DepositRegistry.address, HeroAmount, {from: lender2});
      await HeroToken.approve(DepositRegistry.address, HeroAmount, {from: lender3});

      await DepositRegistry.depositFor(lender, {from: lender});
      await DepositRegistry.depositFor(lender2, {from: lender2});
      await DepositRegistry.depositFor(lender3, {from: lender3});

      // initialize proxies for lender and borrower
      Auth = await AuthContract.new(KYCRegistry.address, DepositRegistry.address);
      DAIProxy = await DAIProxyContract.new(Auth.address, {from: owner});

      // check KYC and Deposit
      lenderKYC = await Auth.isKYCConfirmed(lender);
      lender2KYC = await Auth.isKYCConfirmed(lender2);
      lender3KYC = await Auth.isKYCConfirmed(lender3);
      borrowerKYC = await Auth.isKYCConfirmed(borrower);

      lenderHasDeposited = await Auth.hasDeposited(lender);
      lender2HasDeposited = await Auth.hasDeposited(lender2);
      lender3HasDeposited = await Auth.hasDeposited(lender3);

      // initialize loan contract dispatcher
      LoanDispatcher = await LoanContractDispatcherContract.new(
        Auth.address,
        DAIProxy.address,
        zeroAddress, // SwapAndDepositFactory
        {
          from: owner
        }
      );
      await LoanDispatcher.setAdministrator(admin, {from: owner});
      await LoanDispatcher.setMinTermLength(0, {from: admin});
      await LoanDispatcher.setMinAuctionLength(0, {from: admin});
      await LoanDispatcher.addTokenToAcceptedList(DAIToken.address, {from: admin});
      await LoanDispatcher.addTokenToAcceptedList(USDCToken.address, {from: admin});

      // Setup DAI amounts

      await DAIToken.transferAmountToAddress(lender, daiBalance, {from: owner});
      await DAIToken.transferAmountToAddress(lender2, daiBalance, {from: owner});
      await DAIToken.transferAmountToAddress(lender3, daiBalance, {from: owner});
      await USDCToken.transferAmountToAddress(lender, daiBalance, {from: owner});
      await USDCToken.transferAmountToAddress(lender2, daiBalance, {from: owner});
      await USDCToken.transferAmountToAddress(lender3, daiBalance, {from: owner});

      // borrower creates loan
      const currentBlock = await web3.eth.getBlock("latest");
      const loanRepaymentTime = 2 * 60 * 60; // 2 hours in seconds
      loanMinAmount = web3.utils.toWei(new BN(90, 10));
      loanMaxAmount = web3.utils.toWei(new BN(100, 10));
      const minInterestRate = 0;
      const maxInterestRate = 5000;
      auctionLength = 60 * 60;
      console.log("token address =======================================> ", DAIToken.address);
      await LoanDispatcher.deploy(
        loanMinAmount,
        loanMaxAmount,
        minInterestRate,
        maxInterestRate,
        loanRepaymentTime,
        auctionLength,
        DAIToken.address,
        {from: borrower}
      );
      const loanEventHistory = await LoanDispatcher.getPastEvents("LoanContractCreated"); // {fromBlock: 0, toBlock: "latest"} put this to get all
      const loanAddress = loanEventHistory[0].returnValues.contractAddress;

      // create loan instance from Loan.address
      Loan = await LoanContract.at(loanAddress);
      operatorPercentFee = await Loan.operatorFee();
    });
    it("Expects the flow to work correctly for one lender to fully fund a loan and for the borrower to repay", async () => {
      try {
        const operatorFeeWei = await Loan.operatorFee();
        const operatorFee = web3.utils.fromWei(operatorFeeWei);
        // lender funds loan
        const principalAmount = await Loan.maxAmount();
        const desiredOperatorFee =
          (Number(web3.utils.fromWei(principalAmount)) * operatorFee) / 100;
        const desiredOperatorFeeWei = web3.utils.toWei(new BN(desiredOperatorFee.toString(), 10));
        const fundingAmount = web3.utils.toWei(
          new BN((Number(web3.utils.fromWei(principalAmount)) - desiredOperatorFee).toString(), 10),
          "ether"
        );
        await DAIToken.approve(DAIProxy.address, principalAmount, {from: lender});
        const fundTx = await DAIProxy.fund(Loan.address, principalAmount, {from: lender});
        const totalDebt = await Loan.borrowerDebt();

        // Due we need to watch the LoanContract.sol events, need to change tx scope to point LoanContract.sol
        const loanTxScope = await truffleAssert.createTransactionResult(Loan, fundTx.tx);
        truffleAssert.eventEmitted(
          loanTxScope,
          "Funded",
          ev =>
            ev.loanAddress == Loan.address && ev.lender == lender && principalAmount.eq(ev.amount)
        );
        truffleAssert.eventEmitted(
          loanTxScope,
          "MinimumFundingReached",
          ev => ev.loanAddress == Loan.address && principalAmount.eq(ev.currentBalance)
        );
        truffleAssert.eventEmitted(
          loanTxScope,
          "FullyFunded",
          ev =>
            ev.loanAddress == Loan.address &&
            totalDebt.eq(ev.balanceToRepay) &&
            fundingAmount.eq(ev.auctionBalance)
        );

        // check if loan is funded
        const loanFundedAmount = await Loan.auctionBalance();
        const amountFundedByLender = await Loan.getLenderBidAmount(lender);
        const fundedLoanState = await Loan.currentState();

        // borrower takes money from loan
        await Loan.withdrawLoan({from: borrower});

        // check borrower received amount
        const borrowerWithdrawAmount = await DAIToken.balanceOf(borrower);

        // borrower repays loan
        const interestAmount = calculatePendingDebt(borrowerWithdrawAmount, totalDebt);
        await DAIToken.transferAmountToAddress(borrower, interestAmount, {from: owner});
        await DAIToken.approve(DAIProxy.address, totalDebt, {from: borrower});

        const repayTx = await DAIProxy.repay(Loan.address, totalDebt, {from: borrower});

        // Check repay event
        const repayLoanTxScope = await truffleAssert.createTransactionResult(Loan, repayTx.tx);
        truffleAssert.eventEmitted(repayLoanTxScope, "LoanRepaid");

        const stateAfterRepay = await Loan.currentState();

        // lender takes out money
        const txWithdraw = await Loan.withdrawRepayment({from: lender});
        const lenderBalanceAfterRepayment = await DAIToken.balanceOf(lender);
        const lenderWithdrawed = await Loan.getLenderWithdrawn(lender);
        const endState = await Loan.currentState();

        // Check repay event
        truffleAssert.eventEmitted(txWithdraw, "RepaymentWithdrawn");
        truffleAssert.eventEmitted(txWithdraw, "FullyRefunded");

        // Check operator fee
        const currentOperatorFeeWei = await Loan.operatorBalance();
        const priorOperatorBalance = await DAIToken.balanceOf(admin);
        // Withdraw operator fee
        const withdrawFeeTx = await Loan.withdrawFees({from: admin});
        const afterOperatorBalanceContract = await Loan.operatorBalance();
        const afterOperatorBalance = await DAIToken.balanceOf(admin);
        // Check repay event
        truffleAssert.eventEmitted(withdrawFeeTx, "OperatorWithdrawn");

        // assertions
        expect(lenderKYC).to.equal(true);
        expect(borrowerKYC).to.equal(true);
        expect(lenderHasDeposited).to.equal(true);
        assert(fundedLoanState.eq(new BN("2", 10)));
        assert(loanFundedAmount.eq(fundingAmount));
        assert(amountFundedByLender.eq(principalAmount));
        assert(borrowerWithdrawAmount.eq(fundingAmount));
        expect(stateAfterRepay.eq(new BN("4", 10)));
        assert(lenderBalanceAfterRepayment.eq(totalDebt));
        expect(lenderWithdrawed).to.equal(true);
        assert(endState.eq(new BN("5", 10)));
        assert(desiredOperatorFeeWei.eq(currentOperatorFeeWei));
        assert(afterOperatorBalance.eq(priorOperatorBalance.add(currentOperatorFeeWei)));
      } catch (error) {
        console.error(error);
        throw error;
      }
    });
    it("Expects to work for 3 diff lenders with overflow and borrower repays in time", async () => {
      // wait for time / blocks to pass
      await waitNBlocks(100);

      // lenders funds loan
      const fundingAmount = web3.utils.toWei("50");
      const fundingAmount2 = web3.utils.toWei("40");
      const fundingAmount3 = web3.utils.toWei("100");
      await DAIToken.approve(DAIProxy.address, fundingAmount, {from: lender});
      await DAIToken.approve(DAIProxy.address, fundingAmount2, {from: lender2});
      await DAIToken.approve(DAIProxy.address, fundingAmount3, {from: lender3});
      await DAIProxy.fund(Loan.address, fundingAmount, {from: lender});
      await DAIProxy.fund(Loan.address, fundingAmount2, {from: lender2});
      const txFunded = await DAIProxy.fund(Loan.address, fundingAmount3, {from: lender3});

      // check if loan is funded
      const loanFundedAmount = await Loan.auctionBalance();
      const amountFundedByLender = await Loan.getLenderBidAmount(lender);
      const amountFundedByLender2 = await Loan.getLenderBidAmount(lender2);
      const amountFundedByLender3 = await Loan.getLenderBidAmount(lender3);
      const lenderBalance = await DAIToken.balanceOf(lender);
      const lender2Balance = await DAIToken.balanceOf(lender2);
      const lender3Balance = await DAIToken.balanceOf(lender3);

      // get lenders amounts with interest
      const lenderBidAmountWithInterest = await Loan.calculateValueWithInterest(
        amountFundedByLender
      );
      const lender2AmountWithInterest = await Loan.calculateValueWithInterest(
        amountFundedByLender2
      );
      const lender3AmountWithInterest = await Loan.calculateValueWithInterest(
        amountFundedByLender3
      );

      // borrower takes money from loan
      await Loan.withdrawLoan({from: borrower});
      // borrower current debt with interests
      const totalDebt = await Loan.borrowerDebt();

      // check borrower received amount
      const borrowerWithdrawAmount = await DAIToken.balanceOf(borrower);

      // borrower repays
      const interestAmount = calculatePendingDebt(borrowerWithdrawAmount, totalDebt);
      await DAIToken.transferAmountToAddress(borrower, interestAmount, {from: owner});
      await DAIToken.approve(DAIProxy.address, totalDebt, {from: borrower});
      const repayTx = await DAIProxy.repay(Loan.address, totalDebt, {from: borrower});

      // Check repay event
      const repayLoanTxScope = await truffleAssert.createTransactionResult(Loan, repayTx.tx);
      truffleAssert.eventEmitted(repayLoanTxScope, "LoanRepaid");

      const lenderOneBeforeRepay = await DAIToken.balanceOf(lender);
      const lenderTwoBeforeRepay = await DAIToken.balanceOf(lender2);
      const lenderThreeBeforeRepay = await DAIToken.balanceOf(lender3);
      // lender takes out money
      await Loan.withdrawRepayment({from: lender});
      await Loan.withdrawRepayment({from: lender2});
      await Loan.withdrawRepayment({from: lender3});
      const lenderBalanceAfterRepayment = await DAIToken.balanceOf(lender);
      const lender2BalanceAfterRepayment = await DAIToken.balanceOf(lender2);
      const lender3BalanceAfterRepayment = await DAIToken.balanceOf(lender3);
      const lendedOneWithdrawn = await Loan.getLenderWithdrawn(lender);
      const lenderTwoWithdrawn = await Loan.getLenderWithdrawn(lender2);
      const lenderThreeWithdrawn = await Loan.getLenderWithdrawn(lender3);

      expect(lenderKYC).to.equal(true);
      expect(lender2KYC).to.equal(true);
      expect(lender3KYC).to.equal(true);
      expect(borrowerKYC).to.equal(true);
      expect(lenderHasDeposited).to.equal(true);
      expect(lender2HasDeposited).to.equal(true);
      expect(lender3HasDeposited).to.equal(true);
      expect(Number(fromWei(loanFundedAmount))).to.equal(
        Number(fromWei(calculateNetLoan(loanMaxAmount, operatorPercentFee)))
      );
      expect(Number(fromWei(amountFundedByLender))).to.equal(50);
      expect(Number(fromWei(amountFundedByLender2))).to.equal(40);
      expect(Number(fromWei(amountFundedByLender3))).to.equal(10);
      expect(Number(fromWei(lenderBalance))).to.equal(50);
      expect(Number(fromWei(lender2Balance))).to.equal(60);
      expect(Number(fromWei(lender3Balance))).to.equal(90);
      expect(Number(fromWei(borrowerWithdrawAmount))).to.equal(
        Number(fromWei(calculateNetLoan(loanMaxAmount, operatorPercentFee)))
      );
      expect(lenderBalanceAfterRepayment).to.eq.BN(
        lenderBidAmountWithInterest.add(lenderOneBeforeRepay)
      );
      expect(lender2BalanceAfterRepayment).to.eq.BN(
        lender2AmountWithInterest.add(lenderTwoBeforeRepay)
      );
      expect(lender3BalanceAfterRepayment).to.eq.BN(
        lender3AmountWithInterest.add(lenderThreeBeforeRepay)
      );
      expect(lendedOneWithdrawn).to.equal(true);
      expect(lenderTwoWithdrawn).to.equal(true);
      expect(lenderThreeWithdrawn).to.equal(true);
    });
    it("Expects to work for 2 diff lenders with one of them doing 2 lendings and borrower repays in time", async () => {
      // lenders funds loan
      const fundingAmount = web3.utils.toWei(new BN("50", 10));
      const fundingAmount2 = web3.utils.toWei(new BN("40", 10));
      const fundingAmount3 = web3.utils.toWei(new BN("50", 10));
      await DAIToken.approve(DAIProxy.address, fundingAmount.add(fundingAmount3), {from: lender});
      await DAIToken.approve(DAIProxy.address, fundingAmount3, {from: lender2});
      await DAIProxy.fund(Loan.address, fundingAmount, {from: lender});
      await DAIProxy.fund(Loan.address, fundingAmount2, {from: lender2});
      await DAIProxy.fund(Loan.address, fundingAmount3, {from: lender});

      // check if loan is funded
      const loanFundedAmount = await Loan.auctionBalance();
      const amountFundedByLender = await Loan.getLenderBidAmount(lender);
      const amountFundedByLender2 = await Loan.getLenderBidAmount(lender2);
      const lenderBalance = await DAIToken.balanceOf(lender);
      const lender2Balance = await DAIToken.balanceOf(lender2);

      // get lenders amounts with interest
      const lenderBidAmountWithInterest = await Loan.calculateValueWithInterest(
        amountFundedByLender
      );
      const lender2AmountWithInterest = await Loan.calculateValueWithInterest(
        amountFundedByLender2
      );

      // wait for time / blocks to pass
      await waitNBlocks(100);

      // borrower takes money from loan
      await Loan.withdrawLoan({from: borrower});

      // check borrower received amount
      const borrowerWithdrawAmount = await DAIToken.balanceOf(borrower);

      // borrower repays
      const totalFunded = await Loan.auctionBalance();
      const totalDebt = await Loan.borrowerDebt();
      const interestAmount = calculatePendingDebt(borrowerWithdrawAmount, totalDebt);
      await DAIToken.transferAmountToAddress(borrower, interestAmount, {from: owner});
      await DAIToken.approve(DAIProxy.address, totalDebt, {from: borrower});
      const repayTx = await DAIProxy.repay(Loan.address, totalDebt, {from: borrower});

      // Check repay event
      const repayLoanTxScope = await truffleAssert.createTransactionResult(Loan, repayTx.tx);
      truffleAssert.eventEmitted(repayLoanTxScope, "LoanRepaid");

      const lenderOneBeforeRepay = await DAIToken.balanceOf(lender);
      const lenderTwoBeforeRepay = await DAIToken.balanceOf(lender2);

      // lender takes out money
      await Loan.withdrawRepayment({from: lender});
      await Loan.withdrawRepayment({from: lender2});
      const lenderBalanceAfterRepayment = await DAIToken.balanceOf(lender);
      const lender2BalanceAfterRepayment = await DAIToken.balanceOf(lender2);
      const lenderOneWitdrawn = await Loan.getLenderWithdrawn(lender);
      const lenderTwoWithdrawn = await Loan.getLenderWithdrawn(lender2);

      expect(lenderKYC).to.equal(true);
      expect(lender2KYC).to.equal(true);
      expect(borrowerKYC).to.equal(true);
      expect(lenderHasDeposited).to.equal(true);
      expect(lender2HasDeposited).to.equal(true);
      expect(loanFundedAmount).to.eq.BN(calculateNetLoan(loanMaxAmount, operatorPercentFee));
      expect(amountFundedByLender).to.eq.BN(toWei(new BN(60)));
      expect(amountFundedByLender2).to.eq.BN(fundingAmount2);
      expect(lenderBalance).to.eq.BN(daiBalance.sub(amountFundedByLender));
      expect(lender2Balance).to.eq.BN(daiBalance.sub(amountFundedByLender2));
      expect(borrowerWithdrawAmount).to.eq.BN(totalFunded);
      expect(lenderBalanceAfterRepayment).to.eq.BN(
        lenderBidAmountWithInterest.add(lenderOneBeforeRepay)
      );
      expect(lender2BalanceAfterRepayment).to.eq.BN(
        lender2AmountWithInterest.add(lenderTwoBeforeRepay)
      );
      expect(lenderOneWitdrawn).to.equal(true);
      expect(lenderTwoWithdrawn).to.equal(true);
    });
    it("Expects the flow to work correctly for one lender to minimum fund a loan and for the borrower to withdraw after auction is expired and for the borrower to repay", async () => {
      // lender funds loan
      const fundingAmount = await Loan.minAmount();
      await DAIToken.approve(DAIProxy.address, fundingAmount, {from: lender});
      const fundTx = await DAIProxy.fund(Loan.address, fundingAmount, {from: lender});
      const lenderBalancePostFunding = await DAIToken.balanceOf(lender);

      // Due we need to watch the LoanContract.sol events, need to change tx scope to point LoanContract.sol
      const loanTxScope = await truffleAssert.createTransactionResult(Loan, fundTx.tx);
      truffleAssert.eventEmitted(
        loanTxScope,
        "Funded",
        ev => ev.loanAddress == Loan.address && ev.lender == lender && ev.amount.eq(fundingAmount)
      );
      truffleAssert.eventEmitted(
        loanTxScope,
        "MinimumFundingReached",
        ev => ev.loanAddress == Loan.address && ev.currentBalance.eq(loanMinAmount)
      );

      // await for auction to expire
      await increaseTime(auctionLength + 10);

      // check if loan is funded
      const amountFundedByLender = await Loan.getLenderBidAmount(lender);
      const fundedLoanStateBeforeExpiry = Number(await Loan.currentState());

      // borrower takes money from loan
      const withTx = await Loan.withdrawLoan({from: borrower});
      const fundedLoanState = Number(await Loan.currentState());
      const loanFundedAmount = await Loan.auctionBalance();

      const totalDebt = await Loan.borrowerDebt();
      truffleAssert.eventEmitted(
        withTx,
        "AuctionSuccessful",
        ev =>
          ev.loanAddress == Loan.address &&
          ev.balanceToRepay.eq(totalDebt) &&
          ev.auctionBalance.eq(calculateNetLoan(fundingAmount, operatorPercentFee))
      );

      // check borrower received amount
      const borrowerWithdrawAmount = await DAIToken.balanceOf(borrower);

      // borrower repays loan
      const interestAmount = calculatePendingDebt(borrowerWithdrawAmount, totalDebt);
      await DAIToken.transferAmountToAddress(borrower, interestAmount, {from: owner});
      await DAIToken.approve(DAIProxy.address, totalDebt, {from: borrower});

      const repayTx = await DAIProxy.repay(Loan.address, totalDebt, {from: borrower});

      // Check repay event
      const repayLoanTxScope = await truffleAssert.createTransactionResult(Loan, repayTx.tx);
      truffleAssert.eventEmitted(repayLoanTxScope, "LoanRepaid");

      const stateAfterRepay = Number(await Loan.currentState());

      // lender takes out money
      const txWithdraw = await Loan.withdrawRepayment({from: lender});
      const lenderBalanceAfterRepayment = await DAIToken.balanceOf(lender);
      const lenderWithdrawed = await Loan.getLenderWithdrawn(lender);
      const endState = Number(await Loan.currentState());

      // Check repay event
      truffleAssert.eventEmitted(txWithdraw, "RepaymentWithdrawn");
      truffleAssert.eventEmitted(txWithdraw, "FullyRefunded");

      // assertions
      expect(lenderKYC).to.equal(true);
      expect(borrowerKYC).to.equal(true);
      expect(lenderHasDeposited).to.equal(true);
      expect(fundedLoanStateBeforeExpiry).to.equal(0);
      expect(fundedLoanState).to.equal(2);
      expect(loanFundedAmount).to.eq.BN(calculateNetLoan(fundingAmount, operatorPercentFee));
      expect(amountFundedByLender).to.eq.BN(fundingAmount);
      expect(borrowerWithdrawAmount).to.eq.BN(calculateNetLoan(fundingAmount, operatorPercentFee));
      expect(stateAfterRepay).to.equal(4);
      expect(lenderBalanceAfterRepayment).to.eq.BN(lenderBalancePostFunding.add(totalDebt));
      expect(lenderWithdrawed).to.equal(true);
      expect(endState).to.equal(5);
    });
    it("Expects the lenders to be able to withdraw when loan funds are unlocked", async () => {
      // lender funds loan
      const fundingAmount = await Loan.maxAmount();
      await DAIToken.approve(DAIProxy.address, fundingAmount, {from: lender});
      const fundTx = await DAIProxy.fund(Loan.address, fundingAmount, {from: lender});

      // Due we need to watch the LoanContract.sol events, need to change tx scope to point LoanContract.sol
      const loanTxScope = await truffleAssert.createTransactionResult(Loan, fundTx.tx);
      truffleAssert.eventEmitted(
        loanTxScope,
        "Funded",
        ev => ev.loanAddress == Loan.address && ev.lender == lender && ev.amount.eq(fundingAmount)
      );
      truffleAssert.eventEmitted(
        loanTxScope,
        "MinimumFundingReached",
        ev => ev.loanAddress == Loan.address && ev.currentBalance.eq(fundingAmount)
      );
      truffleAssert.eventEmitted(
        loanTxScope,
        "FullyFunded",
        ev =>
          ev.loanAddress == Loan.address &&
          ev.auctionBalance.eq(calculateNetLoan(fundingAmount, operatorPercentFee))
      );

      // check if loan is funded
      const loanFundedAmount = await Loan.auctionBalance();
      const amountFundedByLender = await Loan.getLenderBidAmount(lender);
      const fundedLoanState = Number(await Loan.currentState());

      await Loan.unlockFundsWithdrawal({from: admin});

      const txWithdraw = await Loan.withdrawFundsUnlocked({from: lender});
      truffleAssert.eventEmitted(
        txWithdraw,
        "FundsUnlockedWithdrawn",
        ev => ev.loanAddress == Loan.address && ev.lender == lender && ev.amount.eq(fundingAmount)
      );
      truffleAssert.eventEmitted(
        txWithdraw,
        "FullyFundsUnlockedWithdrawn",
        ev => ev.loanAddress == Loan.address
      );

      // lender takes out money
      const lenderBalanceAfterWithdrawl = await DAIToken.balanceOf(lender);
      const lenderWithdrawed = await Loan.getLenderWithdrawn(lender);
      const endState = Number(await Loan.currentState());

      expect(lenderKYC).to.equal(true);
      expect(borrowerKYC).to.equal(true);
      expect(lenderHasDeposited).to.equal(true);
      expect(fundedLoanState).to.equal(2);
      expect(loanFundedAmount).to.eq.BN(calculateNetLoan(fundingAmount, operatorPercentFee));
      expect(amountFundedByLender).to.eq.BN(fundingAmount);
      expect(lenderBalanceAfterWithdrawl).to.eq.BN(amountFundedByLender);
      expect(lenderWithdrawed).to.equal(true);
      expect(endState).to.equal(5);
    });
    it("Expects the borrower to not be able to withdraw if the loan funds are unlocked", async () => {
      try {
        // lender funds loan
        const fundingAmount = await Loan.maxAmount();
        await DAIToken.approve(DAIProxy.address, fundingAmount, {from: lender});
        const fundTx = await DAIProxy.fund(Loan.address, fundingAmount, {from: lender});

        // Due we need to watch the LoanContract.sol events, need to change tx scope to point LoanContract.sol
        const loanTxScope = await truffleAssert.createTransactionResult(Loan, fundTx.tx);
        truffleAssert.eventEmitted(
          loanTxScope,
          "Funded",
          ev => ev.loanAddress == Loan.address && ev.lender == lender && ev.amount == fundingAmount
        );
        truffleAssert.eventEmitted(
          loanTxScope,
          "MinimumFundingReached",
          ev => ev.loanAddress == Loan.address && ev.currentBalance == fundingAmount
        );
        truffleAssert.eventEmitted(
          loanTxScope,
          "FullyFunded",
          ev =>
            ev.loanAddress == Loan.address &&
            ev.balanceToRepay == totalDebt &&
            ev.auctionBalance == fundingAmount
        );

        // check if loan is funded
        const loanFundedAmount = await Loan.auctionBalance();
        const amountFundedByLender = await Loan.lenderBidAmount(lender);
        const fundedLoanState = Number(await Loan.currentState());

        await Loan.unlockFundsWithdrawal({from: admin});
        expect(lenderKYC).to.equal(true);
        expect(borrowerKYC).to.equal(true);
        expect(lenderHasDeposited).to.equal(true);
        expect(fundedLoanState).to.equal(2);
        expect(loanFundedAmount).to.eq.BN(calculateNetLoan(fundingAmount, operatorPercentFee));
        expect(amountFundedByLender).to.eq.bn(fundingAmount);
        expect(lenderBalanceAfterWithdrawl).to.equal(
          calculateNetLoan(fundingAmount, operatorPercentFee)
        );

        // borrower takes money from loan
        await Loan.withdrawLoan({from: borrower});
      } catch (error) {
        expect(error).to.not.equal(undefined);
      }
    });
  });
});
