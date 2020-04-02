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
const RealLoanContract = artifacts.require("LoanContract");
const ERC20WrapperContract = artifacts.require("ERC20Wrapper");
const truffleAssert = require("truffle-assertions");
const {initializeUniswap} = require("./uniswap.utils");
const UniswapSwapperFactoryContract = artifacts.require("UniswapSwapperFactory");
const UniswapSwapper = artifacts.require("UniswapSwapper");
const LoanContractDispatcherContract = artifacts.require("LoanContractDispatcher");
const UniswapExchangeAbi = artifacts.require("IUniswapExchange").abi;
const UniswapFactoryAbi = artifacts.require("IUniswapFactory").abi;
const {getWeb3} = require("../scripts/helpers.js");

const HeroAmount = "200000000000000000000";

contract("DAIProxy Contract", function(accounts) {
  let DAIProxy;
  let Auth;
  let RaiseToken;
  let DepositRegistry;
  let KYCRegistry;
  let DAIToken;
  let USDCToken;
  let USDTToken;
  let LoanContract;
  let uniswapAddress;
  let UniswapSwapperFactory;
  let LC;
  let ERC20Wrapper;

  const owner = accounts[0];
  const user = accounts[1];
  const admin = accounts[2];
  const other_kyc_user_no_deposit = accounts[3];
  const other_user = accounts[4];
  const other_user_kyc_no_dai = accounts[5];
  const otherAdmin = accounts[6];
  const borrower = accounts[7];

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
      // link
      ERC20Wrapper = await ERC20WrapperContract.new();
      await DAIProxyContract.link("ERC20Wrapper", ERC20Wrapper.address);
      await RealLoanContract.link("ERC20Wrapper", ERC20Wrapper.address);
      await LoanContractDispatcherContract.link("ERC20Wrapper", ERC20Wrapper.address);

      RaiseToken = await RaiseContract.new({from: owner});

      // Mint
      DAIToken = await DAIContract.new({from: owner});
      USDCToken = await MockERC20.new("USDCToken", "USDC", {from: owner});
      USDTToken = await MockERC20.new("USDTToken", "USDT", {from: owner});
      await DAIToken.mintTokens(user, {from: owner});
      await USDCToken.mintTokens(user, {from: owner});
      await USDTToken.mintTokens(user, {from: owner});

      // add usr to kyc
      KYCRegistry = await KYCContract.new();
      await KYCRegistry.setAdministrator(admin);
      await KYCRegistry.addAddressToKYC(user, {from: admin});

      // init contracts
      DepositRegistry = await DepositRegistryContract.new(RaiseToken.address, KYCRegistry.address, {
        from: owner
      });
      Auth = await AuthContract.new(KYCRegistry.address, DepositRegistry.address);

      // init uniswap
      uniswapAddress = await initializeUniswap(web3, DAIToken.address, USDCToken.address, owner);
      UniswapSwapperTemplate = await UniswapSwapper.new({from: owner});
      UniswapSwapperFactory = await UniswapSwapperFactoryContract.new(
        UniswapSwapperTemplate.address,
        uniswapAddress,
        {
          from: owner
        }
      );

      // init daiproxy
      DAIProxy = await DAIProxyContract.new(Auth.address, UniswapSwapperFactory.address);
      await DAIProxy.setAdministrator(admin, {from: owner});

      // initialize loan contract dispatcher
      LoanDispatcher = await LoanContractDispatcherContract.new(
        Auth.address,
        DAIProxy.address,
        UniswapSwapperFactory.address, // SwapAndDepositFactory
        {
          from: owner
        }
      );
      await LoanDispatcher.setAdministrator(admin, {from: owner});
      await LoanDispatcher.setMinTermLength(0, {from: admin});
      await LoanDispatcher.setMinAuctionLength(0, {from: admin});
      await LoanDispatcher.addTokenToAcceptedList(USDCToken.address, {from: admin});

      // borrower creates loan
      const loanRepaymentTime = 2 * 60 * 60; // 2 hours in seconds
      loanMinAmount = web3.utils.toWei(new BN(90, 10));
      loanMaxAmount = web3.utils.toWei(new BN(100, 10));
      const minInterestRate = 0;
      const maxInterestRate = 5000;
      auctionLength = 60 * 60;

      await LoanDispatcher.deploy(
        loanMinAmount,
        loanMaxAmount,
        minInterestRate,
        maxInterestRate,
        loanRepaymentTime,
        auctionLength,
        USDCToken.address,
        {from: user}
      );
      const loanEventHistory = await LoanDispatcher.getPastEvents("LoanContractCreated"); // {fromBlock: 0, toBlock: "latest"} put this to get all
      const loanAddress = loanEventHistory[0].returnValues.contractAddress;

      // create loan instance from Loan.address
      LC = await RealLoanContract.at(loanAddress);
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
      it("Expects to fund loan swapping the token", async () => {
        const userBalanceBefore = await DAIToken.balanceOf(user);

        const INPUT_AMOUNT = new BN(web3.utils.toWei("10")); // 300 DAI
        const OUTPUT_AMOUNT = new BN(web3.utils.toWei("1")); // 200 USDC
        await DAIToken.approve(DAIProxy.address, INPUT_AMOUNT, {from: user});
        await DAIProxy.swapTokenAndFund(LC.address, DAIToken.address, INPUT_AMOUNT, OUTPUT_AMOUNT, {
          from: user
        });

        const userBalanceAfter = await DAIToken.balanceOf(user);
        const loanBalance = await LC.auctionBalance();
        expect(OUTPUT_AMOUNT.eq(loanBalance));
        expect(userBalanceAfter.eq(userBalanceBefore - INPUT_AMOUNT));
      });
      it("Expects to fail funding, and continue to have same balance", async () => {
        const userBalanceBefore = await DAIToken.balanceOf(user);

        const INPUT_AMOUNT = new BN(web3.utils.toWei("200")); // 300 DAI
        const OUTPUT_AMOUNT = new BN(web3.utils.toWei("100")); // 200 USDC
        await DAIToken.approve(DAIProxy.address, INPUT_AMOUNT, {from: user});
        await DAIProxy.swapTokenAndFund(LC.address, DAIToken.address, INPUT_AMOUNT, OUTPUT_AMOUNT, {
          from: user
        });
        const userBalanceAfter = await DAIToken.balanceOf(user);
        const loanBalance = await LC.auctionBalance();
        expect(OUTPUT_AMOUNT.eq(loanBalance));
        expect(userBalanceAfter.eq(userBalanceBefore - INPUT_AMOUNT));

        await truffleAssert.fails(
          DAIProxy.swapTokenAndFund(LC.address, DAIToken.address, INPUT_AMOUNT, OUTPUT_AMOUNT, {
            from: user
          }),
          truffleAssert.ErrorType.REVERT,
          "Loan status is not CREATED"
        );

        const userBalanceAfter2 = await DAIToken.balanceOf(user);
        expect(userBalanceAfter.eq(userBalanceAfter2));
      });
      it("Expects to fail funding when swap fails", async () => {
        const INPUT_AMOUNT = new BN(web3.utils.toWei("200")); // 300 DAI
        const OUTPUT_AMOUNT = new BN(web3.utils.toWei("100")); // 200 USDC
        await USDTToken.approve(DAIProxy.address, INPUT_AMOUNT, {from: user});

        await truffleAssert.fails(
          DAIProxy.swapTokenAndFund(LC.address, USDTToken.address, INPUT_AMOUNT, OUTPUT_AMOUNT, {
            from: user
          }),
          truffleAssert.ErrorType.REVERT,
          "exchange can not be 0 address."
        );
      });
    });
    describe("swapEthAndFund", () => {
      beforeEach(migrateFund);
      it("Expects to fund loan swapping eth", async () => {
        const web3One = getWeb3(web3);
        const userEtherBalance = new BN(await web3One.eth.getBalance(user));

        const OUTPUT_AMOUNT = new BN(web3One.utils.toWei("100")); // 200 USDC

        const exchangeAddress = await new web3One.eth.Contract(
          UniswapFactoryAbi,
          uniswapAddress
        ).methods
          .getExchange(USDCToken.address)
          .call();

        const exchange = new web3One.eth.Contract(UniswapExchangeAbi, exchangeAddress);

        const ethCosts = new BN(
          await exchange.methods.getEthToTokenOutputPrice(OUTPUT_AMOUNT).call()
        );

        const swapTx = await DAIProxy.swapEthAndFund(LC.address, OUTPUT_AMOUNT, {
          from: user,
          value: ethCosts
        });

        // Retrieve gasUsed, real eth spent, and gas price to know the total of ETH spent
        const {
          receipt: {gasUsed}
        } = swapTx;

        const gasPrice = (await web3One.eth.getTransaction(swapTx.tx)).gasPrice;

        const afterEtherBalance = new BN(await web3One.eth.getBalance(user));
        const loanBalance = await LC.auctionBalance();

        expect(OUTPUT_AMOUNT.eq(loanBalance));
        // User ETH balance must decrease gas costs and ether costs
        expect(afterEtherBalance).to.be.eq.BN(
          userEtherBalance.sub(
            new BN(ethCosts).add(new BN(gasUsed.toString()).mul(new BN(gasPrice)))
          )
        );
      });
    });

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
