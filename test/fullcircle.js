const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
chai.use(chaiAsPromised)
const { expect } = chai;
const web3 = global.web3; //require('web3');
const DAIProxyContract = artifacts.require('DAIProxy');
const HeroFakeTokenContract = artifacts.require('HeroFakeToken');
const LoanContract = artifacts.require('LoanContract');
const AuthContract = artifacts.require('Authorization');
const DepositRegistryContract = artifacts.require('DepositRegistry');
const KYCContract = artifacts.require('KYCRegistry');

const LoanContractDispatcherContract = artifacts.require('LoanContractDispatcher');

// mine blocks so it passes "time"
const waitNBlocks = async n => {
    await Promise.all(
        [...Array(n).keys()].map(i => {
            web3.currentProvider.send({
                jsonrpc: '2.0',
                method: 'evm_mine',
                id: i
                }, ()=> {});
        })
    );
};


contract('LoanContract', (accounts) => {
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

    const averageMiningBlockTime = 15;
    
    describe('Test the full flow with the actual contracts', () => {
        beforeEach(async () => {
            try {
                DAIToken = await HeroFakeTokenContract.new({from: owner});
                HeroToken = await HeroFakeTokenContract.new({from: owner});
                await HeroToken.transferFakeHeroTokens(lender, {from: owner});
            } catch (error) {
                throw error;
            }
        });
        it('Expects a lot of things', async () => {
            try {
                // adding lender and borrower to KYC
                KYCRegistry = await KYCContract.new();
                await KYCRegistry.add(lender);
                await KYCRegistry.add(borrower);
                
                // give permision to the deposit registry to deposit tokens instead of the lender
                DepositRegistry = await DepositRegistryContract.new(HeroToken.address,  { from: owner});
                await HeroToken.approve(DepositRegistry.address, 200, { from: lender });
                await DepositRegistry.depositFor(lender, {from: owner});
                // initialize proxies for lender and borrower
                Auth = await AuthContract.new(KYCRegistry.address, DepositRegistry.address);
                DAIProxy = await DAIProxyContract.new(Auth.address, DAIToken.address, {from: owner});
                
                // check KYC and Deposit
                const lenderKYC = await Auth.isKYCConfirmed(lender);
                const borrowerKYC = await Auth.isKYCConfirmed(borrower);
                const lenderHasDeposited = await Auth.hasDeposited(lender);

                // initialize loan contract dispatcher
                LoanDispatcher = await LoanContractDispatcherContract.new(Auth.address, DAIToken.address, DAIProxy.address, {from:owner});
            
                // borrower creates loan
                const loanTimeLength = 1 * 60 * 60; // 1 day in seconds
                const termLength =  loanTimeLength / averageMiningBlockTime;
                const lengthBlocks = loanTimeLength / averageMiningBlockTime;
                const loanAmount = 100;
                const gracePeriodTime = 1* 4 * 7 * 24 * 60 * 60; // one month in seconds
                const graceLength = gracePeriodTime / averageMiningBlockTime;
                const bpMaxInterestRate = 5000;

                await LoanDispatcher.deploy(
                    lengthBlocks,
                    loanAmount,
                    bpMaxInterestRate,
                    termLength,
                    graceLength,
                    {from: borrower}
                );

                const eventHistory = await LoanDispatcher.getPastEvents('LoanContractCreated'); // {fromBlock: 0, toBlock: "latest"} put this to get all
                const loanAddress = eventHistory[0].returnValues.contractAddress;
                
                // wait for time / blocks to pass
                await waitNBlocks(100);

                // lender funds loan
                const fundingAmount = 100;
                await DAIToken.transferAmountToAddress(lender, fundingAmount, {from: owner});
                await DAIToken.approve(DAIProxy.address, fundingAmount, { from: lender });
                await DAIProxy.fund(loanAddress, fundingAmount, {from: lender});

                // create loan instance from loanAddress
                const Loan = await LoanContract.at(loanAddress);

                // check if loan is funded
                const loanFundedAmount = await Loan.getAlreadyFundedAmount();
                const amountFundedByLender = await Loan.getLenderAmount(lender);
                
                // borrower takes money from loan
                await Loan.withdrawLoan(borrower, {from: borrower}); 
                
                // check borrower received amount
                const borrowerWithdrawAmount = await DAIToken.balanceOf(borrower);
                

                // borrower repays loan
                const totalReturnAmount = Number(await Loan.getTotalAmountWithInterest({from: borrower}));
                const interestAmount = totalReturnAmount - fundingAmount;
                await DAIToken.transferAmountToAddress(borrower, interestAmount, {from: owner});
                await DAIToken.approve(DAIProxy.address, totalReturnAmount, { from: borrower });
                await DAIProxy.repay(loanAddress, totalReturnAmount, {from: borrower});
                
                const loanRepaidEvent = await Loan.getPastEvents('LoanRepaid');
                const loanAddressToRepay = loanRepaidEvent[0].returnValues.loanAddress;

                // lender takes out money
                await Loan.withdrawRepayment(lender, {from: lender});
                const lenderBalanceAfterRepayment = await DAIToken.balanceOf(lender);
                const lenderAmountInContractAfterWithdraw = await Loan.getLenderAmount(lender);

                // assertions
                expect(lenderKYC).to.equal(true);
                expect(borrowerKYC).to.equal(true);
                expect(lenderHasDeposited).to.equal(true);
                expect(Number(loanFundedAmount)).to.equal(fundingAmount);
                expect(Number(amountFundedByLender)).to.equal(fundingAmount);
                expect(Number(borrowerWithdrawAmount)).to.equal(loanAmount);
                expect(loanAddressToRepay).to.equal(loanAddress);
                expect(Number(lenderBalanceAfterRepayment)).to.equal(totalReturnAmount);
                expect(Number(lenderAmountInContractAfterWithdraw)).to.equal(0);

            } catch (error) {
                console.log(error);
                expect(error).to.equal(undefined);
            }
        })
    });



});