const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const { expect } = chai;
const DepositRegistryContract = artifacts.require('DepositRegistry');
const HeroFakeTokenContract = artifacts.require('HeroFakeToken');

const HeroAmount = '200000000000000000000';

contract('Deposit Contract', function (accounts) {

  let token
  let HeroToken
  let DepositRegistry;

  const owner = accounts[0];
  const user = accounts[1];

  describe('deploy', () => {
    it('should be able to deploy and create associated token contract', async () => {
      HeroToken = await HeroFakeTokenContract.new();
      DepositRegistry = await DepositRegistryContract.new(HeroToken.address,  { from: owner });
      await HeroToken.transferFakeHeroTokens(user);
      await HeroToken.approve(DepositRegistry.address, HeroAmount,{ from: user });

      await DepositRegistry.depositFor(user, { from: owner });
      assert.equal(await DepositRegistry.hasDeposited(user), true);

    });

    it('should not be able to successfully call withdraw if the message sender is not deposited', async () => {
      HeroToken = await HeroFakeTokenContract.new();
      DepositRegistry = await DepositRegistryContract.new(HeroToken.address,  { from: owner });
      await HeroToken.transferFakeHeroTokens(user);
      await HeroToken.approve(DepositRegistry.address, HeroAmount,{ from: user });

      await DepositRegistry.depositFor(user, { from: owner });
      try {
        DepositRegistry.withdraw(owner, {from: owner});
      } catch (error) {
        expect(error).to.not.equal(undefined);
      }
    });
  });
});
