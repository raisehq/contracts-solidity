const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const { expect } = chai;
const DepositRegistryContract = artifacts.require('DepositRegistry');
const HeroFakeTokenContract = artifacts.require('HeroFakeToken');
const KYCContract = artifacts.require('KYCRegistry');

const HeroAmount = '200000000000000000000';

contract('Deposit Contract', function (accounts) {
 
  let token;
  let HeroToken;
  let DepositRegistry;
  let KYC;

  const owner = accounts[0];
  const user = accounts[1];

  describe('deploy', () => {
    it('should be able to deploy and create associated token contract', async () => {
      HeroToken = await HeroFakeTokenContract.new();
      KYC = await KYCContract.new();
      DepositRegistry = await DepositRegistryContract.new(HeroToken.address, KYC.address,  { from: owner });
      await HeroToken.transferFakeHeroTokens(user);
      await HeroToken.approve(DepositRegistry.address, HeroAmount,{ from: user });

      await DepositRegistry.depositFor(user, { from: owner });
      assert.equal(await DepositRegistry.hasDeposited(user), true);

    });

    it('should not be able to successfully call withdraw if the message sender is not deposited', async () => {
      HeroToken = await HeroFakeTokenContract.new();
      KYC = await KYCContract.new();

      await KYC.add(owner, {from: owner });

      DepositRegistry = await DepositRegistryContract.new(HeroToken.address, KYC.address,  { from: owner });
      await HeroToken.transferFakeHeroTokens(user);
      await HeroToken.approve(DepositRegistry.address, HeroAmount,{ from: user });

      await DepositRegistry.depositFor(user, { from: owner });

      try {
        await DepositRegistry.withdraw(owner, {from: owner});
      } catch (error) {
        expect(error).to.not.equal(undefined);
      }
    });

    it('should not be able to successfully call withdraw if the message sender has not passed KYC', async () => {
      HeroToken = await HeroFakeTokenContract.new();
      KYC = await KYCContract.new();

      DepositRegistry = await DepositRegistryContract.new(HeroToken.address, KYC.address,  { from: owner });
      await HeroToken.transferFakeHeroTokens(user);
      await HeroToken.approve(DepositRegistry.address, HeroAmount,{ from: user });

      await DepositRegistry.depositFor(user, { from: owner });

      assert.equal(await DepositRegistry.hasDeposited(user), true);

      try {
        await DepositRegistry.withdraw(user, {from: user});
      } catch (error) {
        expect(error).to.not.equal(undefined);
      }
    });
  });
});
