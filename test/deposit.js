const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const { expect } = chai;
const DepositRegistryContract = artifacts.require('DepositRegistry');
const HeroFakeTokenContract = artifacts.require('HeroFakeToken');
contract('Deposit Contract', function (accounts) {
 
  let token
  let HeroToken
  let DepositRegistry;

  const owner = accounts[0]
  const user = accounts[1]

  describe('deploy', () => {
    it('should be able to deploy and create associated token contract', async () => {
      HeroToken = await HeroFakeTokenContract.new()
      DepositRegistry = await DepositRegistryContract.new(HeroToken.address,  { from: owner, gas:200000000});
      await HeroToken.transferFakeHeroTokens(user);
      await HeroToken.approve(DepositRegistry.address, 200,{ from: user, gas:200000000 });

      await DepositRegistry.depositFor(user, { from: owner, gas:200000000 });
      assert.equal(await DepositRegistry.hasDeposited(user), true);
      
    });
  });
})
