const chai = require("chai");
const bnChai = require("bn-chai");
const chaiAsPromised = require("chai-as-promised");
const web3 = global.web3;
const {BN} = web3.utils;
chai.use(chaiAsPromised);
chai.use(bnChai(BN));
const truffleAssert = require("truffle-assertions");
const {expect} = chai;

const SwapAndDeposit = artifacts.require("SwapAndDeposit");
const SwapFactoryContract = artifacts.require("SwapAndDepositFactory");

const DAITokenContract = artifacts.require("DAIFake");
const RaiseTokenContract = artifacts.require("RaiseFake");
const KYCContract = artifacts.require("KYCRegistry");
const AuthContract = artifacts.require("Authorization");
const DepositRegistryContract = artifacts.require("DepositRegistry");

const DoubleSwapMock = artifacts.require("DoubleSwapMock");
const SwapFactoryMock = artifacts.require("SwapFactoryMock");
const DepositBadDelegate = artifacts.require("DepositBadDelegate");
const DepositNoTransfer = artifacts.require("DepositNoTransfer");
const DepositNoDepositor = artifacts.require("DepositNoDepositor");
const DepositNoToken = artifacts.require("DepositNoToken");
const NonERC20Token = artifacts.require("HeroOrigenToken");
const UniswapFactoryMock = artifacts.require("UniswapFactoryMock");

const {getWeb3} = require("../scripts/helpers.js");

const {initializeUniswap} = require("./uniswap.utils");

const zeroAddress = "0x0000000000000000000000000000000000000000";

contract("SwapAndDeposit", accounts => {
  const web3One = getWeb3(web3);

  // Activate better error handling with revert reasons
  web3One.eth.handleRevert = true;

  let SwapFactory;
  let SwapAndDepositTemplate;
  let RaiseToken;
  let DAIToken;
  let DepositRegistry;
  let Auth;

  const owner = accounts[0];
  const admin = accounts[1];
  const borrower = accounts[2];
  const lender = accounts[3];
  const other = accounts[4];

  const INPUT_AMOUNT = web3.utils.toWei("300"); // 300 DAI

  const beforeTest = async () => {
    try {
      RaiseToken = await RaiseTokenContract.new({from: owner});
      DAIToken = await DAITokenContract.new({from: owner});

      // Mint 1.000.000.000 DAI tokens to lender
      await DAIToken.mintTokens(lender, {from: owner});

      // adding borrower and lender to KYC
      KYCRegistry = await KYCContract.new();
      await KYCRegistry.setAdministrator(admin);
      await KYCRegistry.addAddressToKYC(borrower, {from: admin});
      await KYCRegistry.addAddressToKYC(lender, {from: admin});

      DepositRegistry = await DepositRegistryContract.new(RaiseToken.address, KYCRegistry.address, {
        from: owner
      });

      Auth = await AuthContract.new(KYCRegistry.address, DepositRegistry.address);
      SwapAndDepositTemplate = await SwapAndDeposit.new({from: owner});

      uniswapAddress = await initializeUniswap(web3, DAIToken.address, RaiseToken.address, owner);

      SwapFactory = await SwapFactoryContract.new(
        SwapAndDepositTemplate.address,
        Auth.address,
        uniswapAddress,
        {
          from: owner
        }
      );
    } catch (error) {
      throw error;
    }
  };

  describe("SwapAndDeposit Factory", () => {
    beforeEach(beforeTest);
    it("Expects to deploy a initiated minimal proxy", async () => {
      const tx = await SwapFactory.deploy();
      truffleAssert.eventEmitted(tx, "NewSwapContract");
      // Assert contract creation
      expect(tx.logs).not.to.be.empty;
      expect(tx.logs[0]).to.have.nested.property("args.proxyAddress");
    });
    it("Expects to check if address is a clone from template", async () => {
      const tx = await SwapFactory.deploy();
      const {proxyAddress} = tx.logs[0].args;

      const isClone = await SwapFactory.isCloned(SwapAndDepositTemplate.address, proxyAddress);
      expect(isClone).to.be.true;
    });

    it("Expects to SET auth if owner", async () => {
      const randomAddress = "0xda1827CDe22388eC0f8CdC384267B288A4079756";
      await SwapFactory.setAuthAddress(randomAddress, {from: owner});
      const newAddress = await SwapFactory.authAddress();
      expect(newAddress).to.be.equals(randomAddress);
    });

    it("Expects to SET uniswap if owner", async () => {
      const randomAddress = "0xdaB026ff46F72E35EDFe4D1AD37469C49CEC3F0b";
      await SwapFactory.setUniswapAddress(randomAddress, {from: owner});
      const newAddress = await SwapFactory.uniswapAddress();
      expect(newAddress).to.be.equals(randomAddress);
    });

    it("Expects to SET library if owner", async () => {
      const randomAddress = "0xda95b09EdC58Fd6d9390A0b0d6073f16d4F7f758";
      await SwapFactory.setLibraryAddress(randomAddress, {from: owner});
      const newAddress = await SwapFactory.libraryAddress();
      expect(newAddress).to.be.equals(randomAddress);
    });

    it("Expects to NOT SET auth if other", async () => {
      const swapFactory = new web3One.eth.Contract(SwapFactoryContract.abi, SwapFactory.address);
      const currentAddress = await SwapFactory.authAddress();
      const randomAddress = "0xda8e883e03F077666B164AA90075BEbf56d9455e";
      try {
        await swapFactory.methods.setAuthAddress(randomAddress).send({from: other});
        assert.fail("Other user should not be alllowed to set");
      } catch (error) {
        assert.equal(error.signature, "Error(String)");
        assert.equal(error.reason, "Ownable: caller is not the owner");
        assert(error.message.includes("reverted"));
      }
      const newAddress = await SwapFactory.authAddress();
      expect(newAddress).to.not.be.equals(randomAddress);
      expect(newAddress).to.be.equals(currentAddress);
    });
    it("Expects to NOT SET uniswap if other", async () => {
      const swapFactory = new web3One.eth.Contract(SwapFactoryContract.abi, SwapFactory.address);
      const currentAddress = await SwapFactory.uniswapAddress();
      const randomAddress = "0xda6494Ed9cfED40f2321adcFbcca8f80fD764ed2";
      try {
        await swapFactory.methods.setUniswapAddress(randomAddress).send({from: other});
        assert.fail("Other user should not be alllowed to set");
      } catch (error) {
        assert.equal(error.signature, "Error(String)");
        assert.equal(error.reason, "Ownable: caller is not the owner");
        assert(error.message.includes("reverted"));
      }
      const newAddress = await SwapFactory.uniswapAddress();
      expect(newAddress).to.not.be.equals(randomAddress);
      expect(newAddress).to.be.equals(currentAddress);
    });

    it("Expects to NOT SET library if other", async () => {
      const swapFactory = new web3One.eth.Contract(SwapFactoryContract.abi, SwapFactory.address);
      const currentAddress = await SwapFactory.libraryAddress();
      const randomAddress = "0xda9B6bE048aEaA333290226F07BD6B0A7AFE4B49";
      try {
        await swapFactory.methods.setLibraryAddress(randomAddress).send({from: other});
        assert.fail("Other user should not be alllowed to set");
      } catch (error) {
        assert.equal(error.signature, "Error(String)");
        assert.equal(error.reason, "Ownable: caller is not the owner");
        assert(error.message.includes("reverted"));
      }
      const newAddress = await SwapFactory.libraryAddress();
      expect(newAddress).to.not.be.equals(randomAddress);
      expect(newAddress).to.be.equals(currentAddress);
    });

    it("Expects to NOT deploy if library is not set", async () => {
      const swapFactoryTrufle = await SwapFactoryContract.new(
        zeroAddress,
        Auth.address,
        uniswapAddress,
        {
          from: owner
        }
      );
      const swapFactory = new web3One.eth.Contract(
        SwapFactoryContract.abi,
        swapFactoryTrufle.address
      );

      try {
        await swapFactory.methods.deploy().send({from: owner});

        assert.fail("Tx should not success");
      } catch (error) {
        assert.equal(error.signature, "Error(String)");
        assert.equal(error.reason, "library must be set");
        assert(error.message.includes("reverted"));
      }
    });
    it("Expects to NOT deploy if uniswap factory is not set", async () => {
      const swapFactoryTrufle = await SwapFactoryContract.new(
        SwapAndDepositTemplate.address,
        Auth.address,
        zeroAddress,
        {
          from: owner
        }
      );
      const swapFactory = new web3One.eth.Contract(
        SwapFactoryContract.abi,
        swapFactoryTrufle.address
      );
      try {
        await swapFactory.methods.deploy().send({from: owner});

        assert.fail("Tx should not success");
      } catch (error) {
        assert.equal(error.signature, "Error(String)");
        assert.equal(error.reason, "uniswap must be set");
        assert(error.message.includes("reverted"));
      }
    });
    it("Expects to NOT deploy if deposit is not set", async () => {
      const AuthTruffle = await AuthContract.new(KYCRegistry.address, zeroAddress);
      const swapFactoryTrufle = await SwapFactoryContract.new(
        SwapAndDepositTemplate.address,
        AuthTruffle.address,
        uniswapAddress,
        {
          from: owner
        }
      );
      const swapFactory = new web3One.eth.Contract(
        SwapFactoryContract.abi,
        swapFactoryTrufle.address
      );

      try {
        await swapFactory.methods.deploy().send({from: owner});

        assert.fail("Tx should not success");
      } catch (error) {
        assert.equal(error.signature, "Error(String)");
        assert.equal(error.reason, "deposit must be set");
        assert(error.message.includes("reverted"));
      }
    });
    it("Expects to NOT deploy if auth is not set", async () => {
      const swapFactoryTrufle = await SwapFactoryContract.new(
        SwapAndDepositTemplate.address,
        zeroAddress,
        uniswapAddress,
        {
          from: owner
        }
      );
      const swapFactory = new web3One.eth.Contract(
        SwapFactoryContract.abi,
        swapFactoryTrufle.address
      );

      try {
        await swapFactory.methods.deploy().send({from: owner});

        assert.fail("Tx should not success");
      } catch (error) {
        assert.equal(error.signature, "Error(String)");
        assert.equal(error.reason, "auth must be set");
        assert(error.message.includes("reverted"));
      }
    });
  });
  describe("SwapAndDeposit Master Template", () => {
    beforeEach(beforeTest);
    it("Expects to SwapAndDeposit Template to not be initialized", async () => {
      const swapTemplateTruffle = await SwapAndDeposit.new({from: owner});
      const swapTemplate = new web3One.eth.Contract(
        SwapAndDepositTemplate.abi,
        swapTemplateTruffle.address
      );

      try {
        await swapTemplate.methods
          .init(DepositRegistry.address, uniswapAddress)
          .send({from: lender});

        assert.fail("Tx should not success");
      } catch (error) {
        assert.equal(error.signature, "Error(String)");
        assert.equal(error.reason, "is template contract");
        assert(error.message.includes("reverted"));
      }
    });
    it("Expects to SwapAndDeposit Template to not be able to swap", async () => {
      const swapTemplateTruffle = await SwapAndDeposit.new({from: owner});
      const swapTemplate = new web3One.eth.Contract(
        SwapAndDepositTemplate.abi,
        swapTemplateTruffle.address
      );

      await DAIToken.approve(swapTemplateTruffle.address, INPUT_AMOUNT, {from: lender});
      try {
        await swapTemplate.methods
          .swapAndDeposit(lender, DAIToken.address, INPUT_AMOUNT)
          .send({from: lender, gas: 6000000});
        assert.fail("Tx should not success");
      } catch (error) {
        assert.equal(error.signature, "Error(String)");
        assert.equal(error.reason, "is template contract");
        assert(error.message.includes("reverted"));
      }
    });
  });
  describe("SwapAndDeposit Minimal Proxy", () => {
    beforeEach(beforeTest);

    it("Expects to swap DAI to RAISE and deposit to the DepositRegistry contract", async () => {
      const DAI_COST_200_RAISE = new BN("4596059099803939333");
      const allDaiBalance = await DAIToken.balanceOf(lender);
      const tx = await SwapFactory.deploy();
      // Assert contract creation
      expect(tx.logs).not.to.be.empty;
      expect(tx.logs[0]).to.have.nested.property("args.proxyAddress");
      truffleAssert.eventEmitted(tx, "NewSwapContract");
      const {proxyAddress} = tx.logs[0].args;

      // Load proxy interface
      const swapProxyTruffle = await SwapAndDeposit.at(proxyAddress);
      const swapProxy = new web3One.eth.Contract(SwapAndDepositTemplate.abi, proxyAddress);

      // User approves the swap
      await DAIToken.approve(proxyAddress, INPUT_AMOUNT, {from: lender});

      const swapGas = await swapProxy.methods
        .swapAndDeposit(lender, DAIToken.address, INPUT_AMOUNT)
        .estimateGas({from: lender});
      // Swap DAI to 200 RAISE and deposit it
      const swapTx = await swapProxy.methods
        .swapAndDeposit(lender, DAIToken.address, INPUT_AMOUNT)
        .send({from: lender, gas: swapGas});

      // Create truffle assert contexts
      const swapContext = await truffleAssert.createTransactionResult(
        swapProxyTruffle,
        swapTx.transactionHash
      );
      const depositContext = await truffleAssert.createTransactionResult(
        DepositRegistry,
        swapTx.transactionHash
      );

      // Check important events
      truffleAssert.eventEmitted(
        depositContext,
        "UserDepositCompleted"
        //({depositRegistry, user}) =>
        // depositRegistry === DepositRegistry.address && user === lender
      );
      truffleAssert.eventEmitted(
        swapContext,
        "SwapDeposit"
        //({loan, guy}) => loan === lender && guy === lender
      );

      // All the remaining DAI should come back to the user
      const afterDaiBalance = await DAIToken.balanceOf(lender);
      const afterRaiseBalance = await RaiseToken.balanceOf(lender);

      // Destroyed contract address must NOT hold any token or ETH
      const destroyedContractEther = await web3One.eth.getBalance(proxyAddress);
      const destroyedContractDAI = await DAIToken.balanceOf(proxyAddress);
      const destroyedContractRaise = await RaiseToken.balanceOf(proxyAddress);
      expect(destroyedContractEther).to.be.eq.BN("0");
      expect(destroyedContractDAI).to.be.eq.BN("0");
      expect(destroyedContractRaise).to.be.eq.BN("0");
      // User DAI balance should decrease the cost of 200 RAISE price
      expect(afterDaiBalance).to.be.lt.BN(allDaiBalance);
      expect(afterDaiBalance).to.be.eq.BN(allDaiBalance.sub(DAI_COST_200_RAISE));
      // User RAISE balance must be zero
      expect(afterRaiseBalance).to.be.eq.BN("0");
      // User have deposit inside the DepositRegistry
      const deposited = await DepositRegistry.hasDeposited(lender);
      expect(deposited).to.equal(true);
    });

    it("Expects to prevent reentrancy after swap", async () => {
      const doubleSwap = await DoubleSwapMock.new();
      await DAIToken.mintTokens(doubleSwap.address, {from: owner});
      const doubleSwapBalancePrior = await DAIToken.balanceOf(DAIToken.address);
      await truffleAssert.fails(
        doubleSwap.tryDoubleSwap(SwapFactory.address, DAIToken.address, {from: lender}),
        truffleAssert.ErrorType.REVERT,
        "this contract will selfdestruct"
      );
      const doubleSwapBalanceAfter = await DAIToken.balanceOf(DAIToken.address);

      // DAI Balance for doubleSwap contract should be the same due revert
      expect(doubleSwapBalanceAfter).to.be.eq.BN(doubleSwapBalancePrior);

      // User should NOT have deposit inside the DepositRegistry due revert
      const deposited = await DepositRegistry.hasDeposited(lender);
      expect(deposited).to.equal(false);
    });
    it("Expects to be destroyed if called from a contract", async () => {
      const doubleSwap = await DoubleSwapMock.new();
      await DAIToken.mintTokens(doubleSwap.address, {from: owner});
      const doubleSwapBalancePrior = await DAIToken.balanceOf(DAIToken.address);
      await truffleAssert.fails(
        doubleSwap.tryDoubleSwap(SwapFactory.address, DAIToken.address, {from: lender}),
        truffleAssert.ErrorType.REVERT,
        "this contract will selfdestruct"
      );
      const doubleSwapBalanceAfter = await DAIToken.balanceOf(DAIToken.address);

      // DAI Balance for doubleSwap contract should be the same due revert
      expect(doubleSwapBalanceAfter).to.be.eq.BN(doubleSwapBalancePrior);

      // User should NOT have deposit inside the DepositRegistry due revert
      const deposited = await DepositRegistry.hasDeposited(lender);
      expect(deposited).to.equal(false);
    });
    it("Getter isDestroyed should return true if called after selfdestruct in same transaction", async () => {
      const doubleSwap = await DoubleSwapMock.new();
      await DAIToken.mintTokens(doubleSwap.address, {from: owner});
      await truffleAssert.passes(
        doubleSwap.checkDestroyed(SwapFactory.address, DAIToken.address, {from: lender})
      );

      // User should have deposit inside the DepositRegistry due revert
      const deposited = await DepositRegistry.hasDeposited(lender);
      expect(deposited).to.equal(true);
    });
    it("Should not init twice by deposit", async () => {
      const swapFactoryMock = await SwapFactoryMock.new(
        SwapAndDepositTemplate.address,
        Auth.address,
        uniswapAddress,
        {
          from: owner
        }
      );
      await truffleAssert.fails(
        swapFactoryMock.deployDoubleInitDeposit({from: owner}),
        truffleAssert.ErrorType.REVERT,
        "deposit already init"
      );
    });

    it("Should not swap if not init", async () => {
      const swapFactoryMock = await SwapFactoryMock.new(
        SwapAndDepositTemplate.address,
        Auth.address,
        uniswapAddress,
        {
          from: owner
        }
      );

      const tx = await swapFactoryMock.deployNoInit({from: owner});
      const {proxyAddress} = tx.logs[0].args;
      const swapAndDeposit = await SwapAndDeposit.at(proxyAddress);

      // User approves the swap
      await DAIToken.approve(proxyAddress, INPUT_AMOUNT, {from: owner});

      await truffleAssert.fails(
        swapAndDeposit.swapAndDeposit(lender, DAIToken.address, INPUT_AMOUNT, {
          from: owner
        }),
        truffleAssert.ErrorType.REVERT,
        "not init"
      );

      // User should NOT have deposit inside the DepositRegistry due revert
      const deposited = await DepositRegistry.hasDeposited(lender);
      expect(deposited).to.equal(false);
    });

    it("Should not init twice by uniswap", async () => {
      const swapFactoryMock = await SwapFactoryMock.new(
        SwapAndDepositTemplate.address,
        Auth.address,
        uniswapAddress,
        {
          from: owner
        }
      );
      await truffleAssert.fails(
        swapFactoryMock.deployDoubleInitUniswap({from: owner}),
        truffleAssert.ErrorType.REVERT,
        "factory already init"
      );
    });

    it("Should revert if missing exchange", async () => {
      const doubleSwap = await DoubleSwapMock.new();
      const anotherToken = await DAITokenContract.new();
      await anotherToken.mintTokens(doubleSwap.address, {from: owner});
      await truffleAssert.fails(
        doubleSwap.checkMissingExchange(SwapFactory.address, anotherToken.address, {from: lender}),
        truffleAssert.ErrorType.REVERT,
        "exchange can not be 0 address"
      );

      // User should NOT have deposit inside the DepositRegistry due revert
      const deposited = await DepositRegistry.hasDeposited(lender);
      expect(deposited).to.equal(false);
    });

    it("Should revert if NO input tokens inside contract", async () => {
      const tx = await SwapFactory.deploy();
      const {proxyAddress} = tx.logs[0].args;
      const swapAndDeposit = await SwapAndDeposit.at(proxyAddress);

      await truffleAssert.fails(
        swapAndDeposit.swapAndDeposit(lender, DAIToken.address, web3.utils.toWei("1"), {
          from: other
        }),
        truffleAssert.ErrorType.REVERT
      );

      // User should NOT have deposit inside the DepositRegistry due revert
      const deposited = await DepositRegistry.hasDeposited(lender);
      expect(deposited).to.equal(false);
    });

    it("Should revert if input token is 0 address", async () => {
      const tx = await SwapFactory.deploy();
      const {proxyAddress} = tx.logs[0].args;
      const swapAndDeposit = await SwapAndDeposit.at(proxyAddress);

      await truffleAssert.fails(
        swapAndDeposit.swapAndDeposit(lender, zeroAddress, web3.utils.toWei("1"), {
          from: other
        }),
        truffleAssert.ErrorType.REVERT,
        "input address can not be 0"
      );

      // User should NOT have deposit inside the DepositRegistry due revert
      const deposited = await DepositRegistry.hasDeposited(lender);
      expect(deposited).to.equal(false);
    });

    it("Should revert if wrong token input token address", async () => {
      const tx = await SwapFactory.deploy();
      const {proxyAddress} = tx.logs[0].args;
      const swapAndDeposit = await SwapAndDeposit.at(proxyAddress);
      const wrongAddress = "0x0000000000000000000000000000000000000011";

      await truffleAssert.fails(
        swapAndDeposit.swapAndDeposit(lender, wrongAddress, web3.utils.toWei("1"), {from: lender}),
        truffleAssert.ErrorType.REVERT
      );

      // User should NOT have deposit inside the DepositRegistry due revert
      const deposited = await DepositRegistry.hasDeposited(lender);
      expect(deposited).to.equal(false);
    });

    it("Should revert if delegateDeposit returns false", async () => {
      const kycRegistry = await KYCContract.new();

      const depositRegistry = await DepositBadDelegate.new(
        RaiseToken.address,
        kycRegistry.address,
        {
          from: owner
        }
      );

      const auth = await AuthContract.new(kycRegistry.address, depositRegistry.address);

      const swapFactory = await SwapFactoryContract.new(
        SwapAndDepositTemplate.address,
        auth.address,
        uniswapAddress,
        {
          from: owner
        }
      );
      const tx = await swapFactory.deploy();
      const {proxyAddress} = tx.logs[0].args;

      // Load proxy interface
      const swapProxy = await SwapAndDeposit.at(proxyAddress);

      // User approves the swap
      await DAIToken.approve(proxyAddress, INPUT_AMOUNT, {from: owner});

      await truffleAssert.fails(
        swapProxy.swapAndDeposit(lender, DAIToken.address, INPUT_AMOUNT, {from: owner}),
        "error while deposit"
      );
    });
    it("Should revert if user does not become a depositor", async () => {
      const kycRegistry = await KYCContract.new();

      const depositRegistry = await DepositNoDepositor.new(
        RaiseToken.address,
        kycRegistry.address,
        {
          from: owner
        }
      );

      const auth = await AuthContract.new(kycRegistry.address, depositRegistry.address);

      const swapFactory = await SwapFactoryContract.new(
        SwapAndDepositTemplate.address,
        auth.address,
        uniswapAddress,
        {
          from: owner
        }
      );
      const tx = await swapFactory.deploy();
      const {proxyAddress} = tx.logs[0].args;
      // Load proxy interface
      const swapProxy = await SwapAndDeposit.at(proxyAddress);

      // User approves the swap
      await DAIToken.approve(proxyAddress, INPUT_AMOUNT, {from: owner});

      await truffleAssert.fails(
        swapProxy.swapAndDeposit(lender, DAIToken.address, INPUT_AMOUNT, {from: owner}),
        "should be depositor"
      );
    });

    it("Should revert if deposit token is zero", async () => {
      const kycRegistry = await KYCContract.new();

      const depositRegistry = await DepositNoToken.new(RaiseToken.address, kycRegistry.address, {
        from: owner
      });

      const auth = await AuthContract.new(kycRegistry.address, depositRegistry.address);

      const swapFactory = await SwapFactoryContract.new(
        SwapAndDepositTemplate.address,
        auth.address,
        uniswapAddress,
        {
          from: owner
        }
      );
      const tx = await swapFactory.deploy();
      const {proxyAddress} = tx.logs[0].args;
      // Load proxy interface
      const swapProxy = await SwapAndDeposit.at(proxyAddress);

      // User approves the swap
      await DAIToken.approve(proxyAddress, INPUT_AMOUNT, {from: owner});

      await truffleAssert.fails(
        swapProxy.swapAndDeposit(lender, DAIToken.address, INPUT_AMOUNT, {from: owner}),
        "output token can not be 0"
      );
    });

    it("Should revert if Deposit does not transferFrom funds from SwapAndDeposit", async () => {
      const kycRegistry = await KYCContract.new();

      const depositRegistry = await DepositNoTransfer.new(RaiseToken.address, kycRegistry.address, {
        from: owner
      });

      const auth = await AuthContract.new(kycRegistry.address, depositRegistry.address);

      const swapFactory = await SwapFactoryContract.new(
        SwapAndDepositTemplate.address,
        auth.address,
        uniswapAddress,
        {
          from: owner
        }
      );

      const tx = await swapFactory.deploy();
      const {proxyAddress} = tx.logs[0].args;

      // Load proxy interface
      const swapProxy = await SwapAndDeposit.at(proxyAddress);

      // User approves the swap
      await DAIToken.approve(proxyAddress, INPUT_AMOUNT, {from: owner});

      await truffleAssert.fails(
        swapProxy.swapAndDeposit(lender, DAIToken.address, INPUT_AMOUNT, {from: owner}),
        "output token still here"
      );
    });

    it("Should revert if SwapAndDeposit has extra output tokens", async () => {
      const tx = await SwapFactory.deploy();
      const {proxyAddress} = tx.logs[0].args;

      // Load proxy interface
      const swapProxy = await SwapAndDeposit.at(proxyAddress);

      // User approves the swap
      await DAIToken.approve(proxyAddress, INPUT_AMOUNT, {from: owner});

      // Mint output tokens to proxyAddress
      await RaiseToken.transfer(proxyAddress, INPUT_AMOUNT, {from: owner});

      await truffleAssert.fails(
        swapProxy.swapAndDeposit(lender, DAIToken.address, INPUT_AMOUNT, {from: owner}),
        truffleAssert.ErrorType.REVERT,
        "output token still here"
      );
    });

    it("Should revert if SwapAndDeposit has extra input tokens", async () => {
      const tx = await SwapFactory.deploy();
      const {proxyAddress} = tx.logs[0].args;

      // Load proxy interface
      const swapProxy = await SwapAndDeposit.at(proxyAddress);

      // User approves the swap
      await DAIToken.approve(proxyAddress, INPUT_AMOUNT, {from: owner});

      // Send extra tokens prior the tx
      await DAIToken.transfer(proxyAddress, INPUT_AMOUNT, {from: owner});

      await truffleAssert.fails(
        swapProxy.swapAndDeposit(lender, DAIToken.address, INPUT_AMOUNT, {from: owner}),
        truffleAssert.ErrorType.REVERT,
        "input token still here"
      );
    });

    it("Should revert if depositor is 0 address", async () => {
      const tx = await SwapFactory.deploy();
      const {proxyAddress} = tx.logs[0].args;

      // Load proxy interface
      const swapProxy = await SwapAndDeposit.at(proxyAddress);

      // User approves the swap
      await DAIToken.approve(proxyAddress, INPUT_AMOUNT, {from: owner});

      await truffleAssert.fails(
        swapProxy.swapAndDeposit(zeroAddress, DAIToken.address, INPUT_AMOUNT, {from: owner}),
        truffleAssert.ErrorType.REVERT,
        "depositor address can not be 0"
      );
    });

    it("Should revert if input tokenAmount is 0 ", async () => {
      const tx = await SwapFactory.deploy();
      const {proxyAddress} = tx.logs[0].args;

      // Load proxy interface
      const swapProxy = await SwapAndDeposit.at(proxyAddress);

      // User approves the swap
      await DAIToken.approve(proxyAddress, INPUT_AMOUNT, {from: owner});

      await truffleAssert.fails(
        swapProxy.swapAndDeposit(lender, DAIToken.address, "0", {from: owner}),
        truffleAssert.ErrorType.REVERT,
        "input token amount can not be 0"
      );
    });

    it("Should revert if lender is already depositor ", async () => {
      const tx = await SwapFactory.deploy();
      const {proxyAddress} = tx.logs[0].args;

      // Load proxy interface
      const swapProxy = await SwapAndDeposit.at(proxyAddress);

      // User approves the swap
      await DAIToken.approve(proxyAddress, INPUT_AMOUNT, {from: owner});
      await RaiseToken.mint(lender, INPUT_AMOUNT, {from: owner});
      await RaiseToken.approve(DepositRegistry.address, INPUT_AMOUNT, {from: lender});
      await DepositRegistry.depositFor(lender);
      await truffleAssert.fails(
        swapProxy.swapAndDeposit(lender, DAIToken.address, INPUT_AMOUNT, {from: owner}),
        truffleAssert.ErrorType.REVERT,
        "already depositor"
      );
    });

    it("Should revert if lender is already depositor ", async () => {
      const tx = await SwapFactory.deploy();
      const {proxyAddress} = tx.logs[0].args;

      // Load proxy interface
      const swapProxy = await SwapAndDeposit.at(proxyAddress);

      // User approves the swap
      await DAIToken.approve(proxyAddress, INPUT_AMOUNT, {from: owner});
      await RaiseToken.mint(lender, INPUT_AMOUNT, {from: owner});
      await RaiseToken.approve(DepositRegistry.address, INPUT_AMOUNT, {from: lender});
      await DepositRegistry.depositFor(lender);
      await truffleAssert.fails(
        swapProxy.swapAndDeposit(lender, DAIToken.address, INPUT_AMOUNT, {from: owner}),
        truffleAssert.ErrorType.REVERT,
        "already depositor"
      );
    });
    it("Should revert if swap does not return remaining funds", async () => {
      const uniswapFactoryMock = await UniswapFactoryMock.new();
      await uniswapFactoryMock.createExchange(DAIToken.address, {from: owner});

      const swapFactory = await SwapFactoryContract.new(
        SwapAndDepositTemplate.address,
        Auth.address,
        uniswapFactoryMock.address,
        {
          from: owner
        }
      );

      const tx = await swapFactory.deploy();
      const {proxyAddress} = tx.logs[0].args;

      // Load proxy interface
      const swapProxy = await SwapAndDeposit.at(proxyAddress);

      // User approves the swap
      await DAIToken.approve(proxyAddress, INPUT_AMOUNT, {from: owner});

      await truffleAssert.fails(
        swapProxy.swapAndDeposit(lender, DAIToken.address, INPUT_AMOUNT, {from: owner}),
        "Swap not spent input token"
      );
    });
  });
});
