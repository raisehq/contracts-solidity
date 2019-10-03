const DepositContract = artifacts.require("DepositRegistry.sol");
const ReferralTrackerContract = artifacts.require("ReferralTracker.sol");
const HeroTokenContract = artifacts.require("HeroFakeToken.sol");
const KYCContract = artifacts.require("KYCRegistry.sol");
const Utils = require("./audit_utils");
const BigNumber = require("bignumber.js");
const BN = web3.utils.BN;

contract("Subscription module", function(accounts) {
  let deposit, referral, token, kyc;

  const owner = accounts[8];
  const admin = accounts[9];

  const decimals = "1000000000000000000";

  beforeEach(async function() {
    token = await HeroTokenContract.new({from: owner});
    kyc = await KYCContract.new({from: owner});
    deposit = await DepositContract.new(token.address, kyc.address, {from: owner});
    referral = await ReferralTrackerContract.new(deposit.address, token.address, {from: owner});
  });

  describe("ReferralTracker", () => {
    it("check state", async () => {
      await Utils.checkState(
        {referral},
        {
          referral: {
            REFERRAL_BONUS: new BigNumber("100").multipliedBy(decimals).toString(),
            unclaimedReferrals: [
              {[accounts[0]]: new BigNumber("0").multipliedBy(decimals).toString()}
            ],
            registryAddress: deposit.address,
            admin: 0x0
          }
        }
      );
    });
    it("registerReferral & setAdministrator", async () => {
      let referrer = accounts[0];
      let user = accounts[1];
      let depositAddress = accounts[2];
      referral = await ReferralTrackerContract.new(depositAddress, token.address, {from: owner});

      await Utils.checkState(
        {referral},
        {
          referral: {
            REFERRAL_BONUS: new BigNumber("100").multipliedBy(decimals).toString(),
            unclaimedReferrals: [
              {[referrer]: new BigNumber("0").multipliedBy(decimals).toString()}
            ],
            registryAddress: depositAddress,
            admin: 0x0
          }
        }
      );

      await referral
        .registerReferral(referrer, user, {from: user})
        .then(Utils.receiptShouldFailed)
        .catch(Utils.catchReceiptShouldFailed);

      await referral
        .registerReferral(referrer, user, {from: depositAddress})
        .then(Utils.receiptShouldSucceed);

      await referral
        .setAdministrator(admin, {from: user})
        .then(Utils.receiptShouldFailed)
        .catch(Utils.catchReceiptShouldFailed);

      await referral.setAdministrator(admin, {from: owner}).then(Utils.receiptShouldSucceed);

      await Utils.checkState(
        {referral},
        {
          referral: {
            REFERRAL_BONUS: new BigNumber("100").multipliedBy(decimals).toString(),
            unclaimedReferrals: [{[referrer]: new BigNumber(1).multipliedBy(1).toString()}],
            registryAddress: depositAddress,
            admin: admin
          }
        }
      );
    });
    it("addFunds & removeFunds & getTrackerBalance", async () => {
      await token.transferFakeHeroTokens(admin, {from: owner});
      await token.increaseAllowance(
        referral.address,
        new BigNumber("200").multipliedBy(decimals).toString(),
        {from: admin}
      );
      await referral.setAdministrator(admin, {from: owner}).then(Utils.receiptShouldSucceed);
      await Utils.checkState(
        {referral, token},
        {
          referral: {
            REFERRAL_BONUS: new BigNumber("100").multipliedBy(decimals).toString(),
            unclaimedReferrals: [
              {[accounts[0]]: new BigNumber("0").multipliedBy(decimals).toString()}
            ],
            registryAddress: deposit.address,
            admin: admin
          },
          token: {
            balanceOf: [
              {[referral.address]: new BigNumber("0").multipliedBy(decimals).toString()},
              {[admin]: new BigNumber("200").multipliedBy(decimals).toString()}
            ]
          }
        }
      );

      await referral
        .addFunds(new BigNumber("100").multipliedBy(decimals).toString(), {from: owner})
        .then(Utils.receiptShouldFailed)
        .catch(Utils.catchReceiptShouldFailed);

      await referral
        .removeFunds(owner, {from: owner})
        .then(Utils.receiptShouldFailed)
        .catch(Utils.catchReceiptShouldFailed);

      await referral
        .removeFunds(owner, {from: admin})
        .then(Utils.receiptShouldFailed)
        .catch(Utils.catchReceiptShouldFailed);

      await referral
        .addFunds(new BigNumber("100").multipliedBy(decimals).toString(), {from: admin})
        .then(Utils.receiptShouldSucceed);

      assert.equal(
        await referral.getTrackerBalance.call(),
        new BigNumber("100").multipliedBy(decimals).toString(),
        "getTrackerBalance is not equal"
      );

      await Utils.checkState(
        {referral, token},
        {
          referral: {
            REFERRAL_BONUS: new BigNumber("100").multipliedBy(decimals).toString(),
            unclaimedReferrals: [
              {[accounts[0]]: new BigNumber("0").multipliedBy(decimals).toString()}
            ],
            registryAddress: deposit.address,
            admin: admin
          },
          token: {
            balanceOf: [
              {[referral.address]: new BigNumber("100").multipliedBy(decimals).toString()},
              {[admin]: new BigNumber("100").multipliedBy(decimals).toString()},
              {[owner]: new BigNumber("0").multipliedBy(decimals).toString()}
            ]
          }
        }
      );

      await referral.removeFunds(owner, {from: admin}).then(Utils.receiptShouldSucceed);

      assert.equal(
        await referral.getTrackerBalance.call(),
        new BigNumber("0").multipliedBy(decimals).toString(),
        "getTrackerBalance is not equal"
      );

      await Utils.checkState(
        {referral, token},
        {
          referral: {
            REFERRAL_BONUS: new BigNumber("100").multipliedBy(decimals).toString(),
            unclaimedReferrals: [
              {[accounts[0]]: new BigNumber("0").multipliedBy(decimals).toString()}
            ],
            registryAddress: deposit.address,
            admin: admin
          },
          token: {
            balanceOf: [
              {[referral.address]: new BigNumber("0").multipliedBy(decimals).toString()},
              {[admin]: new BigNumber("100").multipliedBy(decimals).toString()},
              {[owner]: new BigNumber("100").multipliedBy(decimals).toString()}
            ]
          }
        }
      );
    });
    it("withdraw", async () => {
      let referrer = accounts[0];
      let user = accounts[1];
      let user2 = accounts[3];
      let depositAddress = accounts[2];
      referral = await ReferralTrackerContract.new(depositAddress, token.address, {from: owner});
      await token.transferFakeHeroTokens(admin, {from: owner});
      await token.increaseAllowance(
        referral.address,
        new BigNumber("200").multipliedBy(decimals).toString(),
        {from: admin}
      );
      await referral.setAdministrator(admin, {from: owner}).then(Utils.receiptShouldSucceed);

      await Utils.checkState(
        {referral},
        {
          referral: {
            REFERRAL_BONUS: new BigNumber("100").multipliedBy(decimals).toString(),
            unclaimedReferrals: [
              {[referrer]: new BigNumber("0").multipliedBy(decimals).toString()}
            ],
            registryAddress: depositAddress,
            admin: admin
          }
        }
      );

      await referral
        .withdraw(user2, {from: referrer})
        .then(Utils.receiptShouldFailed)
        .catch(Utils.catchReceiptShouldFailed);

      await referral
        .registerReferral(referrer, user, {from: depositAddress})
        .then(Utils.receiptShouldSucceed);

      await referral
        .withdraw(user2, {from: referrer})
        .then(Utils.receiptShouldFailed)
        .catch(Utils.catchReceiptShouldFailed);

      await referral
        .addFunds(new BigNumber("100").multipliedBy(decimals).toString(), {from: admin})
        .then(Utils.receiptShouldSucceed);

      await Utils.checkState(
        {referral, token},
        {
          referral: {
            REFERRAL_BONUS: new BigNumber("100").multipliedBy(decimals).toString(),
            unclaimedReferrals: [{[referrer]: new BigNumber(1).multipliedBy(1).toString()}],
            registryAddress: depositAddress,
            admin: admin
          },
          token: {
            balanceOf: [
              {[referral.address]: new BigNumber("100").multipliedBy(decimals).toString()},
              {[admin]: new BigNumber("100").multipliedBy(decimals).toString()},
              {[user2]: new BigNumber("0").multipliedBy(decimals).toString()}
            ]
          }
        }
      );

      await referral.withdraw(user2, {from: referrer}).then(Utils.receiptShouldSucceed);

      await Utils.checkState(
        {referral, token},
        {
          referral: {
            REFERRAL_BONUS: new BigNumber("100").multipliedBy(decimals).toString(),
            unclaimedReferrals: [{[referrer]: new BigNumber(0).multipliedBy(1).toString()}],
            registryAddress: depositAddress,
            admin: admin
          },
          token: {
            balanceOf: [
              {[referral.address]: new BigNumber("0").multipliedBy(decimals).toString()},
              {[admin]: new BigNumber("100").multipliedBy(decimals).toString()},
              {[user2]: new BigNumber("100").multipliedBy(decimals).toString()}
            ]
          }
        }
      );
    });
  });

  describe("DepositRegistry", () => {
    it("check state & setReferralTracker & setAdministrator", async () => {
      await Utils.checkState(
        {deposit},
        {
          deposit: {
            admin: 0x0,
            ref: 0x0
          }
        }
      );

      await deposit
        .setReferralTracker(referral.address, {from: accounts[3]})
        .then(Utils.receiptShouldFailed)
        .catch(Utils.catchReceiptShouldFailed);

      await deposit
        .setAdministrator(admin, {from: accounts[3]})
        .then(Utils.receiptShouldFailed)
        .catch(Utils.catchReceiptShouldFailed);

      await deposit
        .setReferralTracker(referral.address, {from: owner})
        .then(Utils.receiptShouldSucceed);

      await deposit.setAdministrator(admin, {from: owner}).then(Utils.receiptShouldSucceed);

      await Utils.checkState(
        {deposit},
        {
          deposit: {
            admin: admin,
            ref: referral.address
          }
        }
      );
    });
    it("depositFor & depositForWithReferral & hasDeposited", async () => {
      const referrerAddress = accounts[3];
      const user = accounts[2];
      await deposit
        .setReferralTracker(referral.address, {from: owner})
        .then(Utils.receiptShouldSucceed);

      await deposit.setAdministrator(admin, {from: owner}).then(Utils.receiptShouldSucceed);

      await token.transferFakeHeroTokens(user, {from: owner});
      await token.transferFakeHeroTokens(referrerAddress, {from: owner});

      await Utils.checkState(
        {deposit, token},
        {
          deposit: {
            admin: admin,
            ref: referral.address
          },
          token: {
            balanceOf: [
              {[deposit.address]: new BigNumber("0").multipliedBy(decimals).toString()},
              {[referrerAddress]: new BigNumber("200").multipliedBy(decimals).toString()},
              {[user]: new BigNumber("200").multipliedBy(decimals).toString()}
            ]
          }
        }
      );

      assert.equal(
        await deposit.hasDeposited.call(referrerAddress),
        false,
        "hasDeposited is not equal"
      );
      assert.equal(await deposit.hasDeposited.call(user), false, "hasDeposited is not equal");

      await deposit
        .depositFor(referrerAddress)
        .then(Utils.receiptShouldFailed)
        .catch(Utils.catchReceiptShouldFailed);

      await token.increaseAllowance(
        deposit.address,
        new BigNumber("200").multipliedBy(decimals).toString(),
        {from: referrerAddress}
      );

      await deposit.depositFor(referrerAddress).then(Utils.receiptShouldSucceed);

      await Utils.checkState(
        {deposit, token},
        {
          deposit: {
            admin: admin,
            ref: referral.address
          },
          token: {
            balanceOf: [
              {[deposit.address]: new BigNumber("200").multipliedBy(decimals).toString()},
              {[referrerAddress]: new BigNumber("0").multipliedBy(decimals).toString()},
              {[user]: new BigNumber("200").multipliedBy(decimals).toString()}
            ]
          }
        }
      );

      assert.equal(
        await deposit.hasDeposited.call(referrerAddress),
        true,
        "hasDeposited is not equal"
      );
      assert.equal(await deposit.hasDeposited.call(user), false, "hasDeposited is not equal");

      await deposit
        .depositFor(referrerAddress)
        .then(Utils.receiptShouldFailed)
        .catch(Utils.catchReceiptShouldFailed);

      await deposit
        .depositForWithReferral(referrerAddress, referrerAddress, {from: referrerAddress})
        .then(Utils.receiptShouldFailed)
        .catch(Utils.catchReceiptShouldFailed);

      await deposit
        .depositForWithReferral(referrerAddress, user, {from: referrerAddress})
        .then(Utils.receiptShouldFailed)
        .catch(Utils.catchReceiptShouldFailed);

      await deposit
        .depositForWithReferral(user, referrerAddress, {from: referrerAddress})
        .then(Utils.receiptShouldFailed)
        .catch(Utils.catchReceiptShouldFailed);

      await token.increaseAllowance(
        deposit.address,
        new BigNumber("200").multipliedBy(decimals).toString(),
        {from: user}
      );

      await deposit
        .depositForWithReferral(user, referrerAddress, {from: referrerAddress})
        .then(Utils.receiptShouldFailed)
        .catch(Utils.catchReceiptShouldFailed);

      await deposit
        .depositForWithReferral(user, referrerAddress, {from: user})
        .then(Utils.receiptShouldSucceed);

      await Utils.checkState(
        {deposit, token},
        {
          deposit: {
            admin: admin,
            ref: referral.address
          },
          token: {
            balanceOf: [
              {[deposit.address]: new BigNumber("400").multipliedBy(decimals).toString()},
              {[referrerAddress]: new BigNumber("0").multipliedBy(decimals).toString()},
              {[user]: new BigNumber("0").multipliedBy(decimals).toString()}
            ]
          }
        }
      );

      assert.equal(
        await deposit.hasDeposited.call(referrerAddress),
        true,
        "hasDeposited is not equal"
      );
      assert.equal(await deposit.hasDeposited.call(user), true, "hasDeposited is not equal");

      await deposit
        .depositForWithReferral(user, referrerAddress, {from: user})
        .then(Utils.receiptShouldFailed)
        .catch(Utils.catchReceiptShouldFailed);
    });
    it("unlockAddressForWithdrawal & isUnlocked & withdraw", async () => {
      const referrerAddress = accounts[3];
      const user = accounts[2];
      await deposit
        .setReferralTracker(referral.address, {from: owner})
        .then(Utils.receiptShouldSucceed);

      await deposit.setAdministrator(admin, {from: owner}).then(Utils.receiptShouldSucceed);

      await token.transferFakeHeroTokens(user, {from: owner});
      await token.transferFakeHeroTokens(referrerAddress, {from: owner});

      await Utils.checkState(
        {deposit, token},
        {
          deposit: {
            admin: admin,
            ref: referral.address
          },
          token: {
            balanceOf: [
              {[deposit.address]: new BigNumber("0").multipliedBy(decimals).toString()},
              {[referrerAddress]: new BigNumber("200").multipliedBy(decimals).toString()},
              {[user]: new BigNumber("200").multipliedBy(decimals).toString()}
            ]
          }
        }
      );

      await token.increaseAllowance(
        deposit.address,
        new BigNumber("200").multipliedBy(decimals).toString(),
        {from: referrerAddress}
      );

      await deposit.depositFor(referrerAddress).then(Utils.receiptShouldSucceed);

      await Utils.checkState(
        {deposit, token},
        {
          deposit: {
            admin: admin,
            ref: referral.address
          },
          token: {
            balanceOf: [
              {[deposit.address]: new BigNumber("200").multipliedBy(decimals).toString()},
              {[referrerAddress]: new BigNumber("0").multipliedBy(decimals).toString()},
              {[user]: new BigNumber("200").multipliedBy(decimals).toString()},
              {[accounts[4]]: new BigNumber("0").multipliedBy(decimals).toString()}
            ]
          }
        }
      );

      assert.equal(
        await deposit.isUnlocked.call(referrerAddress),
        false,
        "isUnlocked is not equal"
      );

      await deposit
        .unlockAddressForWithdrawal(referrerAddress, {from: accounts[0]})
        .then(Utils.receiptShouldFailed)
        .catch(Utils.catchReceiptShouldFailed);

      await deposit
        .unlockAddressForWithdrawal(user, {from: admin})
        .then(Utils.receiptShouldFailed)
        .catch(Utils.catchReceiptShouldFailed);

      await deposit
        .withdraw(accounts[4], {from: referrerAddress})
        .then(Utils.receiptShouldFailed)
        .catch(Utils.catchReceiptShouldFailed);

      await deposit
        .unlockAddressForWithdrawal(referrerAddress, {from: admin})
        .then(Utils.receiptShouldSucceed);

      assert.equal(await deposit.isUnlocked.call(referrerAddress), true, "isUnlocked is not equal");

      await token.increaseAllowance(
        deposit.address,
        new BigNumber("200").multipliedBy(decimals).toString(),
        {from: user}
      );

      await deposit
        .depositForWithReferral(user, referrerAddress, {from: user})
        .then(Utils.receiptShouldSucceed);

      await deposit
        .withdraw(accounts[4], {from: owner})
        .then(Utils.receiptShouldFailed)
        .catch(Utils.catchReceiptShouldFailed);

      await deposit
        .withdraw(accounts[4], {from: user})
        .then(Utils.receiptShouldFailed)
        .catch(Utils.catchReceiptShouldFailed);

      await kyc.setAdministrator(admin, {from: owner});

      await kyc.addAddressToKYC(user, {from: admin}).then(Utils.receiptShouldSucceed);

      await deposit.withdraw(accounts[4], {from: user}).then(Utils.receiptShouldSucceed);

      await deposit.withdraw(accounts[4], {from: referrerAddress}).then(Utils.receiptShouldSucceed);

      await Utils.checkState(
        {deposit, token},
        {
          deposit: {
            admin: admin,
            ref: referral.address
          },
          token: {
            balanceOf: [
              {[deposit.address]: new BigNumber("0").multipliedBy(decimals).toString()},
              {[referrerAddress]: new BigNumber("0").multipliedBy(decimals).toString()},
              {[user]: new BigNumber("0").multipliedBy(decimals).toString()},
              {[accounts[4]]: new BigNumber("400").multipliedBy(decimals).toString()}
            ]
          }
        }
      );
    });
  });
});
