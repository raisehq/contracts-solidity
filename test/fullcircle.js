const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
chai.use(chaiAsPromised)
const { expect } = chai
const truffleAssert = require('truffle-assertions');
const web3 = global.web3; //require('web3');
const DAIProxyContract = artifacts.require('DAIProxy');
const HeroFakeTokenContract = artifacts.require('HeroFakeToken');
const LoanContract = artifacts.require('LoanContract');
const AuthContract = artifacts.require('Authorization');
const DepositRegistryContract = artifacts.require('DepositRegistry');
const KYCContract = artifacts.require('KYCRegistry');

const LoanContractDispatcherContract = artifacts.require('LoanContractDispatcher');


const waitNBlocks = async n => {
    for(let i = 0; i < n; i += 1) {
        console.log(`Mined ${i} blocks`);
        await web3.currentProvider.send({
            jsonrpc: '2.0',
            method: 'evm_mine',
            id: i
            });
    }
    
    // await Promise.all(

    //   [...Array(n).keys()].map(i =>
    //     {
    //         console.log(`Mined ${i} blocks`);
    //         return web3.currentProvider.send({
    //             jsonrpc: '2.0',
    //             method: 'evm_mine',
    //             id: i
    //             });
                
    //     }
        
    //   )
    // );
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
                // giving the lender herotokens and daitokens
                DAIToken = await HeroFakeTokenContract.new({from: owner});
                DAITokenBorrower = await HeroFakeTokenContract.new({from: owner}); // we dont send dai to borrwer yet
                await DAIToken.transferFakeHeroTokens(lender, {from: owner});
                
                HeroToken = await HeroFakeTokenContract.new({from: owner});
                await HeroToken.transferFakeHeroTokens(lender, {from: owner});

                // give permision to the deposit registry to deposit tokens instead of the lender
                DepositRegistry = await DepositRegistryContract.new(HeroToken.address,  { from: owner});
                await HeroToken.approve(DepositRegistry.address, 200, { from: lender });
                await DepositRegistry.depositFor(lender, {from: owner});

                // adding lender and borrower to KYC
                KYCRegistry = await KYCContract.new();
                await KYCRegistry.add(lender);
                await KYCRegistry.add(borrower);

                // initialize proxies for lender and borrower
                Auth = await AuthContract.new(KYCRegistry.address, DepositRegistry.address);
                DAIProxy = await DAIProxyContract.new(Auth.address, DAIToken.address, {from: owner});

                // initialize loan contract dispatcher
                LoanDispatcher = await LoanContractDispatcherContract.new(Auth.address, DAIToken.address, DAIProxy.address, {from:owner});
            } catch (error) {
                throw error;
            }
        });
        it('Expects a lot of things', async () => {
            try {
                // borrower creates loan
                const loanTimeLength = 1 * 7 * 24 * 60 * 60; // 1 week in seconds
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

                await waitNBlocks(100);

                const eventHistory = await LoanDispatcher.getPastEvents('LoanContractCreated'); // {fromBlock: 0, toBlock: "latest"} put this to get all
                const loanAddress = eventHistory[0].returnValues.contractAddress;
                
                // console.log('-----> event history:: ', eventHistory[0]);
                // console.log('----> loan address::: ', loanAddress);

                // lender funds loan
                const fundingAmount = 100;
                
                await DAIToken.approve(DAIProxy.address, 100, { from: lender });
                await DAIProxy.fund(loanAddress, fundingAmount, {from: lender});
                
                // borrower takes money from loan
                const Loan = await LoanContract.at(loanAddress);
                await Loan.withdrawLoan(borrower, {from: borrower});
                
                // borrower repays loan
                const totalReturnAmount = await Loan.getTotalAmountWithInterest({from: borrower});
                console.log('total ammount::> ', Number(totalReturnAmount));
                // await DAIProxy.repay(loanAddress, )

            } catch (error) {
                console.log(error);
                expect(error).to.equal(undefined);
            }
        })
    });



});