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
        beforeEach(async () => {
            try {
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
            } catch (error) {
                throw error;
            }
        });
        it('Expects the flow to work correctly for one lender to fully fund a loan and for the borrower to repay', async () => {
            try {
                // borrower creates loan
                const loanTimeLength = 1 * 60 * 60; // 1 day in seconds
                const loanRepaymentTime = 1* 4 * 7 * 24 * 60 * 60; // one month in seconds
                const termLength =  loanRepaymentTime / averageMiningBlockTime;
                const lengthBlocks = loanTimeLength / averageMiningBlockTime;
                const loanAmount = 100;
                const bpMaxInterestRate = 5000;

                await LoanDispatcher.deploy(
                    lengthBlocks,
                    loanAmount,
                    bpMaxInterestRate,
                    termLength,
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
                expect(error).to.equal(undefined);
            }
        });
        it('Expects to work for 3 diff lenders with overflow and borrower repays in time', async () => {
            try {
                // borrower creates loan
                const loanTimeLength = 1 * 60 * 60; // 1 day in seconds
                const loanRepaymentTime = 1* 4 * 7 * 24 * 60 * 60; // one month in seconds
                const termLength =  loanRepaymentTime / averageMiningBlockTime;
                const lengthBlocks = loanTimeLength / averageMiningBlockTime;
                const loanAmount = 100;
                const bpMaxInterestRate = 5000;

                await LoanDispatcher.deploy(
                    lengthBlocks,
                    loanAmount,
                    bpMaxInterestRate,
                    termLength,
                    {from: borrower}
                );
                
                const eventHistory = await LoanDispatcher.getPastEvents('LoanContractCreated'); // {fromBlock: 0, toBlock: "latest"} put this to get all
                const loanAddress = eventHistory[0].returnValues.contractAddress;
                
                // create loan instance from loanAddress
                const Loan = await LoanContract.at(loanAddress);

                // wait for time / blocks to pass
                await waitNBlocks(100);
                
                // lenders funds loan
                const fundingAmount = 50;
                const fundingAmount2 = 40;
                const fundingAmount3 = 100;
                await DAIToken.transferAmountToAddress(lender, fundingAmount, {from: owner});
                await DAIToken.transferAmountToAddress(lender2, fundingAmount2, {from: owner});
                await DAIToken.transferAmountToAddress(lender3, fundingAmount3, {from: owner});
                await DAIToken.approve(DAIProxy.address, fundingAmount, { from: lender });
                await DAIToken.approve(DAIProxy.address, fundingAmount2, { from: lender2 });
                await DAIToken.approve(DAIProxy.address, fundingAmount3, { from: lender3 });
                await DAIProxy.fund(loanAddress, fundingAmount, {from: lender});
                await DAIProxy.fund(loanAddress, fundingAmount2, {from: lender2});
                await DAIProxy.fund(loanAddress, fundingAmount3, {from: lender3});
                
                // check if loan is funded
                const loanFundedAmount = await Loan.getAlreadyFundedAmount();
                const amountFundedByLender = await Loan.getLenderAmount(lender);
                const amountFundedByLender2 = await Loan.getLenderAmount(lender2);
                const amountFundedByLender3 = await Loan.getLenderAmount(lender3);               
                const lenderBalance = await DAIToken.balanceOf(lender);               
                const lender2Balance = await DAIToken.balanceOf(lender2);                
                const lender3Balance = await DAIToken.balanceOf(lender3);
                
                // get lenders amounts with interest
                const lenderAmountWithInterest = await Loan.calculateValueWithInterest(amountFundedByLender);
                const lender2AmountWithInterest = await Loan.calculateValueWithInterest(amountFundedByLender2);
                const lender3AmountWithInterest = await Loan.calculateValueWithInterest(amountFundedByLender3);

                // wait for time / blocks to pass
                await waitNBlocks(300);

                // borrower takes money from loan
                await Loan.withdrawLoan(borrower, {from: borrower}); 
                
                // check borrower received amount
                const borrowerWithdrawAmount = await DAIToken.balanceOf(borrower);

                // borrower repays
                const totalReturnAmount = Number(await Loan.getTotalAmountWithInterest({from: borrower}));
                const interestAmount = totalReturnAmount - fundingAmount;
                await DAIToken.transferAmountToAddress(borrower, interestAmount, {from: owner});
                await DAIToken.approve(DAIProxy.address, totalReturnAmount, { from: borrower });
                await DAIProxy.repay(loanAddress, totalReturnAmount, {from: borrower});

                const loanRepaidEvent = await Loan.getPastEvents('LoanRepaid');
                const loanAddressToRepay = loanRepaidEvent[0].returnValues.loanAddress;

                // lender takes out money
                await Loan.withdrawRepayment(lender, {from: lender});
                await Loan.withdrawRepayment(lender2, {from: lender2});
                await Loan.withdrawRepayment(lender3, {from: lender3});
                const lenderBalanceAfterRepayment = await DAIToken.balanceOf(lender);
                const lender2BalanceAfterRepayment = await DAIToken.balanceOf(lender2);
                const lender3BalanceAfterRepayment = await DAIToken.balanceOf(lender3);
                const lenderAmountInContractAfterWithdraw = await Loan.getLenderAmount(lender);
                const lender2AmountInContractAfterWithdraw = await Loan.getLenderAmount(lender2);
                const lender3AmountInContractAfterWithdraw = await Loan.getLenderAmount(lender3);

                expect(lenderKYC).to.equal(true);
                expect(lender2KYC).to.equal(true);
                expect(lender3KYC).to.equal(true);
                expect(borrowerKYC).to.equal(true);
                expect(lenderHasDeposited).to.equal(true);
                expect(lender2HasDeposited).to.equal(true);
                expect(lender3HasDeposited).to.equal(true);
                expect(Number(loanFundedAmount)).to.equal(loanAmount);
                expect(Number(amountFundedByLender)).to.equal(fundingAmount);
                expect(Number(amountFundedByLender2)).to.equal(fundingAmount2);
                expect(Number(amountFundedByLender3)).to.equal(loanAmount - fundingAmount - fundingAmount2);
                expect(Number(lenderBalance)).to.equal(0);
                expect(Number(lender2Balance)).to.equal(0);
                expect(Number(lender3Balance)).to.equal(90);
                expect(Number(borrowerWithdrawAmount)).to.equal(loanAmount);
                expect(loanAddressToRepay).to.equal(loanAddress);
                expect(Number(lenderBalanceAfterRepayment)).to.equal(Number(lenderAmountWithInterest));
                expect(Number(lender2BalanceAfterRepayment)).to.equal(Number(lender2AmountWithInterest));
                expect(Number(lender3BalanceAfterRepayment)).to.equal(Number(lender3AmountWithInterest) + Number(lender3Balance));
                expect(Number(lenderAmountInContractAfterWithdraw)).to.equal(0);
                expect(Number(lender2AmountInContractAfterWithdraw)).to.equal(0);
                expect(Number(lender3AmountInContractAfterWithdraw)).to.equal(0);
            } catch (error) {
                expect(error).to.equal(undefined);
            }
        });
        it('Expects to work for 2 diff lenders with one of them doing 2 lendings and borrower repays in time', async () => {
            try {
                // borrower creates loan
                const loanTimeLength = 1 * 60 * 60; // 1 day in seconds
                const loanRepaymentTime = 1* 4 * 7 * 24 * 60 * 60; // one month in seconds
                const termLength =  loanRepaymentTime / averageMiningBlockTime;
                const lengthBlocks = loanTimeLength / averageMiningBlockTime;
                const loanAmount = 100;
                const bpMaxInterestRate = 5000;

                await LoanDispatcher.deploy(
                    lengthBlocks,
                    loanAmount,
                    bpMaxInterestRate,
                    termLength,
                    {from: borrower}
                );
                
                const eventHistory = await LoanDispatcher.getPastEvents('LoanContractCreated'); // {fromBlock: 0, toBlock: "latest"} put this to get all
                const loanAddress = eventHistory[0].returnValues.contractAddress;
                
                // create loan instance from loanAddress
                const Loan = await LoanContract.at(loanAddress);

                // wait for time / blocks to pass
                await waitNBlocks(100);
                
                // lenders funds loan
                const fundingAmount = 50;
                const fundingAmount2 = 40;
                const fundingAmount3 = 100;
                await DAIToken.transferAmountToAddress(lender, fundingAmount, {from: owner});
                await DAIToken.transferAmountToAddress(lender2, fundingAmount2, {from: owner});
                await DAIToken.transferAmountToAddress(lender, fundingAmount3, {from: owner});
                await DAIToken.approve(DAIProxy.address, fundingAmount + fundingAmount3, { from: lender });
                await DAIToken.approve(DAIProxy.address, fundingAmount2, { from: lender2 });
                await DAIProxy.fund(loanAddress, fundingAmount, {from: lender});
                await DAIProxy.fund(loanAddress, fundingAmount2, {from: lender2});
                await DAIProxy.fund(loanAddress, fundingAmount3, {from: lender});
                
                // check if loan is funded
                const loanFundedAmount = await Loan.getAlreadyFundedAmount();
                const amountFundedByLender = await Loan.getLenderAmount(lender);
                const amountFundedByLender2 = await Loan.getLenderAmount(lender2);               
                const lenderBalance = await DAIToken.balanceOf(lender);               
                const lender2Balance = await DAIToken.balanceOf(lender2);     
                
                // get lenders amounts with interest
                const lenderAmountWithInterest = await Loan.calculateValueWithInterest(amountFundedByLender);
                const lender2AmountWithInterest = await Loan.calculateValueWithInterest(amountFundedByLender2);

                // wait for time / blocks to pass
                await waitNBlocks(100);

                // borrower takes money from loan
                await Loan.withdrawLoan(borrower, {from: borrower}); 
                
                // check borrower received amount
                const borrowerWithdrawAmount = await DAIToken.balanceOf(borrower);

                // borrower repays
                const totalReturnAmount = Number(await Loan.getTotalAmountWithInterest({from: borrower}));
                const interestAmount = totalReturnAmount - fundingAmount;
                await DAIToken.transferAmountToAddress(borrower, interestAmount, {from: owner});
                await DAIToken.approve(DAIProxy.address, totalReturnAmount, { from: borrower });
                await DAIProxy.repay(loanAddress, totalReturnAmount, {from: borrower});

                const loanRepaidEvent = await Loan.getPastEvents('LoanRepaid');
                const loanAddressToRepay = loanRepaidEvent[0].returnValues.loanAddress;

                // lender takes out money
                await Loan.withdrawRepayment(lender, {from: lender});
                await Loan.withdrawRepayment(lender2, {from: lender2});
                const lenderBalanceAfterRepayment = await DAIToken.balanceOf(lender);
                const lender2BalanceAfterRepayment = await DAIToken.balanceOf(lender2);
                const lenderAmountInContractAfterWithdraw = await Loan.getLenderAmount(lender);
                const lender2AmountInContractAfterWithdraw = await Loan.getLenderAmount(lender2);

                expect(lenderKYC).to.equal(true);
                expect(lender2KYC).to.equal(true);
                expect(borrowerKYC).to.equal(true);
                expect(lenderHasDeposited).to.equal(true);
                expect(lender2HasDeposited).to.equal(true);
                expect(Number(loanFundedAmount)).to.equal(loanAmount);
                expect(Number(amountFundedByLender)).to.equal(fundingAmount + (loanAmount - fundingAmount - fundingAmount2));
                expect(Number(amountFundedByLender2)).to.equal(fundingAmount2);
                expect(Number(lenderBalance)).to.equal(90);
                expect(Number(lender2Balance)).to.equal(0);
                expect(Number(borrowerWithdrawAmount)).to.equal(loanAmount);
                expect(loanAddressToRepay).to.equal(loanAddress);
                expect(Number(lenderBalanceAfterRepayment)).to.equal(Number(lenderAmountWithInterest) + Number(lenderBalance));
                expect(Number(lender2BalanceAfterRepayment)).to.equal(Number(lender2AmountWithInterest));
                expect(Number(lenderAmountInContractAfterWithdraw)).to.equal(0);
                expect(Number(lender2AmountInContractAfterWithdraw)).to.equal(0);
            } catch (error) {
                expect(error).to.equal(undefined);
            }
        });
        it('Expects for lenders to be able to withdraw when loan is not funded in time', async () => {
            try {
                // borrower creates loan
                const loanTimeLength = 1 * 60 * 60; // 1 day in seconds
                const loanRepaymentTime = 1* 4 * 7 * 24 * 60 * 60; // one month in seconds
                const termLength =  loanRepaymentTime / averageMiningBlockTime;
                const lengthBlocks = loanTimeLength / averageMiningBlockTime;
                const loanAmount = 100;
                const bpMaxInterestRate = 5000;

                await LoanDispatcher.deploy(
                    lengthBlocks,
                    loanAmount,
                    bpMaxInterestRate,
                    termLength,
                    {from: borrower}
                );

                const eventHistory = await LoanDispatcher.getPastEvents('LoanContractCreated'); // {fromBlock: 0, toBlock: "latest"} put this to get all
                const loanAddress = eventHistory[0].returnValues.contractAddress;
                
                // create loan instance from loanAddress
                const Loan = await LoanContract.at(loanAddress);

                // wait for time / blocks to pass
                await waitNBlocks(100);

                // lender funds loan
                const fundingAmount = 50;
                await DAIToken.transferAmountToAddress(lender, fundingAmount, {from: owner});
                await DAIToken.approve(DAIProxy.address, fundingAmount, { from: lender });
                await DAIProxy.fund(loanAddress, fundingAmount, {from: lender});

                // wait for loan funding time to expire
                await waitNBlocks(400);
                

                // check if loan is funded
                const loanFundedAmount = await Loan.getAlreadyFundedAmount();
                const amountFundedByLender = await Loan.getLenderAmount(lender);
                
                // lender withdraws funding
                await Loan.withdrawRefund(lender, {from: lender});
                const lenderBalance = await DAIToken.balanceOf(lender);
                const lenderAmountInContractAfterWithdraw = await Loan.getLenderAmount(lender);

                // assertions
                expect(lenderKYC).to.equal(true);
                expect(borrowerKYC).to.equal(true);
                expect(lenderHasDeposited).to.equal(true);
                expect(Number(loanFundedAmount)).to.equal(fundingAmount);
                expect(Number(amountFundedByLender)).to.equal(fundingAmount);
                expect(Number(lenderBalance)).to.equal(fundingAmount);
                expect(Number(lenderAmountInContractAfterWithdraw)).to.equal(0);
            } catch (error) {
                console.log(error)
                expect(error).to.equal(undefined);
            }
        });
        it('Expects to fail when lenders try to withdraw when loan is in state != FAILED_TO_FUND or REPAID', async () => {
            try {
                // borrower creates loan
                const loanTimeLength = 1 * 60 * 60; // 1 day in seconds
                const loanRepaymentTime = 1* 4 * 7 * 24 * 60 * 60; // one month in seconds
                const termLength =  loanRepaymentTime / averageMiningBlockTime;
                const lengthBlocks = loanTimeLength / averageMiningBlockTime;
                const loanAmount = 100;
                const bpMaxInterestRate = 5000;

                await LoanDispatcher.deploy(
                    lengthBlocks,
                    loanAmount,
                    bpMaxInterestRate,
                    termLength,
                    {from: borrower}
                );

                const eventHistory = await LoanDispatcher.getPastEvents('LoanContractCreated'); // {fromBlock: 0, toBlock: "latest"} put this to get all
                const loanAddress = eventHistory[0].returnValues.contractAddress;
                
                // create loan instance from loanAddress
                const Loan = await LoanContract.at(loanAddress);

                // wait for time / blocks to pass
                await waitNBlocks(100);

                // lender funds loan
                const fundingAmount = 50;
                await DAIToken.transferAmountToAddress(lender, fundingAmount, {from: owner});
                await DAIToken.approve(DAIProxy.address, fundingAmount, { from: lender });
                await DAIProxy.fund(loanAddress, fundingAmount, {from: lender});

                // check if loan is funded
                const loanFundedAmount = await Loan.getAlreadyFundedAmount();
                const amountFundedByLender = await Loan.getLenderAmount(lender);
                
                // assertions
                expect(lenderKYC).to.equal(true);
                expect(borrowerKYC).to.equal(true);
                expect(lenderHasDeposited).to.equal(true);
                expect(Number(loanFundedAmount)).to.equal(fundingAmount);
                expect(Number(amountFundedByLender)).to.equal(fundingAmount);

                // lender withdraws funding
                await Loan.withdrawRefund(lender, {from: lender});
            } catch (error) {
                expect(error.reason).to.equal('Incorrect loan state');
            }
        });
        it('Expects to fail when borrower try to withdraw in state != ACTIVE', async () => {
            try {
                // borrower creates loan
                const loanTimeLength = 1 * 60 * 60; // 1 day in seconds
                const loanRepaymentTime = 1* 4 * 7 * 24 * 60 * 60; // one month in seconds
                const termLength =  loanRepaymentTime / averageMiningBlockTime;
                const lengthBlocks = loanTimeLength / averageMiningBlockTime;
                const loanAmount = 100;
                const bpMaxInterestRate = 5000;

                await LoanDispatcher.deploy(
                    lengthBlocks,
                    loanAmount,
                    bpMaxInterestRate,
                    termLength,
                    {from: borrower}
                );

                const eventHistory = await LoanDispatcher.getPastEvents('LoanContractCreated'); // {fromBlock: 0, toBlock: "latest"} put this to get all
                const loanAddress = eventHistory[0].returnValues.contractAddress;
                
                // create loan instance from loanAddress
                const Loan = await LoanContract.at(loanAddress);

                // wait for time / blocks to pass
                await waitNBlocks(100);

                // lender funds loan
                const fundingAmount = 50;
                await DAIToken.transferAmountToAddress(lender, fundingAmount, {from: owner});
                await DAIToken.approve(DAIProxy.address, fundingAmount, { from: lender });
                await DAIProxy.fund(loanAddress, fundingAmount, {from: lender});

                // check if loan is funded
                const loanFundedAmount = await Loan.getAlreadyFundedAmount();
                const amountFundedByLender = await Loan.getLenderAmount(lender);
                
                // assertions
                expect(lenderKYC).to.equal(true);
                expect(borrowerKYC).to.equal(true);
                expect(lenderHasDeposited).to.equal(true);
                expect(Number(loanFundedAmount)).to.equal(fundingAmount);
                expect(Number(amountFundedByLender)).to.equal(fundingAmount);
                
                // borrower takes money from loan
                await Loan.withdrawLoan(borrower, {from: borrower}); 
            } catch (error) {
                expect(error.reason).to.equal('Incorrect loan status');
            }
        });
        it('Expects to fail when borrower tries to repay when loan defaulted', async () => {
            try {
                // borrower creates loan
                const loanTimeLength = 3 * 60; // 1 day in seconds
                const loanRepaymentTime = 2 * 60; // one month in seconds
                const termLength =  loanRepaymentTime / averageMiningBlockTime;
                const lengthBlocks = loanTimeLength / averageMiningBlockTime;
                const loanAmount = 100;
                const bpMaxInterestRate = 5000;

                await LoanDispatcher.deploy(
                    lengthBlocks,
                    loanAmount,
                    bpMaxInterestRate,
                    termLength,
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
                
                // wait for time / blocks to pass so it defaults
                await waitNBlocks(500);

                // check borrower received amount
                const borrowerWithdrawAmount = await DAIToken.balanceOf(borrower);
                
                // assertions
                expect(lenderKYC).to.equal(true);
                expect(borrowerKYC).to.equal(true);
                expect(lenderHasDeposited).to.equal(true);
                expect(Number(loanFundedAmount)).to.equal(fundingAmount);
                expect(Number(amountFundedByLender)).to.equal(fundingAmount);
                expect(Number(borrowerWithdrawAmount)).to.equal(loanAmount);

                // borrower tries to repay loan
                const totalReturnAmount = Number(await Loan.getTotalAmountWithInterest({from: borrower}));
                const interestAmount = totalReturnAmount - fundingAmount;
                await DAIToken.transferAmountToAddress(borrower, interestAmount, {from: owner});
                await DAIToken.approve(DAIProxy.address, totalReturnAmount, { from: borrower });
                await DAIProxy.repay(loanAddress, totalReturnAmount, {from: borrower});
            } catch (error) {
                expect(error.reason).to.equal('Incorrect loan status');
            }
        });
        it('Expects to fail when borrower tries to withdraw when loan defaulted', async () => {
            try {
                // borrower creates loan
                const loanTimeLength = 3 * 60 * 60; // 1 day in seconds
                const loanRepaymentTime = 2 * 60; // one month in seconds
                const termLength =  loanRepaymentTime / averageMiningBlockTime;
                const lengthBlocks = loanTimeLength / averageMiningBlockTime;
                const loanAmount = 100;
                const bpMaxInterestRate = 5000;

                await LoanDispatcher.deploy(
                    lengthBlocks,
                    loanAmount,
                    bpMaxInterestRate,
                    termLength,
                    {from: borrower}
                );

                const eventHistory = await LoanDispatcher.getPastEvents('LoanContractCreated'); // {fromBlock: 0, toBlock: "latest"} put this to get all
                const loanAddress = eventHistory[0].returnValues.contractAddress;
                
                // create loan instance from loanAddress
                const Loan = await LoanContract.at(loanAddress);

                // wait for time / blocks to pass
                await waitNBlocks(100);

                // lender funds loan
                const fundingAmount = 100;
                await DAIToken.transferAmountToAddress(lender, fundingAmount, {from: owner});
                await DAIToken.approve(DAIProxy.address, fundingAmount, { from: lender });
                await DAIProxy.fund(loanAddress, fundingAmount, {from: lender});

                // check if loan is funded
                const loanFundedAmount = await Loan.getAlreadyFundedAmount();
                const amountFundedByLender = await Loan.getLenderAmount(lender);
                const lenderBalance = await DAIToken.balanceOf(lender);
                // wait for time / blocks to pass so it defaults
                await waitNBlocks(500);
                

                // assertions
                expect(lenderKYC).to.equal(true);
                expect(borrowerKYC).to.equal(true);
                expect(lenderHasDeposited).to.equal(true);
                expect(Number(lenderBalance)).to.equal(0);
                expect(Number(loanFundedAmount)).to.equal(fundingAmount);
                expect(Number(amountFundedByLender)).to.equal(fundingAmount);

                // borrower takes money from loan
                await Loan.withdrawLoan(borrower, {from: borrower}); 
            } catch (error) {
                expect(error.reason).to.equal('Incorrect loan status');
            }
        });
        it('Expects to not be able to fund when state != CREATED', async () => {
            try {
                // borrower creates loan
                const loanTimeLength = 1 * 60; // 1 day in seconds
                const loanRepaymentTime = 2 * 60; // one month in seconds
                const termLength =  loanRepaymentTime / averageMiningBlockTime;
                const lengthBlocks = loanTimeLength / averageMiningBlockTime;
                const loanAmount = 100;
                const bpMaxInterestRate = 5000;

                await LoanDispatcher.deploy(
                    lengthBlocks,
                    loanAmount,
                    bpMaxInterestRate,
                    termLength,
                    {from: borrower}
                );

                const eventHistory = await LoanDispatcher.getPastEvents('LoanContractCreated'); // {fromBlock: 0, toBlock: "latest"} put this to get all
                const loanAddress = eventHistory[0].returnValues.contractAddress;
                
                // create loan instance from loanAddress
                const Loan = await LoanContract.at(loanAddress);

                // wait for time / blocks to pass
                await waitNBlocks(200);

                // lender funds loan
                const fundingAmount = 100;
                await DAIToken.transferAmountToAddress(lender, fundingAmount, {from: owner});
                await DAIToken.approve(DAIProxy.address, fundingAmount, { from: lender });
                await DAIProxy.fund(loanAddress, fundingAmount, {from: lender});

                // check if loan is funded
                const loanFundedAmount = await Loan.getAlreadyFundedAmount();
                const amountFundedByLender = await Loan.getLenderAmount(lender);
                const lenderBalance = await DAIToken.balanceOf(lender);

                // assertions
                expect(lenderKYC).to.equal(true);
                expect(borrowerKYC).to.equal(true);
                expect(lenderHasDeposited).to.equal(true);
                expect(Number(lenderBalance)).to.equal(fundingAmount);
                expect(Number(loanFundedAmount)).to.equal(0);
                expect(Number(amountFundedByLender)).to.equal(0); 
            } catch (error) {
                expect(error.reason).to.equal(undefined);
            }
        });
    });
});