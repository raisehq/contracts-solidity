const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
chai.use(chaiAsPromised)
const { expect } = chai
const DAIProxyContract = artifacts.require('DAIProxyMock');
const HeroFakeTokenContract = artifacts.require('HeroFakeToken');
const LoanContract = artifacts.require('LoanContract');

contract('LoanContract', (accounts) => {
    let DAIProxy;
    let DAIToken;
    let Loan;

    const averageMiningBlockTime = 15;

    const owner = accounts[0];
    const lender = accounts[1];
    const borrower = accounts[2];

    describe('Test suite for LoanContract', () => {
        let loanAmount;
        let bpMacInterestRate;
        let lengthBlocks;
        let termLength;
        beforeEach(async () => {
            try {
                DAIToken = await HeroFakeTokenContract.new({from: owner});
                await DAIToken.transferAmountToAddress(lender,150, {from: owner});
                DAIProxy = await DAIProxyContract.new(DAIToken.address, {from: owner});
            } catch (error) {
                throw error;
            }
        })
        describe('Test onFundingReceived', () => {
            it('Expects the funding to be done correctly when it is not the full amount', async () => {
                try {
                    const loanTimeLength = 1 * 7 * 24 * 60 * 60; // 1 week in seconds
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
                    await DAIToken.approve(DAIProxy.address, 50, { from: lender });
                    await DAIProxy.fund(Loan.address, 50, {from: lender});
                    
                    //subscrive to events
                    const alreadyFundedAmount = await Loan.getAlreadyFundedAmount({from: owner});
                    const fundedByLender = await Loan.getLenderAmount(lender, {from: owner});
                    
                    expect(Number(fundedByLender)).to.equal(50);
                    expect(Number(alreadyFundedAmount)).to.equal(50);
                } catch (error) {
                    expect(error).to.equal(undefined);
                }
            });
            it('Expects the funding to be done correctly when it is full amount', async () => {
                try {
                    const loanTimeLength = 1 * 7 * 24 * 60 * 60; // 1 week in seconds
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
                    await DAIToken.approve(DAIProxy.address, 100, { from: lender });
                    await DAIProxy.fund(Loan.address, 100, {from: lender});
                    
                    //subscrive to events
                    const alreadyFundedAmount = await Loan.getAlreadyFundedAmount({from: owner});
                    const fundedByLender = await Loan.getLenderAmount(lender, {from: owner});
                    
                    expect(Number(fundedByLender)).to.equal(100);
                    expect(Number(alreadyFundedAmount)).to.equal(100);
                } catch (error) {
                    expect(error).to.equal(undefined);
                }
            });
            it('Expects the funding to be done correctly when it is more than the full amount', async () => {
                try {
                    const loanTimeLength = 1 * 7 * 24 * 60 * 60; // 1 week in seconds
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
                    await DAIToken.approve(DAIProxy.address, 150, { from: lender });
                    await DAIProxy.fund(Loan.address, 150, {from: lender});
                    
                    //subscrive to events
                    const alreadyFundedAmount = await Loan.getAlreadyFundedAmount({from: owner});
                    const fundedByLender = await Loan.getLenderAmount(lender, {from: owner});
                    const lenderAfterBalance = await DAIToken.balanceOf(lender);
                    
                    expect(Number(fundedByLender)).to.equal(100);
                    expect(Number(alreadyFundedAmount)).to.equal(100);
                    expect(Number(lenderAfterBalance)).to.equal(50);
                } catch (error) {
                    console.log('the error is:: ', error)
                    expect(error).to.equal(undefined);
                }
            });
        });
    });
});
