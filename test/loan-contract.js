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

contract('LoanContract', (accounts) => {
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
        let auctionBlockLength;
        let termEndTimestamp;

        beforeEach(async () => {
            try {
                DAIToken = await HeroFakeTokenContract.new({from: owner});
                await DAIToken.transferAmountToAddress(lender, 150, {from: owner});
                await DAIToken.transferAmountToAddress(borrower, 200, {from: owner});
                DAIProxy = await DAIProxyContract.new(DAIToken.address, {from: owner});
            
                const currentBlock = await web3.eth.getBlock('latest');

                // Set Loan variables
                minAmount = 80;
                maxAmount = 100;
                bpMacInterestRate = 5;
                auctionBlockLength = (60 * 60) / averageMiningBlockTime; // 1 hour in seconds
                termEndTimestamp = currentBlock.timestamp + (2 * 60 * 60); // 2 hours in seconds

                Loan = await LoanContract.new(
                    auctionBlockLength,
                    termEndTimestamp,
                    minAmount,
                    maxAmount,
                    bpMacInterestRate,
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
            it.skip('Expect onFundingReceived to revert if caller is NOT DaiProxy', async () => {});
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
                    expect(error).to.equal(undefined);
                }
            });

            it('Expects Lender to be able to send bigger funds to Loan, receive back the difference, and mutate from CREATED to ACTIVE state', async () => {
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
                        "Incorrect loan status."
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
            it('Expects updateMachineState method to mutate Loan state from CREATED to FAILED_TO_FUND,  if funding is time expired ', async () => {
                try {
                    const fundEndBlock = await Loan.auctionEndBlock();
                    const fundStartBlock = await Loan.auctionStartBlock();
                    const blocksToEnd =  Number(fundEndBlock) - Number(fundStartBlock);

                    // Contract init state should be CREATED
                    const initState = await Loan.currentState();
                    expect(Number(initState)).to.equal(0);

                    // Mine to end of funding
                    await helpers.waitNBlocks(blocksToEnd);

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
            it('Expect withdrawLoan to allow Borrower take loan if state == ACTIVE', async () => {
                try {
                    const borrowerBalancePrior = await DAIToken.balanceOf(borrower);

                    await DAIToken.approve(DAIProxy.address, 100, { from: lender });
                    await DAIProxy.fund(Loan.address, 100, {from: lender});
                    
                    // Retrieve current state == ACTIVE
                    const stateAfterFund = await Loan.currentState({from: owner});
                    expect(Number(stateAfterFund)).to.equal(2);

                    await Loan.withdrawLoan(borrower, {from: borrower});
                    const borrowerBalance = await DAIToken.balanceOf(borrower);

                    expect(Number(borrowerBalance)).to.equal(Number(borrowerBalancePrior) + 100);
                    // State should still be ACTIVE 
                    const endState = await Loan.currentState({from: owner});
                    expect(Number(endState)).to.equal(2);
                } catch (error) {
                    console.log('the error is:: ', error)
                    throw error;
                }
            });
            it.skip('Expect withdrawLoan to NOT allow Borrower take loan if state == REPAID', () => {});
            it.skip('Expect withdrawLoan to NOT allow Borrower take loan if state == CREATED', () => {});
            it.skip('Expect withdrawLoan to NOT allow Borrower take loan if state == FAILED_TO_FUND', () => {});
            it.skip('Expect withdrawLoan to NOT allow Borrower take loan if state == CLOSED', () => {});
            it.skip('Expect withdrawLoan to NOT allow Borrower take loan if state == DEFAULTED', () => {});
            it.skip('Expect withdrawLoan to NOT allow Borrower take loan twice.', () => {});
        })

        describe('Method withdrawRepayment', () => {
            it('Expect withdrawRepayment to allow Lender take repaid loan + interest if state == ACTIVE', async () => {
                 try {
                    await DAIToken.approve(DAIProxy.address, 100, { from: lender });
                    await DAIProxy.fund(Loan.address, 100, {from: lender});
                    
                    // Retrieve current state == ACTIVE
                    const stateAfterFund = await Loan.currentState({from: owner});
                    expect(Number(stateAfterFund)).to.equal(2);

                    await Loan.withdrawLoan(borrower, {from: borrower});

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
                } catch (error) {
                    console.log('the error is:: ', error)
                    throw error;
                }               
            });
            it.skip('Expect withdrawRepayment to NOT allow Lender take repayament if state == CLOSED', () => {});
            it.skip('Expect withdrawRepayment to NOT allow Lender take repayament if state == CREATED', () => {});
            it.skip('Expect withdrawRepayment to NOT allow Lender take repayament if state == FAILED_TO_FUND', () => {});
            it.skip('Expect withdrawRepayment to NOT allow Lender take repayament if state == DEFAULTED', () => {});
            it.skip('Expect withdrawRepayment to NOT allow Lender take repayament if state == REPAID', () => {});
            it.skip('Expect withdrawRepayment to NOT allow Lender take repayament if no funds && state == ACTIVE', () => {});
            it.skip('Expect withdrawRepayment to NOT allow Borrower take repayament', () => {});
            it.skip('Expect withdrawRepayment to NOT allow other address take repayament', () => {});
        })
        describe.skip('Method withdrawRefund', () => {
            it('Expect withdrawRedund to allow Lender refund if state == FAILED_TO_FUND', async () => {
                // Partially fund the Loan
                await DAIToken.approve(DAIProxy.address, 50, { from: lender });
                await DAIProxy.fund(Loan.address, 50, {from: lender});

                // Mine to end of funding
                const fundEndBlock = await Loan.auctionEndBlock();
                const currentBlock = await web3.eth.getBlockNumber();
                const blocksToEnd =  Number(fundEndBlock) - Number(currentBlock);

                await helpers.waitNBlocks(blocksToEnd);

                /**
                 * Contract state should still be CREATED, due Lender did not try 
                 * to fund or 3º party did not exec updateMachineState method 
                */
                const stateAfterDeadline = await Loan.currentState();
                expect(Number(stateAfterDeadline)).to.equal(0);

                // Lender withdraws refund
                const lenderBalance = await DAIToken.balanceOf(lender);
                await Loan.withdrawRefund(lender, {from: lender});
                const lenderBidAmountInContractAfterWithdraw = await Loan.lenderBidAmount(lender);
                const lenderBalanceAfter = await DAIToken.balanceOf(lender);

                expect(lenderHasDeposited).to.equal(true);
                expect(Number(lenderBalanceAfter)).to.equal(Number(lenderBalance) + 50);
                expect(Number(lenderBidAmountInContractAfterWithdraw)).to.equal(0);
            });
            it.skip('Expect withdrawRedund to NOT allow Lender refund if already refunded && state == FAILED_TO_FUND ', async () => {});
            it.skip('Expect withdrawRedund to NOT allow Lender refund if state == CREATED', async () => {});
            it.skip('Expect withdrawRedund to NOT allow Lender refund if state == ACTIVE', async () => {});
            it.skip('Expect withdrawRedund to NOT allow Lender refund if state == DEFAULTED', async () => {});
            it.skip('Expect withdrawRedund to NOT allow Lender refund if state == REPAID', async () => {});
            it.skip('Expect withdrawRedund to NOT allow Borrower get the Lender refund', async () => {});
            it.skip('Expect withdrawRedund to NOT allow Other get the Lender refund', async () => {});
        });
        describe.skip('Method onRepaymentReceived', () => {
            it.skip('Expect onRepaymentReceived to let borrower return the loan and mutate state to REPAID', async () => {}) ;
            it.skip('Expect onRepaymentReceived to revert borrower return the loan and mutate state to REPAID', async () => {}) ;
            it.skip('Expect onRepaymentReceived to let borrower return the loan and mutate state to REPAID', async () => {}) ;
            it.skip('Expect onRepaymentReceived to let borrower return the loan and mutate state to REPAID', async () => {}) ;
            it.skip('Expect onRepaymentReceived to let borrower return the loan and mutate state to REPAID', async () => {}) ;
            it.skip('Expect onRepaymentReceived to let borrower return the loan and mutate state to REPAID', async () => {}) ;
        })
        describe.skip('Method isAuctionExpired', () => {})
        describe.skip('Method isDefaulted', () => {})
        describe.skip('Method isDefaulted', () => {})
        describe.skip('Method getFundingTimeLimit', () => {})
        describe.skip('Method getInterestRate', () => {})
        describe.skip('Method getmaxAmountWithInterest', () => {})
    });
});
