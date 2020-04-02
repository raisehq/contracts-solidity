const chai = require("chai");
const web3 = global.web3;
const chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
const {expect} = chai;
const {BN} = web3.utils;
const truffleAssert = require("truffle-assertions");
const KYCContract = artifacts.require("KYCRegistry");
const AuthContract = artifacts.require("Authorization");
const DepositRegistryContract = artifacts.require("DepositRegistry");
const helpers = require("./helpers.js");
const ERC20Mock = artifacts.require("MockERC20");

contract("Authorization", accounts => {
  let DepositRegistry;
  let KYCRegistry;
  let Auth;
  let RaiseToken;

  let owner = accounts[0];
  let user1 = accounts[1];
  let user2 = accounts[2];
  let admin = accounts[3];

  describe("Auth unit tests", () => {
    beforeEach(async () => {
      // add usr to kyc
      RaiseToken = await ERC20Mock.new("RAISE", "RAISE", {from: owner});
      await RaiseToken.mintTokens(user1, {from: owner});

      const amount = new BN(web3.utils.toWei("100000")); // 300 DAI

      KYCRegistry = await KYCContract.new({from: owner});
      await KYCRegistry.setAdministrator(admin, {from: owner});
      // init contracts
      DepositRegistry = await DepositRegistryContract.new(RaiseToken.address, KYCRegistry.address, {
        from: owner
      });
      await RaiseToken.approve(DepositRegistry.address, amount, {from: user1});
      await DepositRegistry.setAdministrator(admin, {from: owner});

      Auth = await AuthContract.new(KYCRegistry.address, DepositRegistry.address, {from: owner});
    });
    describe("Setters test", () => {
      describe("setKYCRegistry", () => {
        let KYCRegistry2;

        beforeEach(async () => {
          KYCRegistry2 = await KYCContract.new({from: owner});
        });
        it("Expects to set KYCRegistry if owner", async () => {
          await Auth.setKYCRegistry(KYCRegistry2.address, {from: owner});
          const kyc2Address = await Auth.getKycAddress();
          expect(kyc2Address).to.equal(KYCRegistry2.address);
        });
        it("Expects to not set KYCRegistry if not owner", async () => {
          await truffleAssert.fails(
            Auth.setKYCRegistry(KYCRegistry2.address, {from: user1}),
            truffleAssert.ErrorType.REVERT,
            "caller is not the owner."
          );
        });
      });
      describe("setDepositRegistry", () => {
        let DR2;
        beforeEach(async () => {
          DR2 = await DepositRegistryContract.new(RaiseToken.address, KYCRegistry.address, {
            from: owner
          });
        });
        it("Expects to set DepositRegistry if owner", async () => {
          await Auth.setDepositRegistry(DR2.address, {from: owner});
          const dr2Address = await Auth.getDepositAddress();
          expect(dr2Address).to.equal(DR2.address);
        });
        it("Expects to not set DepositRegistry if not owner", async () => {
          await truffleAssert.fails(
            Auth.setDepositRegistry(DR2.address, {from: user1}),
            truffleAssert.ErrorType.REVERT,
            "caller is not the owner."
          );
        });
      });
    });
    describe("getters", () => {
      it("Expects kyc address", async () => {
        const kycAddress = await Auth.getKycAddress();
        expect(kycAddress).to.equal(KYCRegistry.address);
      });
      it("Expects deposit address", async () => {
        const dr2Address = await Auth.getDepositAddress();
        expect(dr2Address).to.equal(DepositRegistry.address);
      });
    });
    describe("hasDeposited", () => {
      it("Expects to return true if user deposited", async () => {
        await DepositRegistry.depositFor(user1);
        const hasdepo = await Auth.hasDeposited(user1);
        expect(hasdepo).to.equal(true);
      });
      it("Expects to return false if user has not deposited", async () => {
        const hasdepo = await Auth.hasDeposited(user2);
        expect(hasdepo).to.equal(false);
      });
    });
    describe("isKYCConfirmed", () => {
      it("Expects to return true if user kyced", async () => {
        await KYCRegistry.addAddressToKYC(user1, {from: admin});
        const kyced = await Auth.isKYCConfirmed(user1);
        expect(kyced).to.equal(true);
      });
      it("Expects to return false if user not kyced", async () => {
        const kyced = await Auth.isKYCConfirmed(user2);
        expect(kyced).to.be.false;
      });
    });
  });
});
