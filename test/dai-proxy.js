const chai = require("chai");
const bnChai = require("bn-chai");
const chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
const web3 = global.web3;
const {BN} = web3.utils;
chai.use(chaiAsPromised);
chai.use(bnChai(BN));
const {expect} = chai;
const DAIProxyContract = artifacts.require("DAIProxy");
const AuthContract = artifacts.require("Authorization");
const DepositRegistryContract = artifacts.require("DepositRegistry");
const RaiseContract = artifacts.require("RaiseFake");
const DAIContract = artifacts.require("DAIFake");
const MockERC20 = artifacts.require("MockERC20");
const KYCContract = artifacts.require("KYCRegistry");
const MockLoanContract = artifacts.require("LoanContractMock");
const ERC20WrapperContract = artifacts.require("ERC20Wrapper");
const truffleAssert = require("truffle-assertions");
const {initializeUniswap} = require("./uniswap.utils");
const UniswapSwapperFactoryContract = artifacts.require("UniswapSwapperFactory");
const UniswapSwapper = artifacts.require("UniswapSwapper");

const HeroAmount = "200000000000000000000";

contract("DAIProxy Contract", function(accounts) {
  let DAIProxy;
  let Auth;
  let RaiseToken;
  let DepositRegistry;
  let KYCRegistry;
  let DAIToken;
  let USDCToken;
  let LoanContract;
  let uniswapAddress;
  let UniswapSwapperFactory;

  const owner = accounts[0];
  const user = accounts[1];
  const admin = accounts[2];
  const other_kyc_user_no_deposit = accounts[3];
  const other_user = accounts[4];
  const other_user_kyc_no_dai = accounts[5];
  const otherAdmin = accounts[6];

  const migrate = async () => {
    try {
      RaiseToken = await RaiseContract.new({from: owner});
      DAIToken = await DAIContract.new({from: owner});
      await DAIToken.mintTokens(user, {from: owner});
      await DAIToken.mintTokens(other_kyc_user_no_deposit, {from: owner});
      await DAIToken.mintTokens(other_user, {from: owner});
      LoanContract = await MockLoanContract.new(DAIToken.address, {from: owner});
      KYCRegistry = await KYCContract.new();
      await KYCRegistry.setAdministrator(admin);
      DepositRegistry = await DepositRegistryContract.new(RaiseToken.address, KYCRegistry.address, {
        from: owner
      });
      Auth = await AuthContract.new(KYCRegistry.address, DepositRegistry.address);
      ERC20Wrapper = await ERC20WrapperContract.new();
      await DAIProxyContract.link("ERC20Wrapper", ERC20Wrapper.address);

      uniswapAddress = await initializeUniswap(web3, DAIToken.address, RaiseToken.address, owner);
      UniswapSwapperTemplate = await UniswapSwapper.new({from: owner});
      UniswapSwapperFactory = await UniswapSwapperFactoryContract.new(
        UniswapSwapperTemplate.address,
        uniswapAddress,
        {
          from: owner
        }
      );

      DAIProxy = await DAIProxyContract.new(Auth.address, UniswapSwapperFactory.address);
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

  const migrateFund = async () => {
    try {
      RaiseToken = await RaiseContract.new({from: owner});

      DAIToken = await DAIContract.new({from: owner});
      await DAIToken.mintTokens(user, {from: owner});

      USDCToken = await MockERC20.new("USDCToken", "USDC", {from: owner});
      await USDCToken.mintTokens(user, {from: owner});

      LoanContract = await MockLoanContract.new(USDCToken.address, {from: owner});
      KYCRegistry = await KYCContract.new();
      await KYCRegistry.setAdministrator(admin);
      DepositRegistry = await DepositRegistryContract.new(RaiseToken.address, KYCRegistry.address, {
        from: owner
      });
      Auth = await AuthContract.new(KYCRegistry.address, DepositRegistry.address);
      ERC20Wrapper = await ERC20WrapperContract.new();
      await DAIProxyContract.link("ERC20Wrapper", ERC20Wrapper.address);

      uniswapAddress = await initializeUniswap(web3, DAIToken.address, USDCToken.address, owner);
      UniswapSwapperTemplate = await UniswapSwapper.new({from: owner});
      UniswapSwapperFactory = await UniswapSwapperFactoryContract.new(
        UniswapSwapperTemplate.address,
        uniswapAddress,
        {
          from: owner
        }
      );

      DAIProxy = await DAIProxyContract.new(Auth.address, UniswapSwapperFactory.address);

      await DAIProxy.setAdministrator(admin, {from: owner});

      // user one
      await RaiseToken.mintTokens(user, {from: owner});
      await RaiseToken.approve(DepositRegistry.address, HeroAmount, {from: user});
      await DepositRegistry.depositFor(user, {from: user});
      await KYCRegistry.addAddressToKYC(user, {from: admin});
    } catch (error) {
      throw error;
    }
  };

  describe("DAIProxy contract", () => {
    /**
     * user represents a lender in these tests
     */
    describe("Setters", () => {
      beforeEach(migrate);
      describe("Test setDepositRequirement", () => {
        it("Expects to set the deposit requirement if admin", async () => {
          await DAIProxy.setDepositRequeriment(true, {from: admin});
          const hasToDeposit = await DAIProxy.hasToDeposit();
          expect(hasToDeposit).to.equal(true);
          await DAIProxy.setDepositRequeriment(false, {from: admin});
          const hasToDeposit2 = await DAIProxy.hasToDeposit();
          expect(hasToDeposit2).to.equal(false);
        });
        it("Expects to not set the deposit requirement if not admin", async () => {
          await truffleAssert.fails(
            DAIProxy.setDepositRequeriment(true, {from: otherAdmin}),
            truffleAssert.ErrorType.REVERT,
            "Caller is not an administrator"
          );
        });
      });
      describe("Test setUniswapSwapper", () => {
        it("Expects to set the uniswap swapper address if admin", async () => {
          const newSuappAddress = await initializeUniswap(
            web3,
            DAIToken.address,
            RaiseToken.address,
            owner
          );
          await DAIProxy.setUniswapSwapper(newSuappAddress, {from: admin});
          const sa = await DAIProxy.swapperFactoryAddress();
          expect(sa).to.equal(newSuappAddress);
        });
        it("Expects to not set the uniswap swapper if not addmin", async () => {
          const newSuappAddress = await initializeUniswap(
            web3,
            DAIToken.address,
            RaiseToken.address,
            owner
          );
          await truffleAssert.fails(
            DAIProxy.setUniswapSwapper(newSuappAddress, {from: otherAdmin}),
            truffleAssert.ErrorType.REVERT,
            "Caller is not an administrator"
          );
        });
      });
      describe("Test toggleUniswap", () => {
        it("Expects to toggle uniswap if admin", async () => {
          await DAIProxy.toggleUniswap(true, {from: admin});
          const swap1 = await DAIProxy.swapEnabled();
          await DAIProxy.toggleUniswap(false, {from: admin});
          const swap2 = await DAIProxy.swapEnabled();
          expect(swap1).to.equal(true);
          expect(swap2).to.equal(false);
        });
        it("Expects to not toggle uniswap if not addmin", async () => {
          await truffleAssert.fails(
            DAIProxy.toggleUniswap(true, {from: otherAdmin}),
            truffleAssert.ErrorType.REVERT,
            "Caller is not an administrator"
          );
        });
      });
      describe("Test setAdministrator", () => {
        it("Expects to set the administrator address if owner", async () => {
          await DAIProxy.setAdministrator(otherAdmin, {from: owner});
          const adm = await DAIProxy.administrator();
          expect(adm).to.equal(otherAdmin);
        });
        it("Expects to not set the administrator if not owner", async () => {
          await truffleAssert.fails(
            DAIProxy.setAdministrator(otherAdmin, {from: otherAdmin}),
            truffleAssert.ErrorType.REVERT,
            "caller is not the owner"
          );
        });
      });
      describe("Test setAuthAddress", () => {
        it("Expects to set the auth address if admin", async () => {
          const newAuthAddres = await AuthContract.new(
            KYCRegistry.address,
            DepositRegistry.address
          );
          await DAIProxy.setAuthAddress(newAuthAddres.address, {from: admin});
        });
        it("Expects to not set the auth address if not addmin", async () => {
          const newAuthAddres = await AuthContract.new(
            KYCRegistry.address,
            DepositRegistry.address
          );
          await truffleAssert.fails(
            DAIProxy.setAuthAddress(newAuthAddres.address, {from: otherAdmin}),
            truffleAssert.ErrorType.REVERT,
            "Caller is not an administrator"
          );
        });
      });
    });
    describe("swapTokenAndFund", () => {
      beforeEach(migrateFund);
      it.only("Expects to fund loan swapping the token", async () => {
        const userBalanceBefore = await DAIToken.balanceOf(user);

        const INPUT_AMOUNT = new BN(web3.utils.toWei("300")); // 300 DAI
        const OUTPUT_AMOUNT = new BN(web3.utils.toWei("200")); // 200 Raise
        console.log("balance:===============>  ", Number(userBalanceBefore));
        await DAIToken.approve(DAIProxy.address, INPUT_AMOUNT, {from: user});
        await DAIProxy.swapTokenAndFund(
          LoanContract.address,
          DAIToken.address,
          INPUT_AMOUNT,
          OUTPUT_AMOUNT,
          {
            from: user
          }
        );

        const userBalanceAfter = await DAIToken.balanceOf(user);
        const loanBalance = await LoanContract.getFundedAmount();

        expect(Number(loanBalance).to.equal(100));
        return expect(Number(userBalanceAfter)).to.equal(Number(userBalanceBefore) - 100);
      });
    });
    describe("swapEthAndFund", () => {});

    describe("Should allow loan funding", () => {
      beforeEach(migrate);
      it("Expects the amount of dai tokens to be reduced in the amount funded", async () => {
        const userBalanceBefore = await DAIToken.balanceOf(user);
        await DAIToken.approve(DAIProxy.address, 100, {from: user});
        await DAIProxy.fund(LoanContract.address, 100, {from: user});

        const userBalanceAfter = await DAIToken.balanceOf(user);
        return expect(Number(userBalanceAfter)).to.equal(Number(userBalanceBefore) - 100);
      });
      it("Expects an error when there are not enough dai funds", async () => {
        await DAIToken.approve(DAIProxy.address, 100, {from: other_user_kyc_no_dai});
        await truffleAssert.fails(
          DAIProxy.fund(LoanContract.address, 100, {from: other_user_kyc_no_dai}),
          truffleAssert.ErrorType.REVERT,
          "Not enough funds."
        );
      });
      it("Expects an error when user not KYC", async () => {
        await DAIToken.approve(DAIProxy.address, 100, {from: other_user});
        await truffleAssert.fails(
          DAIProxy.fund(LoanContract.address, 100, {from: other_user}),
          truffleAssert.ErrorType.REVERT,
          "user does not have KYC."
        );
      });
      it("Expects to fund SUCCESSFULLY when user has not hero tokens deposited and deposit requeriment is off", async () => {
        await DAIToken.approve(DAIProxy.address, 100, {from: user});
        await DAIProxy.fund(LoanContract.address, 100, {from: user});
      });
      it("Expects to fund SUCCESSFULLY when user has hero tokens deposited and deposit requeriment is off", async () => {
        await DAIToken.approve(DAIProxy.address, 100, {from: user});
        await DAIProxy.fund(LoanContract.address, 100, {from: user});
      });
      it("Expects to FAIL fund when deposit is REQUIRED and user has no hero tokens deposited", async () => {
        await DAIProxy.setDepositRequeriment(true, {from: admin});
        await DAIToken.approve(DAIProxy.address, 100, {from: other_kyc_user_no_deposit});
        await truffleAssert.fails(
          DAIProxy.fund(LoanContract.address, 100, {from: other_kyc_user_no_deposit}),
          truffleAssert.ErrorType.REVERT,
          "user does not have a deposit"
        );
      });
      it("Expects to SUCCESS fund when deposit is REQUIRED and user HAS hero tokens deposited", async () => {
        await DAIProxy.setDepositRequeriment(true, {from: admin});
        await DAIToken.approve(DAIProxy.address, 100, {from: user});
        await DAIProxy.fund(LoanContract.address, 100, {from: user});
      });
    });
    /**
     * user represents the loan borrower in these tests
     */
    describe("Should allow loan repayments", () => {
      beforeEach(migrate);
      it("Expects the amount of dai tokens to be reduced in the amount repaid", async () => {
        const userBalanceBefore = await DAIToken.balanceOf(user);
        await DAIToken.approve(DAIProxy.address, 100, {from: user});
        await DAIProxy.repay(LoanContract.address, 100, {from: user});

        const userBalanceAfter = await DAIToken.balanceOf(user);
        expect(Number(userBalanceAfter)).to.equal(Number(userBalanceBefore) - 100);
      });
      it("Expects an error when there are not enough dai funds", async () => {
        await DAIToken.approve(DAIProxy.address, 100, {from: other_user_kyc_no_dai});
        await truffleAssert.fails(
          DAIProxy.repay(LoanContract.address, 100, {from: other_user_kyc_no_dai}),
          truffleAssert.ErrorType.REVERT,
          "Not enough funds"
        );
      });
      it("Expects an error when user not KYC", async () => {
        await DAIToken.approve(DAIProxy.address, 100, {from: other_user});
        await truffleAssert.fails(
          DAIProxy.repay(LoanContract.address, 100, {from: other_user}),
          truffleAssert.ErrorType.REVERT,
          "user does not have KYC."
        );
      });
    });
  });
});
