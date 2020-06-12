const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
const {expect} = chai;
const DAIProxyContract = artifacts.require("DAIProxy");
const AuthContract = artifacts.require("Authorization");
const DepositRegistryContract = artifacts.require("DepositRegistry");
const RaiseTokenContract = artifacts.require("RaiseFake");
const USDTTokenContract = artifacts.require("USDT");
const KYCContract = artifacts.require("KYCRegistry");
const MockLoanContract = artifacts.require("LoanContractMock");
const ERC20WrapperContract = artifacts.require("ERC20Wrapper");
const truffleAssert = require("truffle-assertions");

const HeroAmount = "200000000000000000000";

contract("DAIProxy Contract USDT tests", function(accounts) {
  let DAIProxy;
  let Auth;
  let RaiseToken;
  let DepositRegistry;
  let KYCRegistry;
  let USDTToken;
  let LoanContract;
  let uniswapAddress;

  const owner = accounts[0];
  const user = accounts[1];
  const admin = accounts[2];
  const other_kyc_user_no_deposit = accounts[3];
  const other_user = accounts[4];
  const other_user_kyc_no_dai = accounts[5];

  before(async () => {
    ERC20Wrapper = await ERC20WrapperContract.new();
    await DAIProxyContract.link(ERC20Wrapper);
  });

  const migrate = async () => {
    try {
      RaiseToken = await RaiseTokenContract.new({from: owner});
      USDTToken = await USDTTokenContract.new({from: owner});
      await USDTToken.mintTokens(user, {from: owner});
      await USDTToken.mintTokens(other_kyc_user_no_deposit, {from: owner});
      await USDTToken.mintTokens(other_user, {from: owner});
      LoanContract = await MockLoanContract.new(USDTToken.address, {from: owner});
      KYCRegistry = await KYCContract.new();
      await KYCRegistry.setAdministrator(admin);
      DepositRegistry = await DepositRegistryContract.new(RaiseToken.address, KYCRegistry.address, {
        from: owner
      });
      Auth = await AuthContract.new(KYCRegistry.address, DepositRegistry.address);
      uniswapAddress = "0x0000000000000000000000000000000000000000";

      DAIProxy = await DAIProxyContract.new(Auth.address, uniswapAddress);
      await DAIProxy.setAdministrator(admin, {from: owner});

      // user one
      await RaiseToken.mintTokens(user, {from: owner});
      await RaiseToken.approve(DepositRegistry.address, HeroAmount, {from: user});
      await DepositRegistry.depositFor(user, {from: user});
      await KYCRegistry.addAddressToKYC(user, {from: admin});

      // user kyc no deposit
      await KYCRegistry.addAddressToKYC(other_kyc_user_no_deposit, {from: admin});

      // other_user_kyc_no_dai
      await KYCRegistry.addAddressToKYC(other_user_kyc_no_dai, {from: admin});
    } catch (error) {
      throw error;
    }
  };

  describe("DAIProxy contract", () => {
    /**
     * user represents a lender in these tests
     */
    describe("Should allow loan funding", () => {
      beforeEach(migrate);
      it("Expects the amount of dai tokens to be reduced in the amount funded", async () => {
        const userBalanceBefore = await USDTToken.balanceOf(user);
        await USDTToken.approve(DAIProxy.address, 100, {from: user});
        await DAIProxy.fund(LoanContract.address, 100, {from: user});

        const userBalanceAfter = await USDTToken.balanceOf(user);
        return expect(Number(userBalanceAfter)).to.equal(Number(userBalanceBefore) - 100);
      });
      it("Expects an error when there are not enough dai funds", async () => {
        await USDTToken.approve(DAIProxy.address, 100, {from: other_user_kyc_no_dai});
        await truffleAssert.fails(
          DAIProxy.fund(LoanContract.address, 100, {from: other_user_kyc_no_dai}),
          truffleAssert.ErrorType.REVERT,
          "Not enough funds"
        );
      });
      it("Expects an error when user not KYC", async () => {
        await USDTToken.approve(DAIProxy.address, 100, {from: other_user});
        await truffleAssert.fails(
          DAIProxy.fund(LoanContract.address, 100, {from: other_user}),
          truffleAssert.ErrorType.REVERT,
          "user does not have KYC"
        );
      });
      it("Expects to fund SUCCESSFULLY when user has not hero tokens deposited and deposit requeriment is off", async () => {
        await USDTToken.approve(DAIProxy.address, 100, {from: user});
        await DAIProxy.fund(LoanContract.address, 100, {from: user});
      });
      it("Expects to fund SUCCESSFULLY when user has hero tokens deposited and deposit requeriment is off", async () => {
        await USDTToken.approve(DAIProxy.address, 100, {from: user});
        await DAIProxy.fund(LoanContract.address, 100, {from: user});
      });
      it("Expects to FAIL fund when deposit is REQUIRED and user has no hero tokens deposited", async () => {
        await DAIProxy.setDepositRequeriment(true, {from: admin});
        await USDTToken.approve(DAIProxy.address, 100, {from: other_kyc_user_no_deposit});
        await truffleAssert.fails(
          DAIProxy.fund(LoanContract.address, 100, {from: other_kyc_user_no_deposit}),
          truffleAssert.ErrorType.REVERT,
          "user does not have a deposit"
        );
      });
      it("Expects to SUCCESS fund when deposit is REQUIRED and user HAS hero tokens deposited", async () => {
        await DAIProxy.setDepositRequeriment(true, {from: admin});
        await USDTToken.approve(DAIProxy.address, 100, {from: user});
        await DAIProxy.fund(LoanContract.address, 100, {from: user});
      });
    });
    /**
     * user represents the loan borrower in these tests
     */
    describe("Should allow loan repayments", () => {
      beforeEach(migrate);
      it("Expects the amount of dai tokens to be reduced in the amount repaid", async () => {
        const userBalanceBefore = await USDTToken.balanceOf(user);
        await USDTToken.approve(DAIProxy.address, 100, {from: user});
        await DAIProxy.repay(LoanContract.address, 100, {from: user});

        const userBalanceAfter = await USDTToken.balanceOf(user);
        expect(Number(userBalanceAfter)).to.equal(Number(userBalanceBefore) - 100);
      });
      it("Expects an error when there are not enough dai funds", async () => {
        await USDTToken.approve(DAIProxy.address, 100, {from: other_user_kyc_no_dai});
        await truffleAssert.fails(
          DAIProxy.repay(LoanContract.address, 100, {from: other_user_kyc_no_dai}),
          truffleAssert.ErrorType.REVERT,
          "Not enough funds"
        );
      });
      it("Expects an error when user not KYC", async () => {
        await USDTToken.approve(DAIProxy.address, 100, {from: other_user});
        await truffleAssert.fails(
          DAIProxy.repay(LoanContract.address, 100, {from: other_user}),
          truffleAssert.ErrorType.REVERT,
          "user does not have KYC"
        );
      });
    });
  });
});
