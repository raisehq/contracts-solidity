const DepositContract = artifacts.require("DepositRegistry.sol");
const ReferralTrackerContract = artifacts.require("ReferralTracker.sol");
const HeroTokenContract = artifacts.require("HeroFakeToken.sol");
const KYCContract = artifacts.require("KYCRegistry.sol");
const Authorization = artifacts.require("Authorization.sol");
const Utils = require("./audit_utils");
const BigNumber = require("bignumber.js");
const BN = web3.utils.BN;

contract("Authorization module", function(accounts) {
  let deposit, referral, token, kyc, authorization;

  const owner = accounts[8];
  const admin = accounts[9];

  const decimals = "1000000000000000000";

  beforeEach(async function() {
    token = await HeroTokenContract.new({from: owner});
    kyc = await KYCContract.new({from: owner});
    deposit = await DepositContract.new(token.address, kyc.address, {from: owner});
    referral = await ReferralTrackerContract.new(deposit.address, token.address, {from: owner});
    authorization = await Authorization.new(kyc.address, deposit.address, {from: owner});
  });

  describe("Authorization", () => {
    it("hasDeposited & isKYCConfirmed", async () => {
      const user = accounts[1];

      assert.equal(await authorization.hasDeposited.call(user), false, "hasDeposited is not equal");
      assert.equal(
        await authorization.isKYCConfirmed.call(user),
        false,
        "isKYCConfirmed is not equal"
      );
      await deposit
        .setReferralTracker(referral.address, {from: owner})
        .then(Utils.receiptShouldSucceed);
      await deposit.setAdministrator(admin, {from: owner}).then(Utils.receiptShouldSucceed);
      await token.transferFakeHeroTokens(user, {from: owner});
      await token.increaseAllowance(
        deposit.address,
        new BigNumber("200").multipliedBy(decimals).toString(),
        {from: user}
      );
      await deposit.depositFor(user, {from: user}).then(Utils.receiptShouldSucceed);

      await kyc.setAdministrator(admin, {from: owner});
      await kyc.addAddressToKYC(user, {from: admin}).then(Utils.receiptShouldSucceed);

      assert.equal(await authorization.hasDeposited.call(user), true, "hasDeposited is not equal");
      assert.equal(
        await authorization.isKYCConfirmed.call(user),
        true,
        "isKYCConfirmed is not equal"
      );
    });
  });
  describe("KYCRegistry", () => {
    it("check state", async () => {
      await Utils.checkState(
        {kyc},
        {
          kyc: {
            KYCConfirmed: [{[accounts[0]]: false}],
            admin: 0x0
          }
        }
      );
    });
    it("setAdministrator & addAddressToKYC & isConfirmed & removeAddressFromKYC", async () => {
      const user = accounts[1];
      await Utils.checkState(
        {kyc},
        {
          kyc: {
            KYCConfirmed: [{[user]: false}],
            admin: 0x0
          }
        }
      );

      await kyc
        .setAdministrator(admin, {from: admin})
        .then(Utils.receiptShouldFailed)
        .catch(Utils.catchReceiptShouldFailed);
      await kyc.setAdministrator(admin, {from: owner}).then(Utils.receiptShouldSucceed);

      await kyc
        .addAddressToKYC(user, {from: user})
        .then(Utils.receiptShouldFailed)
        .catch(Utils.catchReceiptShouldFailed);
      assert.equal(await kyc.isConfirmed.call(user), false, "isConfirmed is not equal");
      await kyc.addAddressToKYC(user, {from: admin}).then(Utils.receiptShouldSucceed);
      await kyc
        .addAddressToKYC(user, {from: admin})
        .then(Utils.receiptShouldFailed)
        .catch(Utils.catchReceiptShouldFailed);
      assert.equal(await kyc.isConfirmed.call(user), true, "isConfirmed is not equal");

      await Utils.checkState(
        {kyc},
        {
          kyc: {
            KYCConfirmed: [{[user]: true}],
            admin: admin
          }
        }
      );

      await kyc
        .removeAddressFromKYC(user, {from: user})
        .then(Utils.receiptShouldFailed)
        .catch(Utils.catchReceiptShouldFailed);
      await kyc.removeAddressFromKYC(user, {from: admin}).then(Utils.receiptShouldSucceed);

      assert.equal(await kyc.isConfirmed.call(user), false, "isConfirmed is not equal");

      await Utils.checkState(
        {kyc},
        {
          kyc: {
            KYCConfirmed: [{[user]: false}],
            admin: admin
          }
        }
      );

      await kyc
        .removeAddressFromKYC(user, {from: admin})
        .then(Utils.receiptShouldFailed)
        .catch(Utils.catchReceiptShouldFailed);
    });
  });
});
