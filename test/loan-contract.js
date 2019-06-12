const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const { expect } = chai;
const truffleAssert = require('truffle-assertions');
const DAIProxyContract = artifacts.require('DAIProxyMock');
const HeroFakeTokenContract = artifacts.require('HeroFakeToken');
const LoanContract = artifacts.require('LoanContract');
const {promisify} = require('util');

const helpers = require('./helpers.js');

contract.only('LoanContract', (accounts) => {
    let DAIProxy;
    let DAIToken;
    let Loan;

    const averageMiningBlockTime = 15;

    const owner = accounts[0];
    const lender = accounts[1];
    const borrower = accounts[2];

    describe('Unit tests for LoanContract', () => {
        let loanAmount;
        let bpMacInterestRate;
        let lengthBlocks;
        let termLength;

        beforeEach(async () => {
            try {
                DAIToken = await HeroFakeTokenContract.new({from: owner});
                await DAIToken.transferAmountToAddress(lender, 150, {from: owner});
                DAIProxy = await DAIProxyContract.new(DAIToken.address, {from: owner});
            
                const loanTimeLength = 1 * 60 * 60; // 1 hour in seconds
                lengthBlocks = loanTimeLength / averageMiningBlockTime;
                loanAmount = 100;
                const gracePeriodTime = 1* 4 * 7 * 24 * 60 * 60; // one month in seconds
                termLength = gracePeriodTime / averageMiningBlockTime;
                bpMacInterestRate = 5;

                Loan = await LoanContract.new(
                    lengthBlocks,
                    loanAmount,
                    bpMacInterestRate,
                    termLength,
                    borrower, 
                    DAIToken.address, 
                    DAIProxy.address,
                );
                
            } catch (error) {
                throw error;
            }
        });

        describe('Method onFundingReceived', () => {
            beforeEach(async () => {
                
            });

            it('Expects Lender to be able to partially fund a Loan in CREATED state.', async () => {
                try {
                    // LoanContract state should start with CREATED == 0
                    const firstState = await Loan.getCurrentState();
                    expect(Number(firstState)).to.equal(0);

                    await DAIToken.approve(DAIProxy.address, 50, { from: lender });
                    await DAIProxy.fund(Loan.address, 50, {from: lender});
                    
                    // Loan state after funding
                    const loanState = await Loan.getCurrentState();
                    // Subscribe to events
                    const alreadyFundedAmount = await Loan.getAlreadyFundedAmount({from: owner});
                    const fundedByLender = await Loan.getLenderAmount(lender, {from: owner});

                    expect(Number(fundedByLender)).to.equal(50);
                    expect(Number(alreadyFundedAmount)).to.equal(50);

                    // LoanContract state should still be CREATED == 0, due is partially funded
                    expect(Number(loanState)).to.equal(0);
                } catch (error) {
                    expect(error).to.equal(undefined);
                }
            });

            it('Expects Lender to be able to fully fund a Loan and mutate from CREATED to ACTIVE state.', async () => {
                try {
                    // LoanContract state should start with CREATED == 0
                    const firstState = await Loan.getCurrentState();
                    expect(Number(firstState)).to.equal(0);

                    await DAIToken.approve(DAIProxy.address, 100, { from: lender });
                    await DAIProxy.fund(Loan.address, 100, {from: lender});
                    
                    // Loan state after funding
                    const loanState = await Loan.getCurrentState();
                    
                    // Subscribe to events
                    const alreadyFundedAmount = await Loan.getAlreadyFundedAmount({from: owner});
                    const fundedByLender = await Loan.getLenderAmount(lender, {from: owner});
                    
                    expect(Number(fundedByLender)).to.equal(100);
                    expect(Number(alreadyFundedAmount)).to.equal(100);

                    // LoanContract state should mutate to ACTIVE == 2
                    expect(Number(loanState)).to.equal(2);
                } catch (error) {
                    expect(error).to.equal(undefined);
                }
            });

            it('Expects Lender to be able to send bigger funds to Loan, receive back the difference, and mutate from CREATED to ACTIVE state', async () => {
                try {
                    // LoanContract state should start with CREATED == 0
                    const firstState = await Loan.getCurrentState();
                    expect(Number(firstState)).to.equal(0);

                    await DAIToken.approve(DAIProxy.address, 150, { from: lender });
                    await DAIProxy.fund(Loan.address, 150, {from: lender});
                    
                    const lenderAfterBalance = await DAIToken.balanceOf(lender);

                    // Loan state after funding
                    const loanState = await Loan.getCurrentState();

                    // Subscribe to events
                    const alreadyFundedAmount = await Loan.getAlreadyFundedAmount({from: owner});
                    const fundedByLender = await Loan.getLenderAmount(lender, {from: owner});
                    
                    expect(Number(fundedByLender)).to.equal(100);
                    expect(Number(alreadyFundedAmount)).to.equal(100);
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
                    const firstState = await Loan.getCurrentState();
                    expect(Number(firstState)).to.equal(0);
                    
                    // First, lender fully fund the Loan.
                    await DAIToken.approve(DAIProxy.address, 100, { from: lender });
                    await DAIProxy.fund(Loan.address, 100, {from: lender});

                    // LoanContract state  after fully funded should be  ACTIVE == 2
                        const secondState = await Loan.getCurrentState();
                        expect(Number(secondState)).to.equal(2);
                    
                    // After is ACTIVE and fully funded, should not allow fund again the Loan.
                    await DAIToken.approve(DAIProxy.address, 50, { from: lender });
                    await truffleAssert.fails(
                        DAIProxy.fund(Loan.address, 50, {from: lender}),
                        truffleAssert.ErrorType.REVERT,
                        "Incorrect loan status."
                    );
                    

                    // Loan state after funding
                    const loanState = await Loan.getCurrentState();
                    
                    // LoanContract state should STILL be ACTIVE == 2
                    expect(Number(loanState)).to.equal(2);
                    
                    // Lender should still have 50 bucks

                    const lenderAfterBalance = await DAIToken.balanceOf(lender);
                    // Subscribe to events
                    const alreadyFundedAmount = await Loan.getAlreadyFundedAmount({from: owner});
                    const fundedByLender = await Loan.getLenderAmount(lender, {from: owner});
                    
                    // Check balances
                    expect(Number(fundedByLender)).to.equal(100);
                    expect(Number(alreadyFundedAmount)).to.equal(100);
                    expect(Number(lenderAfterBalance)).to.equal(50);
                } catch (error) {
                    console.log('the error is:: ', error)
                    expect(error).to.equal(undefined);
                }
            });

            it('Expects lender to NOT fund Loan if expires in time, mutating from CREATED to FAILED_TO_FUND', async () => {
                try {
                    const fundEndBlock = await Loan.getFundingTimeLimitBlock();
                    const fundStartBlock = await Loan.getStartBlock();
                    const blocksToEnd =  Number(fundEndBlock) - Number(fundStartBlock);

                    // Contract init state should be CREATED
                    const initState = await Loan.getCurrentState();
                    expect(Number(initState)).to.equal(0);

                    // Mine to end of funding
                    await helpers.waitNBlocks(blocksToEnd);

                    /**
                     * Contract state should still be CREATED, due Lender did not try 
                     * to fund or 3º party did not exec getUpdatedState method 
                    */
                    const stateAfterDeadline = await Loan.getCurrentState();
                    expect(Number(stateAfterDeadline)).to.equal(0);

                    // Try to fund the Loan
                    await DAIToken.approve(DAIProxy.address, 100, { from: lender });
                    await DAIProxy.fund(Loan.address, 100, {from: lender});

                    // Check Loan funds inside contract, should be ZERO
                    const alreadyFundedAmount = await Loan.getAlreadyFundedAmount({from: owner});
                    const loanRawTokens = await DAIToken.balanceOf(Loan.address, {from: owner});
                    expect(Number(alreadyFundedAmount)).to.equal(0);
                    expect(Number(loanRawTokens)).to.equal(0);

                    // Contract state should be mutated to FAILED_TO_FUND
                    const stateAfterFailedFund = await Loan.getCurrentState();
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
            it('Expects getUpdatedState method to mutate Loan state from CREATED to FAILED_TO_FUND,  if funding is time expired ', async () => {
                try {
                    const fundEndBlock = await Loan.getFundingTimeLimitBlock();
                    const fundStartBlock = await Loan.getStartBlock();
                    const blocksToEnd =  Number(fundEndBlock) - Number(fundStartBlock);

                    // Contract init state should be CREATED
                    const initState = await Loan.getCurrentState();
                    expect(Number(initState)).to.equal(0);

                    // Mine to end of funding
                    await helpers.waitNBlocks(blocksToEnd);

                    // Contract state should still be CREATED, 3º party did not exec getUpdatedState method 
                    const stateAfterDeadline = await Loan.getCurrentState();
                    expect(Number(stateAfterDeadline)).to.equal(0);

                    // Correct the state via getUpdatedState
                    await Loan.getUpdatedState();

                    // Contract state should mutate to FAILED_TO_FUND
                    // after executing state check (need to send)
                    const newState = await Loan.getCurrentState({from: owner});
                    expect(Number(newState)).to.equal(1);
                } catch (error) {
                    console.log('the error is:: ', error)
                    throw error;
                }
            });

            it('Expects getUpdatedState method to NOT mutate Loan state if state is CREATED and is not expired', async () => {
                try {
                    // Contract init state should be CREATED
                    const initState = await Loan.getCurrentState();
                    expect(Number(initState)).to.equal(0);

                    // Check the state via getUpdatedState
                    await Loan.getUpdatedState();

                    // Contract state should still be CREATED 
                    // after executing state check (need to send)
                    const stateAfterMethod = await Loan.getCurrentState({from: owner});
                    expect(Number(stateAfterMethod)).to.equal(0);
                } catch (error) {
                    console.log('the error is:: ', error)
                    throw error;
                }
            });

            it('Expects getUpdatedState method to NOT mutate from FAILED_TO_FUND state', async () => {
                try {
                    // Contract init state should be CREATED
                    const fundEndBlock = await Loan.getFundingTimeLimitBlock();
                    const fundStartBlock = await Loan.getStartBlock();
                    const blocksToEnd =  Number(fundEndBlock) - Number(fundStartBlock);

                    // Mine to end of funding
                    await helpers.waitNBlocks(blocksToEnd);

                    // Mutate the state to FAILED_TO_FUND via getUpdatedState
                    const state = await Loan.getUpdatedState.sendTransaction({from: owner});

                    // Expect contract state to be FAILED_TO_FUND 
                    const stateAfterMethod = await Loan.getCurrentState({from: owner});
                    expect(Number(stateAfterMethod)).to.equal(1);

                    // Try to mutate again the state to FAILED_TO_FUND via getUpdatedState
                    await Loan.getUpdatedState({from: owner});

                    const endState = await Loan.getCurrentState({from: owner});
                    expect(Number(endState)).to.equal(1);

                    // Expect contract state to be FAILED_TO_FUND 
                    const stateAfterMethod = await Loan.getCurrentState({from: owner});
                    expect(Number(stateAfterMethod)).to.equal(1);
                } catch (error) {
                    console.log('the error is:: ', error)
                    throw error;
                }
            });

            it.skip('Expects getUpdatedState method to NOT mutate from ACTIVE state if not defaulted', async () => {
                try {
                    await DAIToken.approve(DAIProxy.address, 100, { from: lender });
                    await DAIProxy.fund(Loan.address, 100, {from: lender});
                    
                    // Retrieve current state ACTIVE
                    const stateAfterFund = await Loan.getCurrentState({from: owner});
                    const endState = await Loan.getCurrentState({from: owner});
                    expect(Number(endState)).to.equal(2);

                    // Try to mutate again the state
                    await Loan.getUpdatedState({from: owner});

                    // State should still be ACTIVE
                    const endState = await Loan.getCurrentState({from: owner});
                    expect(Number(endState)).to.equal(2);
                } catch (error) {
                    console.log('the error is:: ', error)
                    throw error;
                }
            });
        });
        describe.skip('Method withdrawLoan', () => {})
        describe.skip('Method withdrawRepayment', () => {})
        describe.skip('Method withdrawRefund', () => {})
        describe.skip('Method onRepayment', () => {})
        describe.skip('Method isExpired', () => {})
        describe.skip('Method isDefaulted', () => {})
        describe.skip('Method isDefaulted', () => {})
        describe.skip('Method getFundingTimeLimit', () => {})
        describe.skip('Method getInterestRate', () => {})
        describe.skip('Method getTotalAmountWithInterest', () => {})
        describe.skip('Method getStartBlock', () => {})
    });
});
