const chai = require("chai");
const web3 = global.web3;
const {toWei, fromWei, BN} = web3.utils;
const chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
const {expect} = chai;
const DepositRegistryContract = artifacts.require("DepositRegistry");
const ReferralTracker = artifacts.require("ReferralTracker");
const DAITokenContract = artifacts.require("DAIFake");
const RaiseContract = artifacts.require("RaiseFake");
const KYCContract = artifacts.require("KYCRegistry");
const AuthContract = artifacts.require("Authorization");
const truffleAssert = require("truffle-assertions");

const HeroAmount = "200000000000000000000";

contract("Referral Tracker", function(accounts) {
  let DAIToken;
  let Auth;
  let KYCRegistry;
  let DepositRegistry;
  let ReferralContract;
  let RaiseToken;
  let Bonus;

  const owner = accounts[0];
  const user = accounts[1];
  const referrer = accounts[2];
  const admin = accounts[3];
  const user2 = accounts[4];
  const referrer2 = accounts[5];

  const generateReferral = async () => {
    try {
      RaiseToken = await RaiseContract.new({from: owner});
      KYCRegistry = await KYCContract.new();
      await KYCRegistry.setAdministrator(admin);
      DepositRegistry = await DepositRegistryContract.new(RaiseToken.address, KYCRegistry.address, {
        from: owner
      });
      Auth = await AuthContract.new(KYCRegistry.address, DepositRegistry.address);
      Bonus = new BN("50000000000000000000");
      DAIToken = await DAITokenContract.new({from: owner});
      ReferralContract = await ReferralTracker.new(Auth.address, owner, DAIToken.address, Bonus, {
        from: owner
      });
    } catch (error) {
      throw error;
    }
  };

  describe("referral tracker tests", () => {
    describe("Pausable tests", () => {
      beforeEach(async () => {
        try {
          await generateReferral();
        } catch (error) {
          throw error;
        }
      });
      it("Expects to add pauser", async () => {
        await ReferralContract.addPauser(admin);
        const isPauser = await ReferralContract.isPauser(admin);
        expect(isPauser).to.equal(true);
      });
      it("Expects admin to be able pause the contract", async () => {
        await ReferralContract.addPauser(admin);
        await ReferralContract.pause({from: admin});
        const isPaused = await ReferralContract.paused();
        expect(isPaused).to.equal(true);
      });
      it("Expects admin to be able to unpause the contract", async () => {
        await ReferralContract.addPauser(admin);
        await ReferralContract.pause({from: admin});
        const isPaused = await ReferralContract.paused();
        expect(isPaused).to.equal(true);
        await ReferralContract.unpause({from: admin});
        const isUnpaused = await ReferralContract.paused();
        expect(isUnpaused).to.equal(false);
      });
    });
    describe("method setAdministrator", () => {
      beforeEach(async () => {
        try {
          await generateReferral();
        } catch (error) {
          throw error;
        }
      });
      it("Expects to set administrator if caller is owner", async () => {
        await ReferralContract.setAdministrator(admin, {from: owner});
        const administrator = await ReferralContract.admin();
        expect(admin).to.equal(administrator);
      });
      it("Expects to fail if caller is not owner", async () => {
        await truffleAssert.fails(
          ReferralContract.setAdministrator(admin, {from: user}),
          truffleAssert.ErrorType.REVERT,
          "caller is not the owner"
        );
      });
    });
    describe("method addRegistryAddress", () => {
      beforeEach(async () => {
        await generateReferral();
      });
      it("Expects to add correct address to registry if caller is admin", async () => {
        await ReferralContract.setAdministrator(admin, {from: owner});
        await ReferralContract.addRegistryAddress(admin, {from: admin});
        const registryaddr = await ReferralContract.isAddressInRegistry(admin);
        expect(registryaddr).to.equal(true);
      });
      it("Expects not to add address to registry if address not correct and caller is admin", async () => {
        await ReferralContract.setAdministrator(admin, {from: owner});
        await truffleAssert.fails(
          ReferralContract.addRegistryAddress("0x0000000000000000000000000000000000000000", {
            from: admin
          }),
          truffleAssert.ErrorType.REVERT,
          "Address can not be 0x00"
        );
      });
      it("Expects not to add correct address to registry if caller is not admin", async () => {
        await truffleAssert.fails(
          ReferralContract.addRegistryAddress(user, {from: admin}),
          truffleAssert.ErrorType.REVERT,
          "the caller is not the admin"
        );
      });
    });
    describe("method removeRegistryAddress", () => {
      beforeEach(async () => {
        await generateReferral();
      });
      it("Expects to remove address from the registry if caller is admin and addres in registry", async () => {
        await ReferralContract.setAdministrator(admin, {from: owner});
        await ReferralContract.addRegistryAddress(admin, {from: admin});
        const registryaddr = await ReferralContract.isAddressInRegistry(admin, {from: admin});
        expect(registryaddr).to.equal(true);
        await ReferralContract.removeRegistryAddress(admin, {from: admin});
        const afterRegistryAddress = await ReferralContract.isAddressInRegistry(admin, {
          from: admin
        });
        expect(afterRegistryAddress).to.equal(false);
      });
      it("Expects not to remove address from the registry if caller is admin and addres is not in registry", async () => {
        await ReferralContract.setAdministrator(admin, {from: owner});
        await truffleAssert.fails(
          ReferralContract.removeRegistryAddress(user, {
            from: admin
          }),
          truffleAssert.ErrorType.REVERT,
          "Address not in registry"
        );
      });
      it("Expects not to remove address from the registry if caller is not admin", async () => {
        await truffleAssert.fails(
          ReferralContract.removeRegistryAddress(user, {from: admin}),
          truffleAssert.ErrorType.REVERT,
          "the caller is not the admin"
        );
      });
    });
    describe("method setReferralBonus", () => {
      beforeEach(async () => {
        await generateReferral();
      });
      it("Expects to set referral bonus if admin", async () => {
        await ReferralContract.setAdministrator(admin, {from: owner});
        const bonus = new BN("100000000000000000000");
        await ReferralContract.setReferralBonus(bonus, {from: admin});
        const refBonus = await ReferralContract.REFERRAL_BONUS();
        expect(Number(refBonus)).to.equal(Number(bonus));
      });
      it("Expects to not set referral bonus if not admin", async () => {
        const bonus = new BN("100000000000000000000");
        await truffleAssert.fails(
          ReferralContract.setReferralBonus(bonus, {from: admin}),
          truffleAssert.ErrorType.REVERT,
          "the caller is not the admin"
        );
      });
      it("Expects to not set bonus if bonus is 0", async () => {
        await ReferralContract.setAdministrator(admin, {from: owner});
        const bonus = new BN("0");
        await truffleAssert.fails(
          ReferralContract.setReferralBonus(bonus, {from: admin}),
          truffleAssert.ErrorType.REVERT,
          "Bonus needs to be greater than 0"
        );
      });
    });
    describe("method setToken", () => {
      beforeEach(async () => {
        await generateReferral();
      });
      it("Expects to set token if admin and paused", async () => {
        const newToken = await DAITokenContract.new({from: owner});
        await ReferralContract.setAdministrator(admin, {from: owner});
        await ReferralContract.addPauser(admin, {from: owner});
        await ReferralContract.pause({from: admin});
        const bonus = new BN("50000000000000000000");
        await ReferralContract.setToken(newToken.address, bonus, {from: admin});
        const savedToken = await ReferralContract.token();
        expect(savedToken).to.equal(newToken.address);
        const refBonus = await ReferralContract.REFERRAL_BONUS();
        expect(Number(refBonus)).to.equal(Number(bonus));
      });
      it("Expects to not set token if admin and not paused", async () => {
        const newToken = await DAITokenContract.new({from: owner});
        await ReferralContract.setAdministrator(admin, {from: owner});
        await ReferralContract.addPauser(admin, {from: owner});
        const bonus = new BN("50000000000000000000");
        await truffleAssert.fails(
          ReferralContract.setToken(newToken.address, bonus, {from: admin}),
          truffleAssert.ErrorType.REVERT,
          "Pausable: not paused"
        );
      });
      it("Expects to not set token if not admin but paused", async () => {
        const newToken = await DAITokenContract.new({from: owner});
        await ReferralContract.addPauser(admin, {from: owner});
        await ReferralContract.pause({from: admin});
        const bonus = new BN("50000000000000000000");
        await truffleAssert.fails(
          ReferralContract.setToken(newToken.address, bonus, {from: admin}),
          truffleAssert.ErrorType.REVERT,
          "the caller is not the admin"
        );
      });
      it("Expects to not set token if bonus is negative", async () => {
        const newToken = await DAITokenContract.new({from: owner});
        await ReferralContract.setAdministrator(admin, {from: owner});
        await ReferralContract.addPauser(admin, {from: owner});
        await ReferralContract.pause({from: admin});
        const bonus = new BN("0");
        await truffleAssert.fails(
          ReferralContract.setToken(newToken.address, bonus, {from: admin}),
          truffleAssert.ErrorType.REVERT,
          "Bonus needs to be greater than 0"
        );
      });
    });
    describe("method addFunds", () => {
      let amount;
      beforeEach(async () => {
        try {
          await generateReferral();
          amount = new BN("3000");
        } catch (error) {
          throw error;
        }
      });
      it("Expects to add funds if caller is admin", async () => {
        await ReferralContract.setAdministrator(admin, {from: owner});
        await DAIToken.transferAmountToAddress(admin, web3.utils.toWei("3000"), {
          from: owner
        });
        await DAIToken.approve(ReferralContract.address, amount, {from: admin});
        await ReferralContract.addFunds(amount, {from: admin});
        const funds = Number(await DAIToken.balanceOf(ReferralContract.address));
        expect(funds).to.equal(Number(amount));
      });
      it("Expects to fail if caller is not admin", async () => {
        await truffleAssert.fails(
          ReferralContract.addFunds(amount, {from: owner}),
          truffleAssert.ErrorType.REVERT,
          "the caller is not the admin"
        );
      });
      it("Expects to fail if contract is paused", async () => {
        await ReferralContract.setAdministrator(admin, {from: owner});
        await ReferralContract.addPauser(admin);
        await ReferralContract.pause({from: admin});
        await truffleAssert.fails(
          ReferralContract.addFunds(amount, {from: admin}),
          truffleAssert.ErrorType.REVERT,
          "Pausable: paused"
        );
      });
    });
    describe("method removeFunds", () => {
      before(async () => {
        try {
          await generateReferral();
          amount = new BN("3000");
        } catch (error) {
          throw error;
        }
      });
      it("Expects to remove funds if admin and funds > 0", async () => {
        await ReferralContract.setAdministrator(admin, {from: owner});
        await DAIToken.transferAmountToAddress(admin, web3.utils.toWei("3000"), {
          from: owner
        });
        const balanceAdminB = Number(await DAIToken.balanceOf(admin));
        await DAIToken.approve(ReferralContract.address, amount, {from: admin});
        await ReferralContract.addFunds(amount, {from: admin});

        const balanceB = Number(await DAIToken.balanceOf(ReferralContract.address));
        await ReferralContract.removeFunds(admin, {from: admin});
        const balanceA = Number(await DAIToken.balanceOf(ReferralContract.address));
        const balanceAdminA = Number(await DAIToken.balanceOf(admin));

        expect(balanceAdminB).to.equal(balanceAdminA);
        expect(balanceB).to.equal(Number(amount));
        expect(balanceA).to.equal(0);
      });
      it("Expects to remove funds if admin and funds > 0 and paused", async () => {
        await ReferralContract.setAdministrator(admin, {from: owner});
        await DAIToken.transferAmountToAddress(admin, web3.utils.toWei("3000"), {
          from: owner
        });
        const balanceAdminB = Number(await DAIToken.balanceOf(admin));
        await DAIToken.approve(ReferralContract.address, amount, {from: admin});
        await ReferralContract.addFunds(amount, {from: admin});

        const balanceB = Number(await DAIToken.balanceOf(ReferralContract.address));
        await ReferralContract.removeFunds(admin, {from: admin});
        const balanceA = Number(await DAIToken.balanceOf(ReferralContract.address));
        const balanceAdminA = Number(await DAIToken.balanceOf(admin));

        expect(balanceAdminB).to.equal(balanceAdminA);
        expect(balanceB).to.equal(Number(amount));
        expect(balanceA).to.equal(0);
      });
      it("Expects to not remove funds if not admin", async () => {
        await truffleAssert.fails(
          ReferralContract.removeFunds(admin, {from: owner}),
          truffleAssert.ErrorType.REVERT,
          "the caller is not the admin"
        );
      });
      it("Expects to not remove funds if admin and funds = 0", async () => {
        await ReferralContract.setAdministrator(admin, {from: owner});
        await truffleAssert.fails(
          ReferralContract.removeFunds(admin, {from: admin}),
          truffleAssert.ErrorType.REVERT,
          "ReferralTracker has no funds to withdraw"
        );
      });
    });
    describe("method getTrackerBalance", () => {
      beforeEach(async () => {
        try {
          await generateReferral();
          amount = new BN("3000");
        } catch (error) {
          throw error;
        }
      });
      it("Expects to get correct balance", async () => {
        await ReferralContract.setAdministrator(admin, {from: owner});
        await DAIToken.transferAmountToAddress(admin, web3.utils.toWei("3000"), {
          from: owner
        });
        await DAIToken.approve(ReferralContract.address, amount, {from: admin});
        await ReferralContract.addFunds(amount, {from: admin});
        const funds = Number(await DAIToken.balanceOf(ReferralContract.address));
        const balance = Number(await ReferralContract.getTrackerBalance());

        expect(funds).to.equal(Number(amount));
        expect(balance).to.equal(Number(amount));
      });
      it("Expects to get 0 balance", async () => {
        const balance = Number(await ReferralContract.getTrackerBalance());

        expect(balance).to.equal(0);
      });
    });
    describe("method registerReferral", () => {
      beforeEach(async () => {
        try {
          await generateReferral();
          amount = new BN("3000");
        } catch (error) {
          throw error;
        }
      });
      it("Expects to fail if caller is not registry", async () => {
        await truffleAssert.fails(
          ReferralContract.registerReferral(referrer, user, {from: user}),
          truffleAssert.ErrorType.REVERT,
          "the caller is not the registry"
        );
      });
      it("Expects the unclaimed amount to be correct if referred 2 other users with different bonus amounts", async () => {
        await ReferralContract.setAdministrator(admin, {from: owner});
        await ReferralContract.addRegistryAddress(admin, {from: admin});
        await ReferralContract.registerReferral(referrer, user, {from: admin});

        const newBonus = new BN("5000000000000000000");
        newToken = await DAITokenContract.new({from: owner});
        await ReferralContract.addPauser(admin);
        await ReferralContract.pause({from: admin});
        await ReferralContract.setToken(newToken.address, newBonus, {from: admin});
        await ReferralContract.unpause({from: admin});

        await ReferralContract.registerReferral(referrer, user2, {from: admin});
        const referralAmount = Number(await ReferralContract.getUnclaimedAmount(referrer));
        expect(referralAmount).to.equal(Number(Bonus) + Number(newBonus));
      });
      it("Expects to add referral bonus to the referrer unclaimed amount number", async () => {
        await ReferralContract.setAdministrator(admin, {from: owner});
        await ReferralContract.addRegistryAddress(admin, {from: admin});
        await ReferralContract.registerReferral(referrer, user, {from: admin});
        const referralAmount = Number(await ReferralContract.getUnclaimedAmount(referrer));
        expect(referralAmount).to.equal(Number(Bonus));
      });
      it("Expects to add 2* referral bonus to the referrer unclaimed amount number", async () => {
        await ReferralContract.setAdministrator(admin, {from: owner});
        await ReferralContract.addRegistryAddress(admin, {from: admin});
        await ReferralContract.registerReferral(referrer, user, {from: admin});
        await ReferralContract.registerReferral(referrer, user2, {from: admin});
        const referralAmount = Number(await ReferralContract.getUnclaimedAmount(referrer));
        expect(referralAmount).to.equal(Number(Bonus) * 2);
      });
      it("Expects to fail when referencing already referenced user", async () => {
        await ReferralContract.setAdministrator(admin, {from: owner});
        await ReferralContract.addRegistryAddress(admin, {from: admin});
        await ReferralContract.registerReferral(referrer, user, {from: admin});
        await truffleAssert.fails(
          ReferralContract.registerReferral(referrer, user, {from: admin}),
          truffleAssert.ErrorType.REVERT,
          "This user has been referenced before"
        );
      });
      it("Expects to fail when contract is paused", async () => {
        await ReferralContract.setAdministrator(admin, {from: owner});
        await ReferralContract.addRegistryAddress(admin, {from: admin});
        await ReferralContract.addPauser(admin);
        await ReferralContract.pause({from: admin});
        await truffleAssert.fails(
          ReferralContract.registerReferral(referrer, user, {from: admin}),
          truffleAssert.ErrorType.REVERT,
          "Pausable: paused"
        );
      });
    });
    describe.only("method withdraw", () => {
      beforeEach(async () => {
        try {
          await generateReferral();
          await ReferralContract.setAdministrator(admin, {from: owner});
          await ReferralContract.addRegistryAddress(admin, {from: admin});
          await DAIToken.mintTokens(admin, {from: owner});
          amount = new BN("3000000000000000000000");
        } catch (error) {
          throw error;
        }
      });
      it("Expects to withdraw the bonus correctly", async () => {
        await DAIToken.transferAmountToAddress(admin, amount, {
          from: owner
        });
        await DAIToken.approve(ReferralContract.address, amount, {from: admin});
        await ReferralContract.addFunds(amount, {from: admin});
        await KYCRegistry.addAddressToKYC(referrer, {from: admin});
        await ReferralContract.registerReferral(referrer, user, {from: admin});

        await ReferralContract.withdraw(referrer, {from: referrer});

        assert.equal(
          Number(await DAIToken.balanceOf(ReferralContract.address)),
          Number(amount) - Number(Bonus)
        );
        assert.equal(Number(await DAIToken.balanceOf(referrer)), Number(Bonus));
        assert.equal(Number(await ReferralContract.getUnclaimedAmount(referrer)), 0);
      });
      xit("Expects to fail if user has no referrals", async () => {
        await truffleAssert.fails(
          ReferralContract.withdraw(referrer, {from: referrer}),
          truffleAssert.ErrorType.REVERT,
          "no referrals to claim"
        );
      });
      xit("Expects to fail if contract does not have enough funds", async () => {
        await HeroToken.transferFakeHeroTokens(user);
        await HeroToken.transferFakeHeroTokens(referrer);
        await HeroToken.approve(DepositRegistry.address, HeroAmount, {from: user});
        await HeroToken.approve(DepositRegistry.address, HeroAmount, {from: referrer});
        await DepositRegistry.depositFor(referrer, {from: referrer});

        await DepositRegistry.depositForWithReferral(user, referrer, {from: user});

        await truffleAssert.fails(
          ReferralContract.withdraw(referrer, {from: referrer}),
          truffleAssert.ErrorType.REVERT,
          "Not enough funds"
        );
      });
      xit("Expects to fail if contract is paused", async () => {
        await ReferralContract.pause({from: admin});
        await truffleAssert.fails(
          ReferralContract.withdraw(referrer, {from: referrer}),
          truffleAssert.ErrorType.REVERT,
          "Pausable: paused"
        );
      });
      xit("Expects to fail if paused and succeed when unpaused and tried again", async () => {
        await HeroToken.transferFakeHeroTokens(admin);
        await HeroToken.approve(ReferralContract.address, HeroAmount, {from: admin});
        await ReferralContract.addFunds(HeroAmount, {from: admin});

        const balance = Number(await HeroToken.balanceOf(ReferralContract.address));
        expect(balance).to.equal(Number(HeroAmount));

        await HeroToken.transferFakeHeroTokens(user);
        await HeroToken.transferFakeHeroTokens(referrer2);
        await HeroToken.approve(DepositRegistry.address, HeroAmount, {from: user});
        await HeroToken.approve(DepositRegistry.address, HeroAmount, {from: referrer2});
        await DepositRegistry.depositFor(referrer2, {from: referrer2});
        await DepositRegistry.depositForWithReferral(user, referrer2, {from: user});
        const referrerBalanceAfterDeposit = Number(await HeroToken.balanceOf(referrer2));

        await ReferralContract.pause({from: admin});
        await truffleAssert.fails(
          ReferralContract.withdraw(referrer2, {from: referrer2}),
          truffleAssert.ErrorType.REVERT,
          "Pausable: paused"
        );
        await ReferralContract.unpause({from: admin});
        await ReferralContract.withdraw(referrer2, {from: referrer2});

        const contractBalance = Number(await HeroToken.balanceOf(ReferralContract.address));
        const referrerBalance = Number(await HeroToken.balanceOf(referrer2));
        const unclaimedReferrals = Number(await ReferralContract.unclaimedReferrals(referrer2));
        expect(referrerBalanceAfterDeposit).to.equal(0);
        expect(contractBalance).to.equal(Number(HeroAmount) / 2);
        expect(referrerBalance).to.equal(Number(HeroAmount) / 2);
        expect(unclaimedReferrals).to.equal(0);
      });
    });
    describe("method getUnclaimedAmount", () => {
      it("Expects to get correct unclaimed amount", async () => {
        // TODO: add address referral registry
      });
      it("Expects to get correct unclaimed amount if address not in referral registry", async () => {});
    });
  });
});
