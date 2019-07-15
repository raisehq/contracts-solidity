const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const truffleAssert = require('truffle-assertions');
const { expect } = chai;
const web3 = global.web3;
const DAIProxyContract = artifacts.require('DAIProxy');
const HeroFakeTokenContract = artifacts.require('HeroFakeToken');
const LoanContract = artifacts.require('LoanContract');
const AuthContract = artifacts.require('Authorization');
const DepositRegistryContract = artifacts.require('DepositRegistry');
const KYCContract = artifacts.require('KYCRegistry');

const LoanContractDispatcherContract = artifacts.require('LoanContractDispatcher');

const HeroAmount = '200000000000000000000';
const helpers = require('./helpers.js');

contract('LoanContractDispatcher', (accounts) => {
    let DAIProxy;
    let DAIToken;
    let DepositRegistry;
    let KYCRegistry;
    let Auth;
    let LoanDispatcher;

    const averageMiningBlockTime = 15;

    const owner = accounts[0];
    const lender = accounts[1];
    const borrower = accounts[2];
    const admin = accounts[3];

    describe('Unit tests for LoanContractDispatcher', () => {
        before(async () => {
            try {
                DAIToken = await HeroFakeTokenContract.new({from: owner});
                HeroToken = await HeroFakeTokenContract.new({from: owner});

                // adding lender and borrower to KYC
                KYCRegistry = await KYCContract.new();
                await KYCRegistry.setAdministrator(admin);
                await KYCRegistry.addAddressToKYC(borrower, {from: admin});
                
                // give permision to the deposit registry to deposit tokens instead of the lender
                DepositRegistry = await DepositRegistryContract.new(HeroToken.address,  KYCRegistry.address, { from: owner});

                // initialize proxies for lender and borrower
                Auth = await AuthContract.new(KYCRegistry.address, DepositRegistry.address);
                DAIProxy = await DAIProxyContract.new(Auth.address, DAIToken.address, {from: owner});

                // check KYC and Deposit
                borrowerKYC = await Auth.isKYCConfirmed(borrower);

                lenderHasDeposited = await Auth.hasDeposited(lender);
            } catch (error) {
                throw error;
            }
        });
        describe('Min Max setters', () => {
            beforeEach(async () => {
                // initialize loan contract dispatcher
                LoanDispatcher = await LoanContractDispatcherContract.new(Auth.address, DAIToken.address, DAIProxy.address, {from:owner});
            });
            it('Expects to set administrator as owner', async() => {
                await LoanDispatcher.setAdministrator(admin, {from: owner});
                const administrator = await LoanDispatcher.administrator();
                expect(administrator).to.equal(admin);
            });
            it('Expects to not be able set administrator as not owner', async() => {
                try {
                    await LoanDispatcher.setAdministrator(admin, {from: owner});
                } catch (error) {
                    expect(error).to.not.equal(undefined);
                }
            });
            it('Expects to not be able to change fixed min amount', async() => {
                try {
                    await LoanDispatcher.setMinAmount(2000, {from: owner});
                } catch (error) {
                    expect(error).to.not.equal(undefined);
                }
            });
            it('Expects to not be able to change fixed max amount', async() => {
                try {
                    await LoanDispatcher.setMaxAmount(2000, {from: owner});
                } catch (error) {
                    expect(error).to.not.equal(undefined);
                }
            });
            it('Expects to not be able to change fixed min interest', async() => {
                try {
                    await LoanDispatcher.setMinInterestRate(2000, {from: owner});
                } catch (error) {
                    expect(error).to.not.equal(undefined);
                }
            });
            it('Expects to not be able to change fixed max interest', async() => {
                try {
                    await LoanDispatcher.setMaxInterestRate(2000, {from: owner});
                } catch (error) {
                    expect(error).to.not.equal(undefined);
                }
            });
            it('Expects to change fixed min amount if admin', async() => {
                try {
                    await LoanDispatcher.setAdministrator(admin, {from: owner});
                    await LoanDispatcher.setMinAmount(2000, {from: admin});
                    const fixedMinAmount = Number(await LoanDispatcher.minAmount());
                    expect(fixedMinAmount).to.equal(2000);
                } catch (error) {
                    expect(error).to.equal(undefined);
                }
            });
            it('Expects to change fixed max amount if admin', async() => {
                try {
                    await LoanDispatcher.setAdministrator(admin, {from: owner});
                    await LoanDispatcher.setMaxAmount(2000, {from: admin});
                    const fixedMaxAmount = Number(await LoanDispatcher.maxAmount());
                    expect(fixedMaxAmount).to.equal(2000);
                } catch (error) {
                    expect(error).to.equal(undefined);
                }
            });
            it('Expects to change fixed min interest if admin', async() => {
                try {
                    await LoanDispatcher.setAdministrator(admin, {from: owner});
                    await LoanDispatcher.setMinInterestRate(2000, {from: admin});
                    const fixedMinInterest = Number(await LoanDispatcher.minInterestRate());
                    expect(fixedMinInterest).to.equal(2000);
                } catch (error) {
                    expect(error).to.equal(undefined);
                }
            });
            it('Expects to change fixed max interest if admin', async() => {
                try {
                    await LoanDispatcher.setAdministrator(admin, {from: owner});
                    await LoanDispatcher.setMaxInterestRate(2000, {from: admin});
                    const fixedMaxInterest = Number(await LoanDispatcher.maxInterestRate());
                    expect(fixedMaxInterest).to.equal(2000);
                } catch (error) {
                    expect(error).to.equal(undefined);
                }
            });
            it('Expects to not change fixed min amount if greater than max amount', async() => {
                try {
                    await LoanDispatcher.setAdministrator(admin, {from: owner});
                    await LoanDispatcher.setMaxAmount(2000, {from: admin});
                    await LoanDispatcher.setMinAmount(3000, {from: admin});
                } catch (error) {
                    expect(error).to.not.equal(undefined);
                }
            });
            it('Expects to change fixed max amount if lesser than min amount', async() => {
                try {
                    await LoanDispatcher.setAdministrator(admin, {from: owner});
                    await LoanDispatcher.setMinAmount(3000, {from: admin});
                    await LoanDispatcher.setMaxAmount(2000, {from: admin});
                } catch (error) {
                    expect(error).to.not.equal(undefined);
                }
            });
            it('Expects to change fixed min interest if greater than max interest', async() => {
                try {
                    await LoanDispatcher.setAdministrator(admin, {from: owner});
                    await LoanDispatcher.setMaxInterestRate(2000, {from: admin});
                    await LoanDispatcher.setMinInterestRate(3000, {from: admin});
                } catch (error) {
                    expect(error).to.not.equal(undefined);
                }
            });
            it('Expects to change fixed max interest if lesser than min interest', async() => {
                try {
                    await LoanDispatcher.setAdministrator(admin, {from: owner});
                    await LoanDispatcher.setMinInterestRate(3000, {from: admin});
                    await LoanDispatcher.setMaxInterestRate(2000, {from: admin});
                } catch (error) {
                    expect(error).to.not.equal(undefined);
                }
            });
        });
        describe('Deployment of loan contracts', async() => {
            beforeEach(async () => {
                // initialize loan contract dispatcher
                LoanDispatcher = await LoanContractDispatcherContract.new(Auth.address, DAIToken.address, DAIProxy.address, {from:owner});
            });
            it('Expects not to deploy loan when min amount does not comply with limits', async () => {
                try {
                    await LoanDispatcher.setAdministrator(admin, {from: owner});

                    const auctionBlockLength = 20;
                    const minAmount = 100;
                    const maxAmount = 30000;
                    const maxInterestRate = 2000;
                    const termEndTimestamp = 1000;

                    await LoanDispatcher.deploy(
                        auctionBlockLength,
                        minAmount,
                        maxAmount,
                        maxInterestRate,
                        termEndTimestamp,
                        {from: borrower}
                    );
                } catch (error) {
                    expect(error).to.not.equal(undefined);
                }
            });
            it('Expects not to deploy loan when max amount does not comply with limits', async () => {
                try {
                    await LoanDispatcher.setAdministrator(admin, {from: owner});

                    const auctionBlockLength = 20;
                    const minAmount = 1000;
                    const maxAmount = 3000000000000;
                    const maxInterestRate = 2000;
                    const termEndTimestamp = 1000;

                    await LoanDispatcher.deploy(
                        auctionBlockLength,
                        minAmount,
                        maxAmount,
                        maxInterestRate,
                        termEndTimestamp,
                        {from: borrower}
                    );
                } catch (error) {
                    expect(error).to.not.equal(undefined);
                }
            });
            it('Expects not to deploy loan when interest does not comply with limits', async () => {
                try {
                    await LoanDispatcher.setAdministrator(admin, {from: owner});

                    const auctionBlockLength = 20;
                    const minAmount = 1000;
                    const maxAmount = 30000;
                    const maxInterestRate = 20000;
                    const termEndTimestamp = 1000;

                    await LoanDispatcher.deploy(
                        auctionBlockLength,
                        minAmount,
                        maxAmount,
                        maxInterestRate,
                        termEndTimestamp,
                        {from: borrower}
                    );
                } catch (error) {
                    expect(error).to.not.equal(undefined);
                }
            });
            it('Expects to deploy loan contract when conditions are correct', async () => {
                try {
                    await LoanDispatcher.setAdministrator(admin, {from: owner});
                    
                    const auctionBlockLength = 20;
                    const minAmount = 1000;
                    const maxAmount = 30000;
                    const maxInterestRate = 1500;
                    const termEndTimestamp = 1000;

                    await LoanDispatcher.deploy(
                        auctionBlockLength,
                        minAmount,
                        maxAmount,
                        maxInterestRate,
                        termEndTimestamp,
                        {from: borrower}
                    );
                    const loanEventHistory = await LoanDispatcher.getPastEvents('LoanContractCreated'); // {fromBlock: 0, toBlock: "latest"} put this to get all
                    const loanAddress = loanEventHistory[0].returnValues.contractAddress;
                    expect(loanAddress).to.not.equal(undefined);
                } catch (error) {
                    expect(error).to.equal(undefined);
                }
            });
            it('Expects not to deploy loan contract when admin is not set', async () => {
                try {
                    const auctionBlockLength = 20;
                    const minAmount = 1000;
                    const maxAmount = 30000;
                    const maxInterestRate = 1500;
                    const termEndTimestamp = 1000;

                    await LoanDispatcher.deploy(
                        auctionBlockLength,
                        minAmount,
                        maxAmount,
                        maxInterestRate,
                        termEndTimestamp,
                        {from: borrower}
                    );
                } catch (error) {
                    expect(error).to.not.equal(undefined);
                }
            });

        });
    });
});
