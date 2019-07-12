const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const { expect } = chai;
const truffleAssert = require('truffle-assertions');
const DAIProxyContract = artifacts.require('DAIProxyMock');
const HeroFakeTokenContract = artifacts.require('HeroFakeToken');
const LoanContract = artifacts.require('LoanContract');

const helpers = require('./helpers.js');

contract('LoanContract', (accounts) => {
    let DAIProxy;
    let DAIToken;
    let Loan;

    const averageMiningBlockTime = 15;

    const owner = accounts[0];
    const lender = accounts[1];
    const borrower = accounts[2];
    const admin = accounts[3];

    describe('Unit tests for LoanContract', () => {
        let loanAmount;
        let maxInterestRate;
        let auctionBlockLength; 
        let termEndTimestamp;
        let currentBlock;
        beforeEach(async () => {
            try {
                DAIToken = await HeroFakeTokenContract.new({from: owner});
                await DAIToken.transferAmountToAddress(lender, 150, {from: owner});
                await DAIToken.transferAmountToAddress(borrower, 200, {from: owner});
                DAIProxy = await DAIProxyContract.new(DAIToken.address, {from: owner});
            
                currentBlock = await web3.eth.getBlock('latest');

                // Set Loan variables
                minAmount = 80;
                maxAmount = 100;
                maxInterestRate = 3000;
                auctionBlockLength = (60 * 60) / averageMiningBlockTime; // 1 hour in seconds
                termEndTimestamp = currentBlock.timestamp + (2 * 60 * 60); // 2 hours in seconds
            } catch (error) {
                throw error;
            }
        });
        describe('Method onFundingReceived', () => {
            beforeEach(async () => {
                Loan = await LoanContract.new(
                    auctionBlockLength,
                    termEndTimestamp,
                    minAmount,
                    maxAmount,
                    maxInterestRate,
                    borrower,
                    DAIToken.address, 
                    DAIProxy.address,
                    admin
                );
            });
            it('Expect onFundingReceived to revert if caller is NOT DaiProxy', async () => {
                try {
                    // LoanContract state should start with CREATED == 0
                    const firstState = await Loan.currentState();
                    expect(Number(firstState)).to.equal(0);

                    await Loan.onFundingReceived(lender, 100);
                } catch (error) {
                    expect(error).to.not.equal(undefined);
                }
            });
            it('Expects Lender to be able to partially fund a Loan in CREATED state.', async () => {
                try {
                    // LoanContract state should start with CREATED == 0
                    const firstState = await Loan.currentState();
                    expect(Number(firstState)).to.equal(0);

                    await DAIToken.approve(DAIProxy.address, 50, { from: lender });
                    await DAIProxy.fund(Loan.address, 50, {from: lender});
                    
                    // Loan state after funding
                    const loanState = await Loan.currentState();
                    // Subscribe to events
                    const auctionBalanceAmount = await Loan.auctionBalance({from: owner});
                    const fundedByLender = await Loan.lenderBidAmount(lender, {from: owner});

                    expect(Number(fundedByLender)).to.equal(50);
                    expect(Number(auctionBalanceAmount)).to.equal(50);

                    // LoanContract state should still be CREATED == 0, due is partially funded
                    expect(Number(loanState)).to.equal(0);
                } catch (error) {
                    expect(error).to.equal(undefined);
                }
            });
            it('Expects Lender to be able to fully fund a Loan and mutate from CREATED to ACTIVE state.', async () => {
                try {
                    // LoanContract state should start with CREATED == 0
                    const firstState = await Loan.currentState();
                    expect(Number(firstState)).to.equal(0);

                    await DAIToken.approve(DAIProxy.address, 100, { from: lender });
                    await DAIProxy.fund(Loan.address, 100, {from: lender});
                    
                    // Loan state after funding
                    const loanState = await Loan.currentState();
                    // Subscribe to events
                    const auctionBalanceAmount = await Loan.auctionBalance({from: owner});

                    const fundedByLender = await Loan.lenderBidAmount(lender, {from: owner});
                    
                    expect(Number(fundedByLender)).to.equal(100);
                    expect(Number(auctionBalanceAmount)).to.equal(100);

                    // LoanContract state should mutate to ACTIVE == 2
                    expect(Number(loanState)).to.equal(2);
                } catch (error) {
                    console.log(error)
                    expect(error).to.equal(undefined);
                }
            });
            it('Expects Lender to be able to send bigger funds to Loan, only loan amunt needed, and mutate from CREATED to ACTIVE state', async () => {
                try {
                    // LoanContract state should start with CREATED == 0
                    const firstState = await Loan.currentState();
                    expect(Number(firstState)).to.equal(0);

                    await DAIToken.approve(DAIProxy.address, 150, { from: lender });
                    await DAIProxy.fund(Loan.address, 150, {from: lender});
                    
                    const lenderAfterBalance = await DAIToken.balanceOf(lender);

                    // Loan state after funding
                    const loanState = await Loan.currentState();

                    // Subscribe to events
                    const auctionBalanceAmount = await Loan.auctionBalance({from: owner});
                    const fundedByLender = await Loan.lenderBidAmount(lender, {from: owner});
                    
                    expect(Number(fundedByLender)).to.equal(100);
                    expect(Number(auctionBalanceAmount)).to.equal(100);
                    expect(Number(lenderAfterBalance)).to.equal(50);

                    // LoanContract state should mutate to ACTIVE == 2
                    expect(Number(loanState)).to.equal(2);
                } catch (error) {
                    console.log('the error is:: ', error)
                    expect(error).to.equal(undefined);
                }
            });
            it('Expects Lender to NOT be able to fund after state is ACTIVE', async () => {
                try {
                    // LoanContract state should start with CREATED == 0
                    const firstState = await Loan.currentState();
                    expect(Number(firstState)).to.equal(0);
                    
                    // First, lender fully fund the Loan.
                    await DAIToken.approve(DAIProxy.address, 100, { from: lender });
                    await DAIProxy.fund(Loan.address, 100, {from: lender});

                    // LoanContract state  after fully funded should be  ACTIVE == 2
                        const secondState = await Loan.currentState();
                        expect(Number(secondState)).to.equal(2);
                    
                    // After is ACTIVE and fully funded, should not allow fund again the Loan.
                    await DAIToken.approve(DAIProxy.address, 50, { from: lender });
                    await truffleAssert.fails(
                        DAIProxy.fund(Loan.address, 50, {from: lender}),
                        truffleAssert.ErrorType.REVERT,
                        "Loan status is not CREATED"
                    );
                    

                    // Loan state after funding
                    const loanState = await Loan.currentState();
                    
                    // LoanContract state should STILL be ACTIVE == 2
                    expect(Number(loanState)).to.equal(2);
                    
                    // Lender should still have 50 bucks

                    const lenderAfterBalance = await DAIToken.balanceOf(lender);
                    // Subscribe to events
                    const auctionBalanceAmount = await Loan.auctionBalance({from: owner});
                    const fundedByLender = await Loan.lenderBidAmount(lender, {from: owner});
                    
                    // Check balances
                    expect(Number(fundedByLender)).to.equal(100);
                    expect(Number(auctionBalanceAmount)).to.equal(100);
                    expect(Number(lenderAfterBalance)).to.equal(50);
                } catch (error) {
                    console.log('the error is:: ', error)
                    expect(error).to.equal(undefined);
                }
            });
            it('Expects lender to NOT fund Loan if expires in time, mutating from CREATED to FAILED_TO_FUND', async () => {
                try {
                    const fundEndBlock = await Loan.auctionEndBlock();
                    const fundStartBlock = await Loan.auctionStartBlock();
                    const blocksToEnd =  Number(fundEndBlock) - Number(fundStartBlock);

                    // Contract init state should be CREATED
                    const initState = await Loan.currentState();
                    expect(Number(initState)).to.equal(0);

                    // Mine to end of funding
                    await helpers.waitNBlocks(blocksToEnd);

                    /**
                     * Contract state should still be CREATED, due Lender did not try 
                     * to fund or 3º party did not exec updateMachineState method 
                    */
                    const stateAfterDeadline = await Loan.currentState();
                    expect(Number(stateAfterDeadline)).to.equal(0);

                    // Try to fund the Loan
                    await DAIToken.approve(DAIProxy.address, 100, { from: lender });
                    await DAIProxy.fund(Loan.address, 100, {from: lender});

                    // Check Loan funds inside contract, should be ZERO
                    const auctionBalanceAmount = await Loan.auctionBalance({from: owner});
                    const loanRawTokens = await DAIToken.balanceOf(Loan.address, {from: owner});
                    expect(Number(auctionBalanceAmount)).to.equal(0);
                    expect(Number(loanRawTokens)).to.equal(0);

                    // Contract state should be mutated to FAILED_TO_FUND
                    const stateAfterFailedFund = await Loan.currentState();
                    expect(Number(stateAfterFailedFund)).to.equal(1);

                    // Lender ERC20 balance should still be 150
                    const lenderBalance = await DAIToken.balanceOf(lender, {from: lender });
                    expect(Number(lenderBalance)).to.equal(150);
                } catch (error) {
                    console.log('the error is:: ', error)
                    throw error;
                }

            });

        });
        describe('Method getUpdateState', () => {
            beforeEach(async () => {
                Loan = await LoanContract.new(
                    auctionBlockLength,
                    termEndTimestamp,
                    minAmount,
                    maxAmount,
                    maxInterestRate,
                    borrower,
                    DAIToken.address, 
                    DAIProxy.address,
                    admin
                );
            });
            it('Expects updateMachineState method to mutate Loan state from CREATED to FAILED_TO_FUND,  if funding is time expired ', async () => {
                try {
                    const fundEndBlock = await Loan.auctionEndBlock();
                    const fundStartBlock = await Loan.auctionStartBlock();
                    const blocksToEnd =  Number(fundEndBlock) - Number(fundStartBlock);

                    // Contract init state should be CREATED
                    const initState = await Loan.currentState();
                    expect(Number(initState)).to.equal(0);

                    console.log(fundEndBlock)
                    // Mine to end of funding
                    await helpers.waitNBlocks(blocksToEnd + 1);

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
                    console.log('the error is:: ', error)
                    throw error;
                }
            });
            it('Expects updateMachineState method to NOT mutate Loan state if state is CREATED and is not expired', async () => {
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
                    console.log('the error is:: ', error)
                    throw error;
                }
            });
            it('Expects updateMachineState method to NOT mutate from FAILED_TO_FUND state', async () => {
                try {
                    // Contract init state should be CREATED
                    const fundEndBlock = await Loan.auctionEndBlock();
                    const fundStartBlock = await Loan.auctionStartBlock();
                    const blocksToEnd =  Number(fundEndBlock) - Number(fundStartBlock);

                    // Mine to end of funding
                    await helpers.waitNBlocks(blocksToEnd);

                    // Mutate the state to FAILED_TO_FUND via updateMachineState
                    const state = await Loan.updateStateMachine.sendTransaction({from: owner});

                    // Expect contract state to be FAILED_TO_FUND 
                    const stateAfterMethod = await Loan.currentState({from: owner});
                    expect(Number(stateAfterMethod)).to.equal(1);

                    // Try to mutate again the state to FAILED_TO_FUND via updateMachineState
                    await Loan.updateStateMachine({from: owner});

                    const endState = await Loan.currentState({from: owner});
                    expect(Number(endState)).to.equal(1);
                } catch (error) {
                    console.log('the error is:: ', error)
                    throw error;
                }
            });
            it('Expects updateMachineState method to NOT mutate from ACTIVE state if not defaulted', async () => {
                try {
                    await DAIToken.approve(DAIProxy.address, 100, { from: lender });
                    await DAIProxy.fund(Loan.address, 100, {from: lender});
                    
                    // Retrieve current state == ACTIVE
                    const stateAfterFund = await Loan.currentState({from: owner});
                    expect(Number(stateAfterFund)).to.equal(2);

                    // Try to mutate state when NOT defaulted
                    await Loan.updateStateMachine({from: owner});

                    // State should still be ACTIVE
                    const endState = await Loan.currentState({from: owner});
                    expect(Number(endState)).to.equal(2);
                } catch (error) {
                    console.log('the error is:: ', error)
                    throw error;
                }
            });
            it('Expects updateMachineState method to mutate from ACTIVE to DEFAULTED if repay expires', async () => {
                try {
                    await DAIToken.approve(DAIProxy.address, 100, { from: lender });
                    await DAIProxy.fund(Loan.address, 100, {from: lender});
                    
                    // Retrieve current state == ACTIVE
                    const stateAfterFund = await Loan.currentState({from: owner});
                    expect(Number(stateAfterFund)).to.equal(2);

                    const repayEndTimestamp = await Loan.termEndTimestamp();
                    const currentBlock = await web3.eth.getBlock('latest');
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
                    console.log('the error is:: ', error)
                    throw error;
                }
            });
        });
        describe('Method withdrawLoan', () => {
            beforeEach(async () => {
                Loan = await LoanContract.new(
                    auctionBlockLength,
                    termEndTimestamp,
                    minAmount,
                    maxAmount,
                    maxInterestRate,
                    borrower,
                    DAIToken.address, 
                    DAIProxy.address,
                    admin
                );
            });
            it('Expect withdrawLoan to allow Borrower take loan if state == ACTIVE', async () => {
                try {
                    const borrowerBalancePrior = await DAIToken.balanceOf(borrower);

                    await DAIToken.approve(DAIProxy.address, 100, { from: lender });
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
                } catch (error) {
                    throw error;
                }
            });
            it('Expect withdrawLoan to NOT allow Borrower take loan if state == REPAID', async () => {
                try {
                    const borrowerBalancePrior = await DAIToken.balanceOf(borrower);

                    await DAIToken.approve(DAIProxy.address, 100, { from: lender });
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
                    
                    const amountToRepay = Number (await Loan.borrowerDebt());
                    await DAIToken.approve(DAIProxy.address, amountToRepay, { from: borrower });
                    await DAIProxy.repay(Loan.address, amountToRepay, {from: borrower});
                    
                    const stateAfterDeadline = await Loan.currentState();
                    expect(Number(stateAfterDeadline)).to.equal(4);

                    await Loan.withdrawLoan({from: borrower});
                } catch (error) {
                    expect(error).to.not.equal(undefined);
                }
            });
            it('Expect withdrawLoan to NOT allow Borrower take loan if state == CREATED', async () => {
                try {
                    await Loan.withdrawLoan({from: borrower});
                } catch (error) {
                    expect(error).to.not.equal(undefined);
                }
            });
            it('Expect withdrawLoan to NOT allow Borrower take loan if state == FAILED_TO_FUND', async () => {
                try {
                    await DAIToken.approve(DAIProxy.address, 50, { from: lender });
                    await DAIProxy.fund(Loan.address, 50, {from: lender});

                    // Mine to end of funding
                    const fundEndBlock = await Loan.auctionEndBlock();
                    const currentBlock = await web3.eth.getBlockNumber();
                    const blocksToEnd =  Number(fundEndBlock) - Number(currentBlock);
                
                    await helpers.waitNBlocks(blocksToEnd + 100);
                    await Loan.updateStateMachine();
                    
                    const stateAfterDeadline = await Loan.currentState();
                    expect(Number(stateAfterDeadline)).to.equal(1);

                    await Loan.withdrawLoan({from: borrower});
                } catch (error) {
                    expect(error).to.not.equal(undefined);
                }
            });
            it('Expect withdrawLoan to NOT allow Borrower take loan if state == CLOSED', async  () => {
                try {
                    const borrowerBalancePrior = await DAIToken.balanceOf(borrower);

                    await DAIToken.approve(DAIProxy.address, 100, { from: lender });
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
                    
                    const amountToRepay = Number (await Loan.borrowerDebt());
                    await DAIToken.approve(DAIProxy.address, amountToRepay, { from: borrower });
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
            it('Expect withdrawLoan to NOT allow Borrower take loan if state == DEFAULTED', async () => {
                try {
                    auctionBlockLength = 30 / averageMiningBlockTime; // 1 min in seconds
                    termEndTimestamp = currentBlock.timestamp + 2 ;
                    Loan = await LoanContract.new(
                        auctionBlockLength,
                        termEndTimestamp,
                        minAmount,
                        maxAmount,
                        maxInterestRate,
                        borrower,
                        DAIToken.address, 
                        DAIProxy.address,
                        admin
                    );
                    await helpers.waitNBlocks(1000);
                    const isExpired = await Loan.isDefaulted();
                    expect(isExpired).to.equal(true);

                    await Loan.withdrawLoan({from: borrower});
                } catch (error) {
                    expect(error).to.not.equal(undefined);
                }
            });
            it('Expect withdrawLoan to Not allow Borrower take loan if state == FROZEN', async () => {
                try {
                    await Loan.unlockFundsWithdrawal({from: admin});
                    await Loan.withdrawLoan({from: borrower});
                } catch (error) {
                    expect(error).to.not.equal(undefined);
                }
            });
            it('Expect withdrawLoan to NOT allow Borrower take loan twice.', async () => {
                try {
                    const borrowerBalancePrior = await DAIToken.balanceOf(borrower);

                    await DAIToken.approve(DAIProxy.address, 100, { from: lender });
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
        describe('Method withdrawRepayment', () => {
            beforeEach(async () => {
                Loan = await LoanContract.new(
                    auctionBlockLength,
                    termEndTimestamp,
                    minAmount,
                    maxAmount,
                    maxInterestRate,
                    borrower,
                    DAIToken.address, 
                    DAIProxy.address,
                    admin
                );
            });
            it('Expect withdrawRepayment to allow Lender take repaid loan + interest if state == REPAID', async () => {
                try {
                    await DAIToken.approve(DAIProxy.address, 100, { from: lender });
                    await DAIProxy.fund(Loan.address, 100, {from: lender});
                    
                    // Retrieve current state == ACTIVE
                    const stateAfterFund = await Loan.currentState({from: owner});
                    expect(Number(stateAfterFund)).to.equal(2);

                    await Loan.withdrawLoan({from: borrower});

                    const amountToRepay = await Loan.borrowerDebt();
                    const borrowerBalancePrior = await DAIToken.balanceOf(borrower);

                    await DAIToken.approve(DAIProxy.address, amountToRepay, { from: borrower });
                    await DAIProxy.repay(Loan.address, amountToRepay, {from: borrower});

                    const borrowerBalanceAfter = await DAIToken.balanceOf(borrower);
                    // Fast way to check. TODO: Use BN.js to exact calc-
                    expect(Number(borrowerBalanceAfter)).equal(Number(borrowerBalancePrior) - Number(amountToRepay));

                    // State should change to REPAID
                    const endState = await Loan.currentState({from: owner});
                    expect(Number(endState)).to.equal(4);
                    const lenderAmount = await Loan.getLenderBidAmount(lender);
                    const lenderAmountWithInterest = await Loan.calculateValueWithInterest(lenderAmount);
                    const lenderBalanceBefore = await DAIToken.balanceOf(lender);
                    await Loan.withdrawRepayment({ from: lender });
                    const lenderBalanceAfter = await DAIToken.balanceOf(lender);
                    expect(Number(lenderBalanceAfter)).to.equal(Number(lenderBalanceBefore)+Number(lenderAmountWithInterest));
                } catch (error) {
                    expect(error).to.equal(undefined);
                }               
            });
            it('Expect withdrawRepayment to NOT allow Lender take repayament if state == CLOSED', async () => {
                try {
                    await DAIToken.approve(DAIProxy.address, 100, { from: lender });
                    await DAIProxy.fund(Loan.address, 100, {from: lender});
                    
                    // Retrieve current state == ACTIVE
                    const stateAfterFund = await Loan.currentState({from: owner});
                    expect(Number(stateAfterFund)).to.equal(2);

                    await Loan.withdrawLoan({from: borrower});

                    const amountToRepay = await Loan.borrowerDebt();
                    const borrowerBalancePrior = await DAIToken.balanceOf(borrower);

                    await DAIToken.approve(DAIProxy.address, amountToRepay, { from: borrower });
                    await DAIProxy.repay(Loan.address, amountToRepay, {from: borrower});

                    const borrowerBalanceAfter = await DAIToken.balanceOf(borrower);
                    // Fast way to check. TODO: Use BN.js to exact calc-
                    expect(Number(borrowerBalanceAfter)).equal(Number(borrowerBalancePrior) - Number(amountToRepay));

                    // State should change to REPAID
                    const endState = await Loan.currentState({from: owner});
                    expect(Number(endState)).to.equal(4);
                    const lenderAmount = await Loan.getLenderBidAmount(lender);
                    const lenderAmountWithInterest = await Loan.calculateValueWithInterest(lenderAmount);
                    const lenderBalanceBefore = await DAIToken.balanceOf(lender);
                    await Loan.withdrawRepayment({ from: lender });
                    const lenderBalanceAfter = await DAIToken.balanceOf(lender);
                    expect(Number(lenderBalanceAfter)).to.equal(Number(lenderBalanceBefore)+Number(lenderAmountWithInterest));

                    expect(Number(await Loan.currentState())).to.equal(5);
                    await Loan.withdrawRepayment({from: lender});
                } catch (error) {
                    expect(error).to.not.equal(undefined);
                }               
            });
            it('Expect withdrawRepayment to NOT allow Lender take repayament if state == CREATED', async () => {
                try {
                    await Loan.withdrawRepayment({from: lender});
                } catch (error) {
                    expect(error).to.not.equal(undefined);
                }
            });
            it('Expect withdrawRepayment to NOT allow Lender take repayament if state == FAILED_TO_FUND', async () => {
                try {
                    await DAIToken.approve(DAIProxy.address, 50, { from: lender });
                    await DAIProxy.fund(Loan.address, 50, {from: lender});

                    // Mine to end of funding
                    const fundEndBlock = await Loan.auctionEndBlock();
                    const currentBlock = await web3.eth.getBlockNumber();
                    const blocksToEnd =  Number(fundEndBlock) - Number(currentBlock);
                
                    await helpers.waitNBlocks(blocksToEnd + 100);
                    await Loan.updateStateMachine();
                    
                    const stateAfterDeadline = await Loan.currentState();
                    expect(Number(stateAfterDeadline)).to.equal(1);

                    await Loan.withdrawRepayment({from: lender});
                } catch (error) {
                    expect(error).to.not.equal(undefined);
                }
            });
            it('Expect withdrawRepayment to NOT allow Lender take repayament if state == DEFAULTED', async () => {
                try {
                    auctionBlockLength = 30 / averageMiningBlockTime; // 1 min in seconds
                    termEndTimestamp = currentBlock.timestamp + 2 ;
                    Loan = await LoanContract.new(
                        auctionBlockLength,
                        termEndTimestamp,
                        minAmount,
                        maxAmount,
                        maxInterestRate,
                        borrower,
                        DAIToken.address, 
                        DAIProxy.address,
                        admin
                    );
                    await helpers.waitNBlocks(1000);
                    const isExpired = await Loan.isDefaulted();
                    expect(isExpired).to.equal(true);

                    await Loan.withdrawRepayment({from: lender});
                } catch (error) {
                    expect(error).to.not.equal(undefined);
                }
            });
            it('Expect withdrawRepayment to NOT allow Lender take repayament state == ACTIVE', async () => {
                try {
                    await DAIToken.approve(DAIProxy.address, 100, { from: lender });
                    await DAIProxy.fund(Loan.address, 100, {from: lender});
                    
                    // Retrieve current state == ACTIVE
                    const stateAfterFund = await Loan.currentState({from: owner});
                    expect(Number(stateAfterFund)).to.equal(2);

                    await Loan.withdrawRepayment({ from: lender });
                } catch (error) {
                    expect(error).to.not.equal(undefined);
                }
            });
            it('Expect withdrawRepayment to NOT allow lender to take repayment state == FROZEN', async () => {
                try {
                    await Loan.unlockFundsWithdrawal({from: admin});
                    await Loan.withdrawRepayment({from: lender});
                } catch (error) {
                    expect(error).to.not.equal(undefined);
                }
            });
            it('Expect withdrawRepayment to NOT allow Borrower take repayament', async () => {
                try {
                    await DAIToken.approve(DAIProxy.address, 100, { from: lender });
                    await DAIProxy.fund(Loan.address, 100, {from: lender});
                    
                    // Retrieve current state == ACTIVE
                    const stateAfterFund = await Loan.currentState({from: owner});
                    expect(Number(stateAfterFund)).to.equal(2);

                    await Loan.withdrawLoan({from: borrower});

                    const amountToRepay = await Loan.borrowerDebt();
                    const borrowerBalancePrior = await DAIToken.balanceOf(borrower);

                    await DAIToken.approve(DAIProxy.address, amountToRepay, { from: borrower });
                    await DAIProxy.repay(Loan.address, amountToRepay, {from: borrower});

                    const borrowerBalanceAfter = await DAIToken.balanceOf(borrower);
                    // Fast way to check. TODO: Use BN.js to exact calc-
                    expect(Number(borrowerBalanceAfter)).equal(Number(borrowerBalancePrior) - Number(amountToRepay));

                    // State should change to REPAID
                    const endState = await Loan.currentState({from: owner});
                    expect(Number(endState)).to.equal(4);
                    await Loan.withdrawRepayment({ from: borrower });
                } catch (error) {
                    expect(error).to.not.equal(undefined);
                } 
            });
        });
        describe('Method withdrawRefund', () => {
            beforeEach(async () => {
                auctionBlockLength = 30 / averageMiningBlockTime; // 1 min in seconds
                termEndTimestamp = currentBlock.timestamp + 2 ;
                Loan = await LoanContract.new(
                    auctionBlockLength,
                    termEndTimestamp,
                    minAmount,
                    maxAmount,
                    maxInterestRate,
                    borrower,
                    DAIToken.address, 
                    DAIProxy.address,
                    admin
                );
            });
            it('Expect withdrawRefund to allow Lender refund if state == FAILED_TO_FUND', async () => {
                // Partially fund the Loan
                await DAIToken.approve(DAIProxy.address, 50, { from: lender });
                await DAIProxy.fund(Loan.address, 50, {from: lender});

                // Mine to end of funding
                const fundEndBlock = await Loan.auctionEndBlock();
                const currentBlock = await web3.eth.getBlockNumber();
                const blocksToEnd =  Number(fundEndBlock) - Number(currentBlock);
            
                await helpers.waitNBlocks(blocksToEnd + 100);
                await Loan.updateStateMachine();
                
                const stateAfterDeadline = await Loan.currentState();
                expect(Number(stateAfterDeadline)).to.equal(1);

                // Lender withdraws refund
                const lenderBalance = await DAIToken.balanceOf(lender);

                await Loan.withdrawRefund({from: lender});
                const lenderBidAmountInContractAfterWithdraw = await Loan.lenderBidAmount(lender);
                const lenderBalanceAfter = await DAIToken.balanceOf(lender);
                expect(Number(lenderBalance)).to.equal(100)
                expect(Number(lenderBalanceAfter)).to.equal(150);
                expect(Number(lenderBidAmountInContractAfterWithdraw)).to.equal(50);
            });
            it('Expect withdrawRefund to NOT allow Lender refund if already refunded && state == FAILED_TO_FUND ', async () => {
                try {
                    // Partially fund the Loan
                    await DAIToken.approve(DAIProxy.address, 50, { from: lender });
                    await DAIProxy.fund(Loan.address, 50, {from: lender});

                    // Mine to end of funding
                    const fundEndBlock = await Loan.auctionEndBlock();
                    const currentBlock = await web3.eth.getBlockNumber();
                    const blocksToEnd =  Number(fundEndBlock) - Number(currentBlock);

                    await helpers.waitNBlocks(blocksToEnd + 100);
                    await Loan.updateStateMachine();
                    
                    const stateAfterDeadline = await Loan.currentState();
                    expect(Number(stateAfterDeadline)).to.equal(1);

                    // Lender withdraws refund
                    const lenderBalance = await DAIToken.balanceOf(lender);

                    await Loan.withdrawRefund({from: lender});
                    await Loan.withdrawRefund({from: lender});
                } catch (error) {
                    expect(error).to.not.equal(undefined)
                }
            });
            it('Expect withdrawRefund to NOT allow Lender refund if state == CREATED', async () => {
                try {
                    // Partially fund the Loan
                    await DAIToken.approve(DAIProxy.address, 50, { from: lender });
                    await DAIProxy.fund(Loan.address, 50, {from: lender});

                    await Loan.updateStateMachine();
                    
                    const stateAfterDeadline = await Loan.currentState();
                    expect(Number(stateAfterDeadline)).to.equal(0);

                    await Loan.withdrawRefund({from: lender});
                } catch (error) {
                    expect(error).to.not.equal(undefined)
                }
            });
            it('Expect withdrawRefund to NOT allow Lender refund if state == ACTIVE', async () => {
                try {
                    // Partially fund the Loan
                    await DAIToken.approve(DAIProxy.address, 100, { from: lender });
                    await DAIProxy.fund(Loan.address, 100, {from: lender});

                    // Mine to end of funding
                    const fundEndBlock = await Loan.auctionEndBlock();
                    const currentBlock = await web3.eth.getBlockNumber();
                    const blocksToEnd =  Number(fundEndBlock) - Number(currentBlock);

                    await helpers.waitNBlocks(blocksToEnd + 100);
                    await Loan.updateStateMachine();
                    
                    const stateAfterDeadline = await Loan.currentState();
                    expect(Number(stateAfterDeadline)).to.equal(2);

                    await Loan.withdrawRefund({from: lender});
                } catch (error) {
                    expect(error).to.not.equal(undefined)
                }
            });
            it('Expect withdrawRefund to NOT allow Lender refund if state == DEFAULTED', async () => {
                try {
                    // Partially fund the Loan
                    await DAIToken.approve(DAIProxy.address, 100, { from: lender });
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
            it('Expect withdrawRefund to NOT allow Lender refund if state == REPAID', async () => {
                try {
                    await DAIToken.approve(DAIProxy.address, 100, { from: lender });
                    await DAIProxy.fund(Loan.address, 100, {from: lender});

                    await Loan.withdrawLoan({from: borrower});

                    const amountToRepay = await Loan.borrowerDebt();
                    await DAIToken.approve(DAIProxy.address, amountToRepay, { from: borrower });
                    await DAIProxy.repay(Loan.address, amountToRepay, {from: borrower});
                    
                    const stateAfterDeadline = await Loan.currentState();
                    expect(Number(stateAfterDeadline)).to.equal(4);

                    await Loan.withdrawRefund({from: lender});
                } catch (error) {
                    expect(error).to.not.equal(undefined);
                }
            });
            it('Expect withdrawRefund to NOT allow Lender refund if state == FROZEN', async () => {
                try {
                    await Loan.unlockFundsWithdrawal({from: admin});
                    await Loan.withdrawRefund({from: borrower});
                } catch (error) {
                    expect(error).to.not.equal(undefined);
                }
            })
        });
        describe('Method onRepaymentReceived', () => {
            beforeEach(async () => {
                Loan = await LoanContract.new(
                    auctionBlockLength,
                    termEndTimestamp,
                    minAmount,
                    maxAmount,
                    maxInterestRate,
                    borrower,
                    DAIToken.address, 
                    DAIProxy.address,
                    admin
                );
            });
            it('Expect onRepaymentReceived to let borrower return the loan and mutate state to REPAID', async () => {
                // Partially fund the Loan
                await DAIToken.approve(DAIProxy.address, 100, { from: lender });
                await DAIProxy.fund(Loan.address, 100, {from: lender});

                await Loan.withdrawLoan({from: borrower});
                const borrowerBalance = Number(await DAIToken.balanceOf(borrower))
                const amountToRepay = Number (await Loan.borrowerDebt());
                await DAIToken.approve(DAIProxy.address, amountToRepay, { from: borrower });
                await DAIProxy.repay(Loan.address, amountToRepay, {from: borrower});
                
                const stateAfterDeadline = await Loan.currentState();
                expect(Number(stateAfterDeadline)).to.equal(4);
            }) ;
            it('Expect onRepaymentReceived to revert borrower not to return the loan if incorrect ammount', async () => {
                try {
                    await DAIToken.approve(DAIProxy.address, 100, { from: lender });
                    await DAIProxy.fund(Loan.address, 100, {from: lender});

                    await Loan.withdrawLoan({from: borrower});
                    const amountToRepay = Number (await Loan.borrowerDebt());
                    
                    await DAIToken.approve(DAIProxy.address, amountToRepay, { from: borrower });
                    await DAIProxy.repay(Loan.address, amountToRepay - 10, {from: borrower});
                } catch (error) {
                    expect(error).to.not.equal(undefined);
                }
            });
        })
        describe('Method isAuctionExpired', () => {
            beforeEach(async () => {
                Loan = await LoanContract.new(
                    auctionBlockLength,
                    termEndTimestamp,
                    minAmount,
                    maxAmount,
                    maxInterestRate,
                    borrower,
                    DAIToken.address, 
                    DAIProxy.address,
                    admin
                );
            });
            it('Expects to return true when block number is greater than the auction end block', async() => {
                const fundEndBlock = await Loan.auctionEndBlock();
                const currentBlock = await web3.eth.getBlockNumber();
                const blocksToEnd =  Number(fundEndBlock) - Number(currentBlock);
            
                await helpers.waitNBlocks(blocksToEnd);
                const isExpired = await Loan.isAuctionExpired()
                expect(isExpired).to.equal(true);
            });
            it('Expects to return false when block is lesser than auction end block ', async() => {
                const isExpired = await Loan.isAuctionExpired();
                expect(isExpired).to.equal(false);
            });
        });
        describe('Method isDefaulted', () => {
            beforeEach(async () => {
                auctionBlockLength = 30 / averageMiningBlockTime; // 1 min in seconds
                termEndTimestamp = currentBlock.timestamp + 2 ;
                Loan = await LoanContract.new(
                    auctionBlockLength,
                    termEndTimestamp,
                    minAmount,
                    maxAmount,
                    maxInterestRate,
                    borrower,
                    DAIToken.address, 
                    DAIProxy.address,
                    admin
                );
            });
            it('Expects to return true when block timestamp is greater than the termEndTimestamp', async() => {
                await helpers.waitNBlocks(1000);
                const isExpired = await Loan.isDefaulted();
                expect(isExpired).to.equal(true);
            });
            it('Expects to return false when block timestamp is lesser than the termEndTimestamp', async() => {
                const isExpired = await Loan.isDefaulted();
                expect(isExpired).to.equal(false);
            });
        });
        describe('Method getInterestRate', () => {
            beforeEach(async () => {
                auctionBlockLength = 300 / averageMiningBlockTime; // 1 min in seconds
                termEndTimestamp = currentBlock.timestamp + 20000 ;
                Loan = await LoanContract.new(
                    auctionBlockLength,
                    termEndTimestamp,
                    minAmount,
                    maxAmount,
                    maxInterestRate,
                    borrower,
                    DAIToken.address, 
                    DAIProxy.address,
                    admin
                );
            });
            it('Expects to calculate correctly the interest rate when loan is in state = CREATED', async () => {
                await DAIToken.approve(DAIProxy.address, 50, { from: lender });
                await DAIProxy.fund(Loan.address, 50, {from: lender});

                // formula:: maxInterest * (currentBlockNumber - auctionStartBlock) / (auctionEndBlock - auctionStartBlock)
                await helpers.waitNBlocks(100)
                const calculatedInterest = Number(await Loan.getInterestRate());

                expect(calculatedInterest).to.gt(0);
            });
            it('Expects to return different interest rates through time', async () => {
                await DAIToken.approve(DAIProxy.address, 50, { from: lender });
                await DAIProxy.fund(Loan.address, 50, {from: lender});

                // formula:: maxInterest * (currentBlockNumber - auctionStartBlock) / (auctionEndBlock - auctionStartBlock)
                await helpers.waitNBlocks(100)
                const calculatedInterest = Number(await Loan.getInterestRate());
                
                await helpers.waitNBlocks(100);

                // formula:: maxInterest * (currentBlockNumber - auctionStartBlock) / (auctionEndBlock - auctionStartBlock)
                const calculatedInterest2 = Number(await Loan.getInterestRate());
                
                expect(calculatedInterest).to.gt(0);
                expect(calculatedInterest2).to.gt(calculatedInterest);
            });
            it('Expects to return same interest rates once auction ended state= ACTIVE', async () => {
                await DAIToken.approve(DAIProxy.address, 100, { from: lender });
                await DAIProxy.fund(Loan.address, 100, {from: lender});

                // formula:: maxInterest * (lastFundedBlock - auctionStartBlock) / (auctionEndBlock - auctionStartBlock)
                await helpers.waitNBlocks(100)
                const calculatedInterest = Number(await Loan.getInterestRate());
                
                const lastFundedBlock = Number(await Loan.lastFundedBlock());
                const auctionStartBlock = Number(await Loan.auctionStartBlock());
                const auctionEndBlock = Number(await Loan.auctionEndBlock());
                
                const interest = maxInterestRate * ((lastFundedBlock - auctionStartBlock) / (auctionEndBlock - auctionStartBlock));
                expect(calculatedInterest).to.equal(interest);
            });
        });
        describe('Method withdrawFundsUnlocked', async() => {
            beforeEach(async () => {
                auctionBlockLength = 30 / averageMiningBlockTime; // 1 min in seconds
                termEndTimestamp = currentBlock.timestamp + 2 ;
                Loan = await LoanContract.new(
                    auctionBlockLength,
                    termEndTimestamp,
                    minAmount,
                    maxAmount,
                    maxInterestRate,
                    borrower,
                    DAIToken.address, 
                    DAIProxy.address,
                    admin
                );
            });
            it('Expects lender to withdraw funds after unlocked', async() => {
                const balanceBefore = Number(await DAIToken.balanceOf(lender));
                await DAIToken.approve(DAIProxy.address, 100, { from: lender });
                await DAIProxy.fund(Loan.address, 100, {from: lender});
                
                await Loan.unlockFundsWithdrawal({from: admin});

                const state = Number(await Loan.currentState());
                expect(state).to.equal(6);

                await Loan.withdrawFundsUnlocked({from: lender});
                const balance = Number(await DAIToken.balanceOf(lender));

                expect(balance).to.equal(balanceBefore);
            });
            it('Expects lender to not be able to withdraw funds if not unlocked', async() => {
                try {
                    await DAIToken.approve(DAIProxy.address, 100, { from: lender });
                    await DAIProxy.fund(Loan.address, 100, {from: lender});
                        
                    await Loan.withdrawFundsUnlocked({from: lender});
                } catch (error) {
                    expect(error).to.not.equal(undefined)
                }
            });
        });
        describe('Method unlockFundsWithdrawal', () => {
            beforeEach(async () => {
                auctionBlockLength = 30 / averageMiningBlockTime; // 1 min in seconds
                termEndTimestamp = currentBlock.timestamp + 2 ;
                Loan = await LoanContract.new(
                    auctionBlockLength,
                    termEndTimestamp,
                    minAmount,
                    maxAmount,
                    maxInterestRate,
                    borrower,
                    DAIToken.address, 
                    DAIProxy.address,
                    admin
                );
            });
            it('Expects to unlock the funds if admin', async () => {
                await Loan.unlockFundsWithdrawal({from: admin});
                const unlocked = Number(await Loan.currentState());
                expect(unlocked).to.equal(6);
            });
            it('Expects to not unlock the funds if not admin', async () => {
                try {
                    await Loan.unlockFundsWithdrawal({from: owner});
                } catch (error) {
                    expect(error).to.not.equal(undefined);
                }
            });
        });
    });
});
