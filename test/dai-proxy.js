const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
chai.use(chaiAsPromised)
const { expect } = chai
const DAIProxyContract = artifacts.require('DAIProxy');
const AuthContract = artifacts.require('Authorization');
const DepositRegistryContract = artifacts.require('DepositRegistry');
const HeroFakeTokenContract = artifacts.require('HeroFakeToken');
const KYCContract = artifacts.require('KYCRegistry');
const MockLoanContract = artifacts.require('LoanContractMock');

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

  describe('deploy DAIProxy contract', () => {
    describe('Test fund function', () => {
      beforeEach(async () => {
          try {
                HeroFakeToken = await HeroFakeTokenContract.new({from: owner});
                DAIToken = await HeroFakeTokenContract.new({from: owner});
                await HeroFakeToken.transferFakeHeroTokens(user, {from: owner});
                await DAIToken.transferFakeHeroTokens(user, {from: owner});
                LoanContract = await MockLoanContract.new({from: owner});
                DepositRegistry = await DepositRegistryContract.new(HeroFakeToken.address,  { from: owner});
            } catch (error) {
                throw error;
            }
        });
        it('Expects the amount of dai tokens to be reduced in the amount funded', async () => {
            try {
                await HeroFakeToken.approve(DepositRegistry.address, 200, { from: user });
                await DepositRegistry.depositFor(user, {from: owner});
                KYCRegistry = await KYCContract.new();
                await KYCRegistry.add(user);
                Auth = await AuthContract.new(KYCRegistry.address, DepositRegistry.address);
                DAIProxy = await DAIProxyContract.new(Auth.address, DAIToken.address);
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
                await HeroFakeToken.approve(DepositRegistry.address, 200, { from: user });
                await DepositRegistry.depositFor(user, {from: owner});
                KYCRegistry = await KYCContract.new();
                await KYCRegistry.add(user);
                Auth = await AuthContract.new(KYCRegistry.address, DepositRegistry.address);
                DAIProxy = await DAIProxyContract.new(Auth.address, DAIToken.address);
                await DAIToken.approve(DAIProxy.address, 10, { from: user });
                await DAIProxy.fund(LoanContract.address, 100, {from: user});
            } catch (error) {
                expect(error).to.not.equal(undefined);
            }
        });
        it('Expects an error when user not KYC', async () => {
            try {
                await HeroFakeToken.approve(DepositRegistry.address, 200, { from: user });
                await DepositRegistry.depositFor(user, {from: owner});
                KYCRegistry = await KYCContract.new();
                Auth = await AuthContract.new(KYCRegistry.address, DepositRegistry.address);
                DAIProxy = await DAIProxyContract.new(Auth.address, DAIToken.address);
                await DAIToken.approve(DAIProxy.address, 10, { from: user });
                await DAIProxy.fund(LoanContract.address, 100, {from: user});
            } catch (error) {
                expect(error).to.not.equal(undefined);
            }
        });
        it('Expects an error when user not hero tokens deposited', async () => {
            try {
                KYCRegistry = await KYCContract.new();
                await KYCRegistry.add(user);
                Auth = await AuthContract.new(KYCRegistry.address, DepositRegistry.address);
                DAIProxy = await DAIProxyContract.new(Auth.address, DAIToken.address);
                await DAIToken.approve(DAIProxy.address, 10, { from: user });
                await DAIProxy.fund(LoanContract.address, 100, {from: user});
            } catch (error) {
                expect(error).to.not.equal(undefined);
            }
        });
    });
    describe('Test repay function', () => {
        beforeEach(async () => {
            try {
                HeroFakeToken = await HeroFakeTokenContract.new({from: owner});
                DAIToken = await HeroFakeTokenContract.new({from: owner});
                await HeroFakeToken.transferFakeHeroTokens(user, {from: owner});
                await DAIToken.transferFakeHeroTokens(user, {from: owner});
                LoanContract = await MockLoanContract.new({from: owner});
                DepositRegistry = await DepositRegistryContract.new(HeroFakeToken.address,  { from: owner});
            } catch (error) {
                throw error;
            }
        });
        it('Expects the amount of dai tokens to be reduced in the amount repaid', async () => {
            try {
                await HeroFakeToken.approve(DepositRegistry.address, 200, { from: user });
                await DepositRegistry.depositFor(user, {from: owner});
                KYCRegistry = await KYCContract.new();
                await KYCRegistry.add(user);
                Auth = await AuthContract.new(KYCRegistry.address, DepositRegistry.address);
                DAIProxy = await DAIProxyContract.new(Auth.address, DAIToken.address);
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
                await HeroFakeToken.approve(DepositRegistry.address, 200, { from: user });
                await DepositRegistry.depositFor(user, {from: owner});
                KYCRegistry = await KYCContract.new();
                await KYCRegistry.add(user);
                Auth = await AuthContract.new(KYCRegistry.address, DepositRegistry.address);
                DAIProxy = await DAIProxyContract.new(Auth.address, DAIToken.address);
                await DAIToken.approve(DAIProxy.address, 10, { from: user });
                await DAIProxy.repay(LoanContract.address, 100, {from: user});
            } catch (error) {
                expect(error).to.not.equal(undefined);
            }
        });
        it('Expects an error when user not KYC', async () => {
            try {
                await HeroFakeToken.approve(DepositRegistry.address, 200, { from: user });
                await DepositRegistry.depositFor(user, {from: owner});
                KYCRegistry = await KYCContract.new();
                Auth = await AuthContract.new(KYCRegistry.address, DepositRegistry.address);
                DAIProxy = await DAIProxyContract.new(Auth.address, DAIToken.address);
                await DAIToken.approve(DAIProxy.address, 10, { from: user });
                await DAIProxy.repay(LoanContract.address, 100, {from: user});
            } catch (error) {
                expect(error).to.not.equal(undefined);
            }
        });
    });
    
});
})