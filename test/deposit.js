const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
const {expect} = chai;
const DepositRegistryContract = artifacts.require("DepositRegistry");
const DepositRegistryOldContract = artifacts.require("OldDepositRegistry");
const HeroFakeTokenContract = artifacts.require("HeroFakeToken");
const RaiseFake = artifacts.require("RaiseFake");
const KYCContract = artifacts.require("KYCRegistry");
const ReferralTrackerContract = artifacts.require("ReferralTracker");
const truffleAssert = require("truffle-assertions");

const HeroAmount = "200000000000000000000";
const zeroAddress = "0x0000000000000000000000000000000000000000";

contract("Deposit Contract", function(accounts) {
  let HeroToken;
  let DepositRegistry;
  let DepositRegistryOld;
  let ReferralTracker;
  let KYC;

  const owner = accounts[0];
  const user = accounts[1];
  const admin = accounts[2];
  const referrer = accounts[3];
  const other = accounts[4];

  describe("Deposit Registry", () => {
    before(async () => {
      try {
        HeroToken = await HeroFakeTokenContract.new();
        KYC = await KYCContract.new({from: owner});
        await KYC.setAdministrator(admin);
      } catch (error) {
        throw error;
      }
    });
    describe("Migration test", () => {
      beforeEach(async () => {
        DepositRegistryOld = await DepositRegistryOldContract.new(HeroToken.address, KYC.address, {
          from: owner
        });
        DepositRegistry = await DepositRegistryContract.new(HeroToken.address, KYC.address, {
          from: owner
        });

        DepositRegistryOld.setAdministrator(admin, {from: owner});
        DepositRegistry.setAdministrator(admin, {from: owner});

        await HeroToken.transferFakeHeroTokens(user);
        await HeroToken.approve(DepositRegistryOld.address, HeroAmount, {from: user});
        await DepositRegistryOld.depositFor(user);
      });
      it("Expects to migrate all addresses", async () => {
        try {
          await DepositRegistry.migrate([user], DepositRegistryOld.address, {from: owner});
          await DepositRegistry.finishMigration({from: owner});
          const deposited = await DepositRegistry.hasDeposited(user);
          expect(deposited).to.equal(true);
        } catch (error) {
          console.log(error);
          expect(error).to.equal(undefined);
        }
      });
      it("Expects to fail if migration already done", async () => {
        await DepositRegistry.finishMigration({from: owner});
        await truffleAssert.fails(
          DepositRegistry.migrate([user], DepositRegistryOld.address, {from: owner}),
          truffleAssert.ErrorType.REVERT,
          "Migration already done"
        );
      });
      it("Expects to fail if migration already done and calls to finish migration", async () => {
        await DepositRegistry.finishMigration({from: owner});
        await truffleAssert.fails(
          DepositRegistry.finishMigration({from: owner}),
          truffleAssert.ErrorType.REVERT,
          "Migration already done"
        );
      });
      it("Expects to fail if caller is not the owner", async () => {
        await DepositRegistry.finishMigration({from: owner});
        await truffleAssert.fails(
          DepositRegistry.migrate([user], DepositRegistryOld.address, {from: user}),
          truffleAssert.ErrorType.REVERT,
          "caller is not the owner"
        );
      });
      it("Expects to fail migration when migrating addresses do not exist in old contract", async () => {
        await truffleAssert.fails(
          DepositRegistry.migrate([other, other, other], DepositRegistryOld.address, {
            from: owner
          }),
          truffleAssert.ErrorType.REVERT,
          "Depositor does not have deposit in old Registry"
        );
      });
      it("Expects to fail when addresses already migrated", async () => {
        await DepositRegistry.migrate([user], DepositRegistryOld.address, {from: owner});
        await truffleAssert.fails(
          DepositRegistry.migrate([user], DepositRegistryOld.address, {from: owner}),
          truffleAssert.ErrorType.REVERT,
          "Depositor already deposited"
        );
      });
      it("Expects hasDeposit to return false if withdraw from old registry", async () => {
        await DepositRegistry.migrate([user], DepositRegistryOld.address, {from: owner});

        const priorDepositedNewRegistry = await DepositRegistry.hasDeposited(user);
        const priorDepositedOldRegistry = await DepositRegistryOld.hasDeposited(user);

        expect(priorDepositedNewRegistry).to.equal(true);
        expect(priorDepositedOldRegistry).to.equal(true);

        // Unlock and withdraw
        await DepositRegistryOld.unlockAddressForWithdrawal(user, {from: admin});
        await DepositRegistryOld.withdraw(user, {from: user});

        const depositedNewRegistry = await DepositRegistry.hasDeposited(user);
        const depositedOldRegistry = await DepositRegistryOld.hasDeposited(user);
        console.log("de", depositedNewRegistry, depositedOldRegistry);

        expect(depositedNewRegistry).to.equal(false);
        expect(depositedOldRegistry).to.equal(false);
      });
    });
    describe("method setAdministrator", () => {
      before(async () => {
        DepositRegistry = await DepositRegistryContract.new(HeroToken.address, KYC.address, {
          from: owner
        });
        await HeroToken.transferFakeHeroTokens(user);
      });
      it("Expects to set administrator if caller is owner", async () => {
        await DepositRegistry.setAdministrator(admin, {from: owner});
        const administrator = await DepositRegistry.admin();
        expect(admin).to.equal(administrator);
      });
      it("Expects to fail if caller is not owner", async () => {
        await truffleAssert.fails(
          DepositRegistry.setAdministrator(admin, {from: user}),
          truffleAssert.ErrorType.REVERT,
          "caller is not the owner"
        );
      });
      it("Expects to fail if arg is zero address", async () => {
        await truffleAssert.fails(
          DepositRegistry.setAdministrator(zeroAddress, {from: owner}),
          truffleAssert.ErrorType.REVERT,
          "Address needs to be valid"
        );
      });
    });
    describe("method setReferralTracker", () => {
      before(async () => {
        DepositRegistry = await DepositRegistryContract.new(HeroToken.address, KYC.address, {
          from: owner
        });
        await HeroToken.transferFakeHeroTokens(user);
      });
      it("Expects to set referral tracker if owner", async () => {
        ReferralTracker = await ReferralTrackerContract.new(
          DepositRegistry.address,
          HeroToken.address
        );
        await DepositRegistry.setReferralTracker(ReferralTracker.address, {from: owner});
        const ref = await DepositRegistry.ref();
        expect(ref).to.equal(ReferralTracker.address);
      });
      it("Expects to not set referral tracker if not owner", async () => {
        await truffleAssert.fails(
          DepositRegistry.setReferralTracker(admin, {from: user}),
          truffleAssert.ErrorType.REVERT,
          "caller is not the owner"
        );
      });
      it("Expects to not set referral tracker if zero address", async () => {
        await truffleAssert.fails(
          DepositRegistry.setReferralTracker(zeroAddress, {from: owner}),
          truffleAssert.ErrorType.REVERT,
          "Address needs to be valid"
        );
      });
    });
    describe("method hasDeposited", () => {
      beforeEach(async () => {
        DepositRegistry = await DepositRegistryContract.new(HeroToken.address, KYC.address, {
          from: owner
        });
        await HeroToken.transferFakeHeroTokens(user);
      });
      it("Expects to get true if user has deposited", async () => {
        await HeroToken.transferFakeHeroTokens(user);
        await HeroToken.approve(DepositRegistry.address, HeroAmount, {from: user});
        await DepositRegistry.depositFor(user, {from: user});
        const deposited = await DepositRegistry.hasDeposited(user);
        expect(deposited).to.equal(true);
      });
      it("Expects to get false if user has not deposited", async () => {
        const deposited = await DepositRegistry.hasDeposited(user);
        expect(deposited).to.equal(false);
      });
    });
    describe("method delegateDeposit", () => {
      beforeEach(async () => {
        DepositRegistry = await DepositRegistryContract.new(HeroToken.address, KYC.address, {
          from: owner
        });
        await HeroToken.transferFakeHeroTokens(user);
      });
      it("Expects to get true if user has deposited", async () => {
        await HeroToken.transferFakeHeroTokens(owner);
        await HeroToken.approve(DepositRegistry.address, HeroAmount, {from: owner});
        await DepositRegistry.delegateDeposit(user, {from: owner});
        const deposited = await DepositRegistry.hasDeposited(user);
        expect(deposited).to.equal(true);
      });
      it("Expects to get false if other user does not approve", async () => {
        await HeroToken.transferFakeHeroTokens(owner);
        await truffleAssert.fails(
          DepositRegistry.delegateDeposit(user, {from: owner}),
          truffleAssert.ErrorType.REVERT,
          "address not approved amount"
        );
        const deposited = await DepositRegistry.hasDeposited(user);
        expect(deposited).to.equal(false);
      });
    });
    describe("method depositFor", () => {
      beforeEach(async () => {
        DepositRegistry = await DepositRegistryContract.new(HeroToken.address, KYC.address, {
          from: owner
        });
        await HeroToken.transferFakeHeroTokens(user);
      });
      it("Expects the deposit to be done if no deposited and has amount aproved", async () => {
        try {
          await HeroToken.approve(DepositRegistry.address, HeroAmount, {from: user});
          await DepositRegistry.depositFor(user, {from: user});
          const deposited = await DepositRegistry.hasDeposited(user);
          const balance = Number(await HeroToken.balanceOf(DepositRegistry.address));

          expect(deposited).to.equal(true);
          expect(balance).to.equal(Number(HeroAmount));
        } catch (error) {
          throw error;
        }
      });
      it("Expects to fail when address already deposited", async () => {
        await HeroToken.approve(DepositRegistry.address, HeroAmount, {from: user});
        await DepositRegistry.depositFor(user, {from: user});
        await truffleAssert.fails(
          DepositRegistry.depositFor(user, {from: user}),
          truffleAssert.ErrorType.REVERT,
          "already deposited"
        );
      });
      it("Expects to fail when amount not approved", async () => {
        await truffleAssert.fails(
          DepositRegistry.depositFor(user, {from: user}),
          truffleAssert.ErrorType.REVERT,
          "address not approved amount"
        );
      });
    });
    describe("method depositForWithReferral", () => {
      beforeEach(async () => {
        DepositRegistry = await DepositRegistryContract.new(HeroToken.address, KYC.address, {
          from: owner
        });
        ReferralTracker = await ReferralTrackerContract.new(
          DepositRegistry.address,
          HeroToken.address
        );
        await DepositRegistry.setReferralTracker(ReferralTracker.address, {from: owner});
        await HeroToken.transferFakeHeroTokens(user);
        await HeroToken.transferFakeHeroTokens(referrer);
      });
      it("Expects deposit to be done correctly", async () => {
        try {
          await HeroToken.approve(DepositRegistry.address, HeroAmount, {from: user});
          await HeroToken.approve(DepositRegistry.address, HeroAmount, {from: referrer});
          await DepositRegistry.depositFor(referrer, {from: referrer});
          await DepositRegistry.depositForWithReferral(user, referrer, {from: user});

          const deposited = await DepositRegistry.hasDeposited(user);
          const balance = Number(await HeroToken.balanceOf(DepositRegistry.address));
          expect(deposited).to.equal(true);
          expect(balance).to.equal(Number(HeroAmount) * 2);
        } catch (error) {
          expect(error).to.equal(undefined);
        }
      });
      it("Expects deposit to fail if referrer has not deposited", async () => {
        await HeroToken.approve(DepositRegistry.address, HeroAmount, {from: user});
        await truffleAssert.fails(
          DepositRegistry.depositForWithReferral(user, referrer, {from: user}),
          truffleAssert.ErrorType.REVERT,
          "referrer has not deposited"
        );
      });
      it("Expects deposit to fail if user already deposited", async () => {
        await HeroToken.approve(DepositRegistry.address, HeroAmount, {from: user});
        await HeroToken.approve(DepositRegistry.address, HeroAmount, {from: referrer});
        await DepositRegistry.depositFor(referrer, {from: referrer});
        await DepositRegistry.depositFor(user, {from: user});

        await truffleAssert.fails(
          DepositRegistry.depositForWithReferral(user, referrer, {from: user}),
          truffleAssert.ErrorType.REVERT,
          "alredy deposited"
        );
      });
      it("Expects deposit to fail if user has not approved amount", async () => {
        await HeroToken.approve(DepositRegistry.address, HeroAmount, {from: referrer});
        await DepositRegistry.depositFor(referrer, {from: referrer});

        await truffleAssert.fails(
          DepositRegistry.depositForWithReferral(user, referrer, {from: user}),
          truffleAssert.ErrorType.REVERT,
          "address not approved amount"
        );
      });
      it("Expects deposit to fail if address and caller are not the same", async () => {
        await HeroToken.approve(DepositRegistry.address, HeroAmount, {from: referrer});
        await DepositRegistry.depositFor(referrer, {from: referrer});
        await truffleAssert.fails(
          DepositRegistry.depositForWithReferral(referrer, referrer, {from: referrer}),
          truffleAssert.ErrorType.REVERT,
          "can not refer to itself"
        );
      });
    });
    describe("method withdraw", () => {
      beforeEach(async () => {
        DepositRegistryOld = await DepositRegistryOldContract.new(HeroToken.address, KYC.address, {
          from: owner
        });
        DepositRegistry = await DepositRegistryContract.new(HeroToken.address, KYC.address, {
          from: owner
        });

        DepositRegistryOld.setAdministrator(admin, {from: owner});
        DepositRegistry.setAdministrator(admin, {from: owner});

        await HeroToken.transferFakeHeroTokens(user);
        await HeroToken.approve(DepositRegistryOld.address, HeroAmount, {from: user});
        await DepositRegistryOld.depositFor(user);
      });
      it("Expect to fail if funds have not been previously deposited", async () => {
        await truffleAssert.fails(
          DepositRegistry.withdraw(user, {from: owner}),
          truffleAssert.ErrorType.REVERT,
          "address not deposited"
        );
      });
      it("Expect to fail if lender is not verified or not unlocked", async () => {
        await HeroToken.approve(DepositRegistry.address, HeroAmount, {from: user});
        await DepositRegistry.depositFor(user, {from: user});

        const deposited = await DepositRegistry.hasDeposited(user);
        expect(deposited).to.equal(true);
        await truffleAssert.fails(
          DepositRegistry.withdraw(user, {from: user}),
          truffleAssert.ErrorType.REVERT,
          "cannot withdraw without KYC or unlocked"
        );
      });
      it("Expects to be able to withdraw if caller is verified", async () => {
        await HeroToken.approve(DepositRegistry.address, HeroAmount, {from: user});
        const balanceBefore = Number(await HeroToken.balanceOf(user));
        await DepositRegistry.depositFor(user, {from: user});
        await KYC.addAddressToKYC(user, {from: admin});

        const deposited = await DepositRegistry.hasDeposited(user);
        expect(deposited).to.equal(true);
        await DepositRegistry.withdraw(user, {from: user});

        const balanceAfter = Number(await HeroToken.balanceOf(user));
        const deposit = await DepositRegistry.hasDeposited(user);

        expect(balanceBefore).to.equal(balanceAfter);
        expect(deposit).to.equal(false);
      });
      it("Expects to be able to withdraw if caller is unblocked", async () => {
        await DepositRegistry.setAdministrator(admin, {from: owner});
        await HeroToken.approve(DepositRegistry.address, HeroAmount, {from: user});
        const balanceBefore = Number(await HeroToken.balanceOf(user));
        await DepositRegistry.depositFor(user, {from: user});

        await DepositRegistry.unlockAddressForWithdrawal(user, {from: admin});

        await DepositRegistry.withdraw(user, {from: user});

        const balanceAfter = Number(await HeroToken.balanceOf(user));
        const deposit = await DepositRegistry.hasDeposited(user);

        expect(balanceBefore).to.equal(balanceAfter);
        expect(deposit).to.equal(false);
      });

      it("Expects to NOT be able to withdraw if caller is from migrated deposit", async () => {
        await DepositRegistry.migrate([user], DepositRegistryOld.address, {from: owner});
        await DepositRegistry.finishMigration({from: owner});
        const deposited = await DepositRegistry.hasDeposited(user);
        expect(deposited).to.equal(true);

        truffleAssert.fails(
          DepositRegistry.withdraw(user, {from: user}),
          truffleAssert.ErrorType.REVERT,
          "run getDepositRegistryByUser to get the deposit address to withdraw"
        );

        const deposit = await DepositRegistry.hasDeposited(user);

        expect(deposit).to.equal(true);
      });
      it("Expects to withdraw after getting the old deposit address", async () => {
        await DepositRegistry.migrate([user], DepositRegistryOld.address, {from: owner});
        await DepositRegistry.finishMigration({from: owner});
        const deposited = await DepositRegistry.hasDeposited(user);
        expect(deposited).to.equal(true);

        const oldDepositAddress = await DepositRegistry.getDepositRegistryByUser(user);
        const oldDepositTruffle = await DepositRegistryOldContract.at(oldDepositAddress);
        await truffleAssert.passes(oldDepositTruffle.withdraw(user, {from: user}));

        const deposit = await DepositRegistry.hasDeposited(user);
        const oldDeposit = await oldDepositTruffle.hasDeposited(user);

        expect(deposit).to.equal(false);
        expect(oldDeposit).to.equal(false);
      });
    });
    describe("Setters", () => {
      beforeEach(async () => {
        DepositRegistry = await DepositRegistryContract.new(HeroToken.address, KYC.address, {
          from: owner
        });
        await HeroToken.transferFakeHeroTokens(user);
        await DepositRegistry.setAdministrator(admin);
      });
      it("setERC20Token can be called by admin", async () => {
        const newToken = await RaiseFake.new();
        await DepositRegistry.setERC20Token(newToken.address, {from: admin});
        const newTokenInDeposit = await DepositRegistry.getERC20Token();
        expect(newTokenInDeposit).to.be.equal(newToken.address);
      });
      it("setERC20Token can NOT be called by other", async () => {
        const newToken = await RaiseFake.new();
        const currentToken = await DepositRegistry.getERC20Token();
        await truffleAssert.fails(
          DepositRegistry.setERC20Token(newToken.address, {from: other}),
          truffleAssert.ErrorType.REVERT
        );
        const afterToken = await DepositRegistry.getERC20Token();
        expect(currentToken).to.be.equal(afterToken);
      });
      it("setERC20Token can NOT be zero address", async () => {
        const currentToken = await DepositRegistry.getERC20Token();
        await truffleAssert.fails(
          DepositRegistry.setERC20Token(zeroAddress, {from: admin}),
          truffleAssert.ErrorType.REVERT
        );
        const afterToken = await DepositRegistry.getERC20Token();
        expect(currentToken).to.be.equal(afterToken);
      });
      it("setKYC can be called by admin", async () => {
        const newKyc = await KYCContract.new();
        await DepositRegistry.setKYC(newKyc.address, {from: admin});
        const newKycInDeposit = await DepositRegistry.kyc();
        expect(newKycInDeposit).to.be.equal(newKyc.address);
      });
      it("setKYC argument can not be zero address", async () => {
        const currentKyc = await DepositRegistry.kyc();
        await truffleAssert.fails(
          DepositRegistry.setKYC(zeroAddress, {from: admin}),
          truffleAssert.ErrorType.REVERT
        );
        const afterKyc = await DepositRegistry.kyc();
        expect(currentKyc.address).to.be.equal(afterKyc.address);
      });
      it("setKYC can NOT be called by other", async () => {
        const newKyc = await KYCContract.new();
        const currentKyc = await DepositRegistry.kyc();
        await truffleAssert.fails(
          DepositRegistry.setKYC(newKyc.address, {from: other}),
          truffleAssert.ErrorType.REVERT
        );
        const afterKyc = await DepositRegistry.kyc();
        expect(currentKyc.address).to.be.equal(afterKyc.address);
      });
    });
    describe("method unlockAddressForWithdrawal", () => {
      beforeEach(async () => {
        DepositRegistry = await DepositRegistryContract.new(HeroToken.address, KYC.address, {
          from: owner
        });
        await HeroToken.transferFakeHeroTokens(user);
        await DepositRegistry.setAdministrator(admin);
      });
      it("Expects to fail if caller is not admin", async () => {
        await truffleAssert.fails(
          DepositRegistry.unlockAddressForWithdrawal(user, {from: owner}),
          truffleAssert.ErrorType.REVERT,
          "caller is not the admin"
        );
      });
      it("Expects to fail if addres has not deposited beforehand", async () => {
        await HeroToken.approve(DepositRegistry.address, HeroAmount, {from: user});

        await truffleAssert.fails(
          DepositRegistry.unlockAddressForWithdrawal(user, {from: admin}),
          truffleAssert.ErrorType.REVERT,
          "address has not deposited"
        );
      });
      it("Expects to unlock address correctly", async () => {
        await HeroToken.approve(DepositRegistry.address, HeroAmount, {from: user});
        await DepositRegistry.depositFor(user, {from: user});

        await DepositRegistry.unlockAddressForWithdrawal(user, {from: admin});
        const unlocked = await DepositRegistry.isUnlocked(user);

        expect(unlocked).to.equal(true);
      });
    });
  });
});
