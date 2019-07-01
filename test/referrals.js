const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const { expect } = chai;
const DepositRegistryContract = artifacts.require('DepositRegistry');
const HeroFakeTokenContract = artifacts.require('HeroFakeToken');
const ReferralTracker = artifacts.require('ReferralTracker');
const KYCContract = artifacts.require('KYCRegistry');

const HeroAmount = '200000000000000000000';

contract('Referral Tracker', function (accounts) {

  let token;
  let HeroToken;
  let DepositRegistry;
  let ReferralContract;
  let KYC;

  const owner = accounts[0];
  const user = accounts[1];

  describe('referral tracker tests', () => {
    beforeEach(async () => {
      try {
        HeroToken = await HeroFakeTokenContract.new();
        KYC = await KYCContract.new();
        DepositRegistry = await DepositRegistryContract.new(HeroToken.address, KYC.address, { from: owner });
        ReferralContract = await ReferralTracker.new(DepositRegistry.address, HeroToken.address, { from: owner });
        await DepositRegistry.setReferralTracker(ReferralContract.address);
      } catch (error) {
        throw error;
      }
    });
    it('The depositForWithReferral should update the counter in the ReferralTracker correctly', async () => {
      await HeroToken.transferFakeHeroTokens(user);
      await HeroToken.approve(DepositRegistry.address, HeroAmount,{ from: user });

      await DepositRegistry.depositForWithReferral(user, owner, { from: user });
      assert.equal(await ReferralContract.numReferrals(owner), 1);
    });
    it('The owner should be able to seed the contract with tokens, and the referrer should be able to withdraw', async () => {

      await HeroToken.transferFakeHeroTokens(user);
      await HeroToken.approve(DepositRegistry.address, HeroAmount,{ from: user });

      await DepositRegistry.depositForWithReferral(user, owner, { from: user });

      await HeroToken.transferFakeHeroTokens(owner);
      await HeroToken.approve(ReferralContract.address, HeroAmount,{ from: owner });

      await ReferralContract.drawFunds(HeroAmount);

      assert.equal(await HeroToken.balanceOf(ReferralContract.address), HeroAmount);

      await ReferralContract.withdraw(owner, {from: owner});

      assert.equal(await HeroToken.balanceOf(ReferralContract.address), HeroAmount/2);
      assert.equal(await HeroToken.balanceOf(owner), HeroAmount/2);
      assert.equal(await ReferralContract.numReferrals(owner), 0);
    });
  });
});
