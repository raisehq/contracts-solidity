const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
chai.use(chaiAsPromised)
const truffleAssert = require('truffle-assertions')
const { expect } = chai;
const web3 = global.web3;
const DAIProxyContract = artifacts.require('DAIProxy');
const HeroFakeTokenContract = artifacts.require('HeroFakeToken');
const LoanContract = artifacts.require('LoanContract');
const AuthContract = artifacts.require('Authorization');
const DepositRegistryContract = artifacts.require('DepositRegistry');
const KYCContract = artifacts.require('KYCRegistry');

const LoanContractDispatcherContract = artifacts.require('LoanContractDispatcher');

// mine blocks so it passes "time"
const { waitNBlocks } = require('./helpers');


contract('Integration', (accounts) => {
    let DAIProxy;
    let DAIToken;
    let HeroToken;
    let DepositRegistry;
    let Auth;
    let KYCRegistry;
    let LoanDispatcher

    const owner = accounts[0];
    const lender = accounts[1];
    const borrower = accounts[2];
    const lender2 = accounts[3];
    const lender3 = accounts[4];

    const averageMiningBlockTime = 15;
    
    describe('Test the full flow with the actual contracts', () => {
        let lenderKYC;
        let lender2KYC;
        let lender3KYC;
        let borrowerKYC;
        let lenderHasDeposited;
        let lender2HasDeposited;
        let lender3HasDeposited;
        let Loan;
        beforeEach(async () => {
            DAIToken = await HeroFakeTokenContract.new({from: owner});
            HeroToken = await HeroFakeTokenContract.new({from: owner});
            await HeroToken.transferFakeHeroTokens(lender, {from: owner});
            await HeroToken.transferFakeHeroTokens(lender2, {from: owner});
            await HeroToken.transferFakeHeroTokens(lender3, {from: owner});
            
            // adding lender and borrower to KYC
            KYCRegistry = await KYCContract.new();
            await KYCRegistry.add(lender);
            await KYCRegistry.add(lender2);
            await KYCRegistry.add(lender3);
            await KYCRegistry.add(borrower);
            
            // give permision to the deposit registry to deposit tokens instead of the lender
            DepositRegistry = await DepositRegistryContract.new(HeroToken.address,  { from: owner});

            await HeroToken.approve(DepositRegistry.address, 200, { from: lender });
            await HeroToken.approve(DepositRegistry.address, 200, { from: lender2 });
            await HeroToken.approve(DepositRegistry.address, 200, { from: lender3 });
            
            await DepositRegistry.depositFor(lender, {from: owner});
            await DepositRegistry.depositFor(lender2, {from: owner});
            await DepositRegistry.depositFor(lender3, {from: owner});
            
            // initialize proxies for lender and borrower
            Auth = await AuthContract.new(KYCRegistry.address, DepositRegistry.address);
            DAIProxy = await DAIProxyContract.new(Auth.address, DAIToken.address, {from: owner});

            // check KYC and Deposit
            lenderKYC = await Auth.isKYCConfirmed(lender);
            lender2KYC = await Auth.isKYCConfirmed(lender2);
            lender3KYC = await Auth.isKYCConfirmed(lender3);
            borrowerKYC = await Auth.isKYCConfirmed(borrower);

            lenderHasDeposited = await Auth.hasDeposited(lender);
            lender2HasDeposited = await Auth.hasDeposited(lender2);
            lender3HasDeposited = await Auth.hasDeposited(lender3);


            // initialize loan contract dispatcher
            LoanDispatcher = await LoanContractDispatcherContract.new(Auth.address, DAIToken.address, DAIProxy.address, {from:owner});

            // Setup DAI amounts
            const daiBalance = 100;
            await DAIToken.transferAmountToAddress(lender, daiBalance, {from: owner});
            await DAIToken.transferAmountToAddress(lender2, daiBalance, {from: owner});
            await DAIToken.transferAmountToAddress(lender3, daiBalance, {from: owner});

            // borrower creates loan
            const currentBlock = await web3.eth.getBlock('latest');
            const auctionLengthBlock = (60 * 60) / averageMiningBlockTime; // 1 hour in blocktime
            const loanRepaymentTime = currentBlock.timestamp + (2 * 60 * 60); // 2 hours in seconds
            const loanMinAmount = 90;
            const loanMaxAmount = 100;
            const bpMaxInterestRate = 5000;

            await LoanDispatcher.deploy(
                auctionLengthBlock,
                loanMinAmount,
                loanMaxAmount,
                bpMaxInterestRate,
                loanRepaymentTime,
                {from: borrower}
            );

            const loanEventHistory = await LoanDispatcher.getPastEvents('LoanContractCreated'); // {fromBlock: 0, toBlock: "latest"} put this to get all
            const loanAddress = loanEventHistory[0].returnValues.contractAddress;
            
            // create loan instance from Loan.address
            Loan = await LoanContract.at(loanAddress);
        });
        it('Expects the flow to work correctly for one lender to fully fund a loan and for the borrower to repay', async () => {
            // lender funds loan
            const fundingAmount = Number(await Loan.maxAmount()); 
            await DAIToken.approve(DAIProxy.address, fundingAmount, { from: lender });
            const fundTx = await DAIProxy.fund(Loan.address, fundingAmount, {from: lender});

            const totalDebt = Number(await Loan.borrowerDebt());
            
            // Due we need to watch the LoanContract.sol events, need to change tx scope to point LoanContract.sol
            const loanTxScope = await truffleAssert.createTransactionResult(Loan, fundTx.tx);
            truffleAssert.eventEmitted(loanTxScope, 'Funded', (ev) => ev.loanAddress == Loan.address && ev.lender == lender && ev.amount == fundingAmount);
            truffleAssert.eventEmitted(loanTxScope, 'MinimumFundingReached', (ev) => ev.loanAddress == Loan.address && ev.currentBalance == fundingAmount);
            truffleAssert.eventEmitted(loanTxScope, 'FullyFunded', (ev) => ev.loanAddress == Loan.address && ev.balanceToRepay == totalDebt && ev.auctionBalance == fundingAmount);

            // check if loan is funded
            const loanFundedAmount = await Loan.auctionBalance();
            const amountFundedByLender = await Loan.lenderBidAmount(lender);
            const fundedLoanState = Number(await Loan.currentState());

            // borrower takes money from loan
            await Loan.withdrawLoan(borrower, {from: borrower}); 
            
            // check borrower received amount
            const borrowerWithdrawAmount = await DAIToken.balanceOf(borrower);
            
            // borrower repays loan
            const interestAmount = totalDebt - fundingAmount;
            await DAIToken.transferAmountToAddress(borrower, interestAmount, {from: owner});
            await DAIToken.approve(DAIProxy.address, totalDebt, { from: borrower });
            const repayTx = await DAIProxy.repay(Loan.address, totalDebt, {from: borrower});
            
            // Check repay event
            const repayLoanTxScope = await truffleAssert.createTransactionResult(Loan, repayTx.tx);
            truffleAssert.eventEmitted(repayLoanTxScope, 'LoanRepaid');

            const stateAfterRepay = Number(await Loan.currentState())

            // lender takes out money
            const txWithdraw = await Loan.withdrawRepayment(lender, {from: lender});
            const lenderBalanceAfterRepayment = await DAIToken.balanceOf(lender);
            const lenderWithdrawed = await Loan.lenderWithdrawn(lender);
            const endState = Number(await Loan.currentState())

            // Check repay event
            truffleAssert.eventEmitted(txWithdraw, 'RepaymentWithdrawn');
            truffleAssert.eventEmitted(txWithdraw, 'FullyRefunded');

            // assertions
            expect(lenderKYC).to.equal(true);
            expect(borrowerKYC).to.equal(true);
            expect(lenderHasDeposited).to.equal(true);
            expect(fundedLoanState).to.equal(2);
            expect(Number(loanFundedAmount)).to.equal(fundingAmount);
            expect(Number(amountFundedByLender)).to.equal(fundingAmount);
            expect(Number(borrowerWithdrawAmount)).to.equal(fundingAmount);
            expect(stateAfterRepay).to.equal(4);
            expect(Number(lenderBalanceAfterRepayment)).to.equal(totalDebt);
            expect(lenderWithdrawed).to.equal(true);
            expect(endState).to.equal(5);
        });
        it('Expects to work for 3 diff lenders with overflow and borrower repays in time', async () => {
            // wait for time / blocks to pass
            await waitNBlocks(100);
            
            // lenders funds loan
            const fundingAmount = 50;
            const fundingAmount2 = 40;
            const fundingAmount3 = 100;
            await DAIToken.approve(DAIProxy.address, fundingAmount, { from: lender });
            await DAIToken.approve(DAIProxy.address, fundingAmount2, { from: lender2 });
            await DAIToken.approve(DAIProxy.address, fundingAmount3, { from: lender3 });
            await DAIProxy.fund(Loan.address, fundingAmount, {from: lender});
            await DAIProxy.fund(Loan.address, fundingAmount2, {from: lender2});
            await DAIProxy.fund(Loan.address, fundingAmount3, {from: lender3});
            
            // check if loan is funded
            const loanFundedAmount = await Loan.auctionBalance();
            const amountFundedByLender = await Loan.lenderBidAmount(lender);
            const amountFundedByLender2 = await Loan.lenderBidAmount(lender2);
            const amountFundedByLender3 = await Loan.lenderBidAmount(lender3);               
            const lenderBalance = await DAIToken.balanceOf(lender);               
            const lender2Balance = await DAIToken.balanceOf(lender2);                
            const lender3Balance = await DAIToken.balanceOf(lender3);
            
            // get lenders amounts with interest
            const lenderBidAmountWithInterest = await Loan.calculateValueWithInterest(amountFundedByLender);
            const lender2AmountWithInterest = await Loan.calculateValueWithInterest(amountFundedByLender2);
            const lender3AmountWithInterest = await Loan.calculateValueWithInterest(amountFundedByLender3);


            // borrower takes money from loan
            await Loan.withdrawLoan(borrower, {from: borrower}); 
            
            // borrower current debt with interests
            const totalDebt = Number(await Loan.borrowerDebt());
            const totalFunded = Number(await Loan.auctionBalance());

            // check borrower received amount
            const borrowerWithdrawAmount = await DAIToken.balanceOf(borrower);

            // borrower repays
            const interestAmount = totalDebt - totalFunded;
            await DAIToken.transferAmountToAddress(borrower, interestAmount, {from: owner});
            await DAIToken.approve(DAIProxy.address, totalDebt, { from: borrower });
            const repayTx = await DAIProxy.repay(Loan.address, totalDebt, {from: borrower});
        
            // Check repay event
            const repayLoanTxScope = await truffleAssert.createTransactionResult(Loan, repayTx.tx);
            truffleAssert.eventEmitted(repayLoanTxScope, 'LoanRepaid');

            const lenderOneBeforeRepay = await DAIToken.balanceOf(lender);
            const lenderTwoBeforeRepay = await DAIToken.balanceOf(lender2);
            const lenderThreeBeforeRepay = await DAIToken.balanceOf(lender3)
            // lender takes out money
            await Loan.withdrawRepayment(lender, {from: lender});
            await Loan.withdrawRepayment(lender2, {from: lender2});
            await Loan.withdrawRepayment(lender3, {from: lender3});
            const lenderBalanceAfterRepayment = await DAIToken.balanceOf(lender);
            const lender2BalanceAfterRepayment = await DAIToken.balanceOf(lender2);
            const lender3BalanceAfterRepayment = await DAIToken.balanceOf(lender3);
            const lendedOneWithdrawn = await Loan.lenderWithdrawn(lender);
            const lenderTwoWithdrawn = await Loan.lenderWithdrawn(lender2);
            const lenderThreeWithdrawn = await Loan.lenderWithdrawn(lender3);

            expect(lenderKYC).to.equal(true);
            expect(lender2KYC).to.equal(true);
            expect(lender3KYC).to.equal(true);
            expect(borrowerKYC).to.equal(true);
            expect(lenderHasDeposited).to.equal(true);
            expect(lender2HasDeposited).to.equal(true);
            expect(lender3HasDeposited).to.equal(true);
            expect(Number(loanFundedAmount)).to.equal(100);
            expect(Number(amountFundedByLender)).to.equal(50);
            expect(Number(amountFundedByLender2)).to.equal(40);
            expect(Number(amountFundedByLender3)).to.equal(10);
            expect(Number(lenderBalance)).to.equal(50);
            expect(Number(lender2Balance)).to.equal(60);
            expect(Number(lender3Balance)).to.equal(90);
            expect(Number(borrowerWithdrawAmount)).to.equal(100);
            expect(Number(lenderBalanceAfterRepayment)).to.equal(Number(lenderBidAmountWithInterest) + Number(lenderOneBeforeRepay));
            expect(Number(lender2BalanceAfterRepayment)).to.equal(Number(lender2AmountWithInterest) + Number(lenderTwoBeforeRepay));
            expect(Number(lender3BalanceAfterRepayment)).to.equal(Number(lender3AmountWithInterest) + Number(lenderThreeBeforeRepay));
            expect(lendedOneWithdrawn).to.equal(true);
            expect(lenderTwoWithdrawn).to.equal(true);
            expect(lenderThreeWithdrawn).to.equal(true);
        });
        it('Expects to work for 2 diff lenders with one of them doing 2 lendings and borrower repays in time', async () => {
            // lenders funds loan
            const fundingAmount = 50;
            const fundingAmount2 = 40;
            const fundingAmount3 = 50;
            await DAIToken.approve(DAIProxy.address, fundingAmount + fundingAmount3, { from: lender });
            await DAIToken.approve(DAIProxy.address, fundingAmount2, { from: lender2 });
            await DAIProxy.fund(Loan.address, fundingAmount, {from: lender});
            await DAIProxy.fund(Loan.address, fundingAmount2, {from: lender2});
            await DAIProxy.fund(Loan.address, fundingAmount3, {from: lender});
            
            // check if loan is funded
            const loanFundedAmount = await Loan.auctionBalance();
            const amountFundedByLender = await Loan.lenderBidAmount(lender);
            const amountFundedByLender2 = await Loan.lenderBidAmount(lender2);               
            const lenderBalance = await DAIToken.balanceOf(lender);               
            const lender2Balance = await DAIToken.balanceOf(lender2);     
            
            // get lenders amounts with interest
            const lenderBidAmountWithInterest = await Loan.calculateValueWithInterest(amountFundedByLender);
            const lender2AmountWithInterest = await Loan.calculateValueWithInterest(amountFundedByLender2);

            // wait for time / blocks to pass
            await waitNBlocks(100);

            // borrower takes money from loan
            await Loan.withdrawLoan(borrower, {from: borrower}); 
            
            // check borrower received amount
            const borrowerWithdrawAmount = await DAIToken.balanceOf(borrower);

            // borrower repays
            const totalDebt = Number(await Loan.borrowerDebt());
            const totalFunded = Number(await Loan.auctionBalance());
            const interestAmount = totalDebt - totalFunded;
            await DAIToken.transferAmountToAddress(borrower, interestAmount, {from: owner});
            await DAIToken.approve(DAIProxy.address, totalDebt, { from: borrower });
            const repayTx = await DAIProxy.repay(Loan.address, totalDebt, {from: borrower});
            
            // Check repay event
            const repayLoanTxScope = await truffleAssert.createTransactionResult(Loan, repayTx.tx);
            truffleAssert.eventEmitted(repayLoanTxScope, 'LoanRepaid');

            const lenderOneBeforeRepay = await DAIToken.balanceOf(lender);
            const lenderTwoBeforeRepay = await DAIToken.balanceOf(lender2);

            // lender takes out money
            await Loan.withdrawRepayment(lender, {from: lender});
            await Loan.withdrawRepayment(lender2, {from: lender2});
            const lenderBalanceAfterRepayment = await DAIToken.balanceOf(lender);
            const lender2BalanceAfterRepayment = await DAIToken.balanceOf(lender2);
            const lenderOneWitdrawn = await Loan.lenderWithdrawn(lender);
            const lenderTwoWithdrawn = await Loan.lenderWithdrawn(lender2);

            expect(lenderKYC).to.equal(true);
            expect(lender2KYC).to.equal(true);
            expect(borrowerKYC).to.equal(true);
            expect(lenderHasDeposited).to.equal(true);
            expect(lender2HasDeposited).to.equal(true);
            expect(Number(loanFundedAmount)).to.equal(100);
            expect(Number(amountFundedByLender)).to.equal(fundingAmount + (100 - fundingAmount - fundingAmount2));
            expect(Number(amountFundedByLender2)).to.equal(fundingAmount2);
            expect(Number(lenderBalance)).to.equal(40);
            expect(Number(lender2Balance)).to.equal(60);
            expect(Number(borrowerWithdrawAmount)).to.equal(totalFunded);
            expect(Number(lenderBalanceAfterRepayment)).to.equal(Number(lenderBidAmountWithInterest) + Number(lenderOneBeforeRepay));
            expect(Number(lender2BalanceAfterRepayment)).to.equal(Number(lender2AmountWithInterest) + Number(lenderTwoBeforeRepay));
            expect(lenderOneWitdrawn).to.equal(true);
            expect(lenderTwoWithdrawn).to.equal(true);
        });
    });
});