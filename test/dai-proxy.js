const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const { expect } = chai;
const DAIProxyContract = artifacts.require('DAIProxy');
const AuthContract = artifacts.require('Authorization');
const DepositRegistryContract = artifacts.require('DepositRegistry');
const HeroFakeTokenContract = artifacts.require('HeroFakeToken');
const KYCContract = artifacts.require('KYCRegistry');
const MockLoanContract = artifacts.require('LoanContractMock');

const HeroAmount = '200000000000000000000';

contract('DAIProxy Contract', function (accounts) {
    let DAIProxy;
    let Auth;
    let HeroFakeToken;
    let DepositRegistry;
    let KYCRegistry;
    let DAIToken;
    let LoanContract;

    const owner = accounts[0];
    const user = accounts[1];
    const admin = accounts[2];

  describe('DAIProxy contract', () => {
    before(async () =>  {
        try {
            HeroFakeToken = await HeroFakeTokenContract.new({from: owner});
            DAIToken = await HeroFakeTokenContract.new({from: owner});
            await HeroFakeToken.transferFakeHeroTokens(user, {from: owner});
            await DAIToken.transferFakeHeroTokens(user, {from: owner});
            LoanContract = await MockLoanContract.new({from: owner});
            KYCRegistry = await KYCContract.new();
            await KYCRegistry.setAdministrator(admin);
            DepositRegistry = await DepositRegistryContract.new(HeroFakeToken.address,  KYCRegistry.address, { from: owner});
            Auth = await AuthContract.new(KYCRegistry.address, DepositRegistry.address);
            DAIProxy = await DAIProxyContract.new(Auth.address, DAIToken.address);
        } catch (error) {
            throw error;
        }
    });
    /**
     * user represents a lender in these tests
     */
    describe('Should allow loan funding', () => {
        it('Expects the amount of dai tokens to be reduced in the amount funded', async () => {
            try {
                await HeroFakeToken.approve(DepositRegistry.address, HeroAmount, { from: user });
                await DepositRegistry.depositFor(user, {from: user});
                await KYCRegistry.addAddressToKYC(user,{from:admin});
                const userBalanceBefore = await DAIToken.balanceOf(user);
                await DAIToken.approve(DAIProxy.address, 100, { from: user });
                await DAIProxy.fund(LoanContract.address, 100, {from: user});

                const userBalanceAfter = await DAIToken.balanceOf(user);
                expect(Number(userBalanceAfter)).to.equal(Number(userBalanceBefore) - 100);
            } catch (error) {
                expect(error).to.equal(undefined);
            }
        });
        it('Expects an error when there are not enough dai funds', async () => {
            try {
                await HeroFakeToken.approve(DepositRegistry.address, HeroAmount, { from: user });
                await DepositRegistry.depositFor(user, {from: user});
                await KYCRegistry.addAddressToKYC(user, {from:admin});
                await DAIToken.approve(DAIProxy.address, 10, { from: user });
                await DAIProxy.fund(LoanContract.address, 100, {from: user});
            } catch (error) {
                expect(error).to.not.equal(undefined);
            }
        });
        it('Expects an error when user not KYC', async () => {
            try {
                await HeroFakeToken.approve(DepositRegistry.address, HeroAmount, { from: user });
                await DepositRegistry.depositFor(user, {from: user});
                await DAIToken.approve(DAIProxy.address, 10, { from: user });
                await DAIProxy.fund(LoanContract.address, 100, {from: user});
            } catch (error) {
                expect(error).to.not.equal(undefined);
            }
        });
        it('Expects an error when user not hero tokens deposited', async () => {
            try {
                KYCRegistry = await KYCContract.new();
                await DAIToken.approve(DAIProxy.address, 10, { from: user });
                await DAIProxy.fund(LoanContract.address, 100, {from: user});
            } catch (error) {
                expect(error).to.not.equal(undefined);
            }
        });
    });
    /**
     * user represents the loan borrower in these tests
     */
    describe('Should allow loan repayments', () => {
        it('Expects the amount of dai tokens to be reduced in the amount repaid', async () => {
            try {
                await KYCRegistry.setAdministrator(admin, {from: owner});
                await KYCRegistry.addAddressToKYC(user, {from: admin});

                const userBalanceBefore = await DAIToken.balanceOf(user);
                await DAIToken.approve(DAIProxy.address, 100, { from: user });
                await DAIProxy.repay(LoanContract.address, 100, {from: user});

                const userBalanceAfter = await DAIToken.balanceOf(user);
                expect(Number(userBalanceAfter)).to.equal(Number(userBalanceBefore) - 100);
            } catch (error) {
                expect(error).to.equal(undefined);
            }
        });
        it('Expects an error when there are not enough dai funds', async () => {
            try {
                await KYCRegistry.addAddressToKYC(user, {from: admin});
                await DAIToken.approve(DAIProxy.address, 10, { from: user });
                await DAIProxy.repay(LoanContract.address, 100, {from: user});
            } catch (error) {
                expect(error).to.not.equal(undefined);
            }
        });
        it('Expects an error when user not KYC', async () => {
            try {
                await DAIToken.approve(DAIProxy.address, 10, { from: user });
                await DAIProxy.repay(LoanContract.address, 100, {from: user});
            } catch (error) {
                expect(error).to.not.equal(undefined);
            }
        });
    });
    
});
})
