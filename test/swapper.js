const chai = require("chai");
const bnChai = require("bn-chai");
const chaiAsPromised = require("chai-as-promised");
const {BN} = web3.utils;
chai.use(chaiAsPromised);
chai.use(bnChai(BN));
const truffleAssert = require("truffle-assertions");
const {expect} = chai;
const UniswapExchangeAbi = artifacts.require("IUniswapExchange").abi;
const UniswapFactoryAbi = artifacts.require("IUniswapFactory").abi;
const UniswapSwapper = artifacts.require("UniswapSwapper");
const UniswapSwapperFactoryContract = artifacts.require("UniswapSwapperFactory");

const DAITokenContract = artifacts.require("DAIFake");
const RaiseTokenContract = artifacts.require("RaiseFake");

const DoubleSwapMock = artifacts.require("DoubleSwapUniswapSwapperMock");
const UniswapSwapperFactoryMock = artifacts.require("UniswapSwapperFactoryMock");
const UniswapFactoryMock = artifacts.require("UniswapFactoryMock");
const Selfdestructor = artifacts.require("Selfdestructor");
const {getWeb3} = require("../scripts/helpers.js");

const {initializeUniswap} = require("./uniswap.utils");

const zeroAddress = "0x0000000000000000000000000000000000000000";

contract("UniswapSwapper", accounts => {
  const {fromWei} = web3.utils;
  const web3One = getWeb3(web3);

  // Activate better error handling with revert reasons
  web3One.eth.handleRevert = true;

  let UniswapSwapperFactory;
  let UniswapSwapperTemplate;
  let RaiseToken;
  let DAIToken;
  let uniswapAddress;

  const owner = accounts[0];
  const admin = accounts[1];
  const borrower = accounts[2];
  const lender = accounts[3];
  const other = accounts[4];

  const INPUT_AMOUNT = new BN(web3.utils.toWei("300")); // 300 DAI
  const OUTPUT_AMOUNT = new BN(web3.utils.toWei("200")); // 200 Raise

  const beforeTest = async () => {
    try {
      RaiseToken = await RaiseTokenContract.new({from: owner});
      DAIToken = await DAITokenContract.new({from: owner});

      // Mint 1.000.000.000 DAI tokens to lender
      await DAIToken.mintTokens(lender, {from: owner});

      UniswapSwapperTemplate = await UniswapSwapper.new({from: owner});

      uniswapAddress = await initializeUniswap(web3, DAIToken.address, RaiseToken.address, owner);

      UniswapSwapperFactory = await UniswapSwapperFactoryContract.new(
        UniswapSwapperTemplate.address,
        uniswapAddress,
        {
          from: owner
        }
      );
    } catch (error) {
      throw error;
    }
  };

  describe("UniswapSwapper Factory", () => {
    beforeEach(async () => {
      await beforeTest();
    });
    it("Expects to deploy a initiated minimal proxy", async () => {
      const tx = await UniswapSwapperFactory.deploy();
      truffleAssert.eventEmitted(tx, "NewSwapContract");
      // Assert contract creation
      expect(tx.logs).not.to.be.empty;
      expect(tx.logs[0]).to.have.nested.property("args.proxyAddress");
    });
    it("Expects to check if address is a clone from template", async () => {
      const tx = await UniswapSwapperFactory.deploy();
      const {proxyAddress} = tx.logs[0].args;

      const isClone = await UniswapSwapperFactory.isCloned(
        UniswapSwapperTemplate.address,
        proxyAddress
      );
      expect(isClone).to.be.true;
    });

    it("Expects to SET uniswap if owner", async () => {
      const randomAddress = "0xdaB026ff46F72E35EDFe4D1AD37469C49CEC3F0b";
      await UniswapSwapperFactory.setUniswapAddress(randomAddress, {from: owner});
      const newAddress = await UniswapSwapperFactory.uniswapAddress();
      expect(newAddress).to.be.equals(randomAddress);
    });

    it("Expects to SET library if owner", async () => {
      const randomAddress = "0xda95b09EdC58Fd6d9390A0b0d6073f16d4F7f758";
      await UniswapSwapperFactory.setLibraryAddress(randomAddress, {from: owner});
      const newAddress = await UniswapSwapperFactory.libraryAddress();
      expect(newAddress).to.be.equals(randomAddress);
    });

    it("Expects to NOT SET uniswap if other", async () => {
      const currentAddress = await UniswapSwapperFactory.uniswapAddress();
      const randomAddress = "0xda6494Ed9cfED40f2321adcFbcca8f80fD764ed2";
      await truffleAssert.fails(
        UniswapSwapperFactory.setUniswapAddress(randomAddress, {from: other}),
        truffleAssert.ErrorType.REVERT,
        "Ownable: caller is not the owner"
      );
      const newAddress = await UniswapSwapperFactory.uniswapAddress();
      expect(newAddress).to.not.be.equals(randomAddress);
      expect(newAddress).to.be.equals(currentAddress);
    });

    it("Expects to NOT SET library if other", async () => {
      const swapFactory = new web3One.eth.Contract(
        UniswapSwapperFactoryContract.abi,
        UniswapSwapperFactory.address
      );
      const currentAddress = await UniswapSwapperFactory.libraryAddress();
      const randomAddress = "0xda9B6bE048aEaA333290226F07BD6B0A7AFE4B49";
      await truffleAssert.fails(
        UniswapSwapperFactory.setLibraryAddress(randomAddress, {from: other}),
        truffleAssert.ErrorType.REVERT,
        "Ownable: caller is not the owner"
      );
      const newAddress = await UniswapSwapperFactory.libraryAddress();
      expect(newAddress).to.not.be.equals(randomAddress);
      expect(newAddress).to.be.equals(currentAddress);
    });

    it("Expects to NOT deploy if library is not set", async () => {
      const swapFactoryTrufle = await UniswapSwapperFactoryContract.new(
        zeroAddress,
        uniswapAddress,
        {
          from: owner
        }
      );
      await truffleAssert.fails(
        swapFactoryTrufle.deploy({from: other}),
        truffleAssert.ErrorType.REVERT,
        "library must be set"
      );
    });
    it("Expects to NOT deploy if uniswap factory is not set", async () => {
      const swapFactoryTrufle = await UniswapSwapperFactoryContract.new(
        UniswapSwapperTemplate.address,
        zeroAddress,
        {
          from: owner
        }
      );
      await truffleAssert.fails(
        swapFactoryTrufle.deploy({from: other}),
        truffleAssert.ErrorType.REVERT,
        "uniswap must be set"
      );
    });
  });
  describe("UniswapSwapper Master Template", () => {
    beforeEach(beforeTest);
    it("Expects to UniswapSwapper Template to NOT be initialized", async () => {
      const swapTemplateTruffle = await UniswapSwapper.new({from: owner});
      const swapTemplate = new web3One.eth.Contract(
        UniswapSwapperTemplate.abi,
        swapTemplateTruffle.address
      );

      await truffleAssert.fails(
        swapTemplateTruffle.init(uniswapAddress, {from: lender}),
        truffleAssert.ErrorType.REVERT,
        "is template contract"
      );
    });
    it("Expects to UniswapSwapper Template to NOT be able to swap token to token", async () => {
      const swapTemplateTruffle = await UniswapSwapper.new({from: owner});
      const swapTemplate = new web3One.eth.Contract(
        UniswapSwapperTemplate.abi,
        swapTemplateTruffle.address
      );

      await DAIToken.approve(swapTemplateTruffle.address, INPUT_AMOUNT, {from: lender});

      await truffleAssert.fails(
        swapTemplateTruffle.swap(
          lender,
          DAIToken.address,
          RaiseToken.address,
          INPUT_AMOUNT,
          OUTPUT_AMOUNT,
          {from: lender}
        ),
        truffleAssert.ErrorType.REVERT,
        "is template contract"
      );
    });

    it("Expects to UniswapSwapper Template to NOT be able to swap eth to token", async () => {
      const swapTemplateTruffle = await UniswapSwapper.new({from: owner});
      const swapTemplate = new web3One.eth.Contract(
        UniswapSwapperTemplate.abi,
        swapTemplateTruffle.address
      );

      await DAIToken.approve(swapTemplateTruffle.address, INPUT_AMOUNT, {from: lender});

      await truffleAssert.fails(
        swapTemplateTruffle.swapEth(lender, RaiseToken.address, OUTPUT_AMOUNT, {
          value: web3.utils.toWei("10"),
          from: lender,
          gas: 6000000
        }),
        truffleAssert.ErrorType.REVERT,
        "is template contract"
      );
    });
  });
  describe("UniswapSwapper Minimal Proxy: Token to Token", () => {
    beforeEach(beforeTest);

    it("Expects to swap DAI to RAISE and deposit to the DepositRegistry contract", async () => {
      const DAI_COST_200_RAISE = new BN("4596059099803939333");
      const allDaiBalance = await DAIToken.balanceOf(lender);
      const tx = await UniswapSwapperFactory.deploy();
      // Assert contract creation
      expect(tx.logs).not.to.be.empty;
      expect(tx.logs[0]).to.have.nested.property("args.proxyAddress");
      truffleAssert.eventEmitted(tx, "NewSwapContract");
      const {proxyAddress} = tx.logs[0].args;

      // Load proxy interface
      const swapProxyTruffle = await UniswapSwapper.at(proxyAddress);
      const swapProxy = new web3One.eth.Contract(UniswapSwapperTemplate.abi, proxyAddress);

      // User approves the swap
      await DAIToken.approve(proxyAddress, INPUT_AMOUNT, {from: lender});

      const swapGas = await swapProxy.methods
        .swap(lender, DAIToken.address, RaiseToken.address, INPUT_AMOUNT, OUTPUT_AMOUNT)
        .estimateGas({from: lender});
      // Swap DAI to 200 RAISE
      await swapProxy.methods
        .swap(lender, DAIToken.address, RaiseToken.address, INPUT_AMOUNT, OUTPUT_AMOUNT)
        .send({from: lender, gas: swapGas});

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
      // User RAISE balance must be zer
      expect(afterRaiseBalance).to.be.eq.BN(OUTPUT_AMOUNT);
    });

    it("Expects to prevent reentrancy after swap", async () => {
      const doubleSwap = await DoubleSwapMock.new();
      await DAIToken.mintTokens(doubleSwap.address, {from: owner});
      const doubleSwapBalancePrior = await DAIToken.balanceOf(DAIToken.address);
      await truffleAssert.fails(
        doubleSwap.tryDoubleSwap(
          UniswapSwapperFactory.address,
          DAIToken.address,
          RaiseToken.address,
          {
            from: lender
          }
        ),
        truffleAssert.ErrorType.REVERT,
        "this contract will selfdestruct"
      );
      const doubleSwapBalanceAfter = await DAIToken.balanceOf(DAIToken.address);

      // DAI Balance for doubleSwap contract should be the same due revert
      expect(doubleSwapBalanceAfter).to.be.eq.BN(doubleSwapBalancePrior);
    });
    it("Expects to be destroyed if called from a contract", async () => {
      const doubleSwap = await DoubleSwapMock.new();
      await DAIToken.mintTokens(doubleSwap.address, {from: owner});
      const doubleSwapBalancePrior = await DAIToken.balanceOf(DAIToken.address);
      await truffleAssert.fails(
        doubleSwap.tryDoubleSwap(
          UniswapSwapperFactory.address,
          DAIToken.address,
          RaiseToken.address,
          {
            from: lender
          }
        ),
        truffleAssert.ErrorType.REVERT,
        "this contract will selfdestruct"
      );
      const doubleSwapBalanceAfter = await DAIToken.balanceOf(DAIToken.address);

      // DAI Balance for doubleSwap contract should be the same due revert
      expect(doubleSwapBalanceAfter).to.be.eq.BN(doubleSwapBalancePrior);
    });
    it("Getter isDestroyed should return true if called after selfdestruct in same transaction", async () => {
      const doubleSwap = await DoubleSwapMock.new();
      await DAIToken.mintTokens(doubleSwap.address, {from: owner});
      await truffleAssert.passes(
        doubleSwap.checkDestroyed(
          UniswapSwapperFactory.address,
          DAIToken.address,
          RaiseToken.address,
          {
            from: lender
          }
        )
      );
    });

    it("Should not swap if not init", async () => {
      const swapFactoryMock = await UniswapSwapperFactoryMock.new(
        UniswapSwapperTemplate.address,
        uniswapAddress,
        {
          from: owner
        }
      );

      const tx = await swapFactoryMock.deployNoInit({from: owner});
      const {proxyAddress} = tx.logs[0].args;
      const swapper = await UniswapSwapper.at(proxyAddress);

      // User approves the swap
      await DAIToken.approve(proxyAddress, INPUT_AMOUNT, {from: owner});

      await truffleAssert.fails(
        swapper.swap(lender, DAIToken.address, RaiseToken.address, INPUT_AMOUNT, OUTPUT_AMOUNT, {
          from: owner
        }),
        truffleAssert.ErrorType.REVERT,
        "not init"
      );
    });

    it("Should not init twice by uniswap", async () => {
      const swapFactoryMock = await UniswapSwapperFactoryMock.new(
        UniswapSwapperTemplate.address,
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
        doubleSwap.checkMissingExchange(
          UniswapSwapperFactory.address,
          anotherToken.address,
          RaiseToken.address,
          {
            from: lender
          }
        ),
        truffleAssert.ErrorType.REVERT,
        "exchange can not be 0 address"
      );
    });

    it("Should revert if NO input tokens inside contract", async () => {
      const tx = await UniswapSwapperFactory.deploy();
      const {proxyAddress} = tx.logs[0].args;
      const swapper = await UniswapSwapper.at(proxyAddress);

      await truffleAssert.fails(
        swapper.swap(
          lender,
          DAIToken.address,
          RaiseToken.address,
          web3.utils.toWei("1"),
          OUTPUT_AMOUNT,
          {
            from: other
          }
        ),
        truffleAssert.ErrorType.REVERT
      );
    });

    it("Should revert if input token is 0 address", async () => {
      const tx = await UniswapSwapperFactory.deploy();
      const {proxyAddress} = tx.logs[0].args;
      const swapper = await UniswapSwapper.at(proxyAddress);

      await truffleAssert.fails(
        swapper.swap(
          lender,
          zeroAddress,
          RaiseToken.address,
          web3.utils.toWei("1"),
          OUTPUT_AMOUNT,
          {
            from: other
          }
        ),
        truffleAssert.ErrorType.REVERT,
        "input address can not be 0"
      );
    });

    it("Should revert if wrong token input token address", async () => {
      const tx = await UniswapSwapperFactory.deploy();
      const {proxyAddress} = tx.logs[0].args;
      const swapper = await UniswapSwapper.at(proxyAddress);
      const wrongAddress = "0x0000000000000000000000000000000000000011";

      await truffleAssert.fails(
        swapper.swap(
          lender,
          wrongAddress,
          RaiseToken.address,
          web3.utils.toWei("1"),
          OUTPUT_AMOUNT,
          {from: lender}
        ),
        truffleAssert.ErrorType.REVERT
      );
    });

    it("Should prevent DDOS if has extra output tokens", async () => {
      const tx = await UniswapSwapperFactory.deploy();
      const {proxyAddress} = tx.logs[0].args;

      // Load proxy interface
      const swapProxy = await UniswapSwapper.at(proxyAddress);

      // User approves the swap
      await DAIToken.approve(proxyAddress, INPUT_AMOUNT, {from: owner});

      // Mint output tokens to proxyAddress
      await RaiseToken.transfer(proxyAddress, INPUT_AMOUNT, {from: owner});

      await truffleAssert.passes(
        swapProxy.swap(lender, DAIToken.address, RaiseToken.address, INPUT_AMOUNT, OUTPUT_AMOUNT, {
          from: owner
        }),
        truffleAssert.ErrorType.REVERT,
        "output token still here"
      );
    });

    it("Should prevent DDOS if has extra input tokens", async () => {
      const tx = await UniswapSwapperFactory.deploy();
      const {proxyAddress} = tx.logs[0].args;

      // Load proxy interface
      const swapProxy = await UniswapSwapper.at(proxyAddress);

      // User approves the swap
      await DAIToken.approve(proxyAddress, INPUT_AMOUNT, {from: owner});

      // Send extra tokens prior the tx
      await DAIToken.transfer(proxyAddress, INPUT_AMOUNT, {from: owner});

      await truffleAssert.passes(
        swapProxy.swap(lender, DAIToken.address, RaiseToken.address, INPUT_AMOUNT, OUTPUT_AMOUNT, {
          from: owner
        })
      );
    });

    it("Should revert if input tokenAmount is 0 ", async () => {
      const tx = await UniswapSwapperFactory.deploy();
      const {proxyAddress} = tx.logs[0].args;

      // Load proxy interface
      const swapProxy = await UniswapSwapper.at(proxyAddress);

      // User approves the swap
      await DAIToken.approve(proxyAddress, INPUT_AMOUNT, {from: owner});

      await truffleAssert.fails(
        swapProxy.swap(lender, DAIToken.address, RaiseToken.address, "0", OUTPUT_AMOUNT, {
          from: owner
        }),
        truffleAssert.ErrorType.REVERT,
        "input token amount can not be 0"
      );
    });

    it("Should revert if swap does not return remaining funds", async () => {
      const uniswapFactoryMock = await UniswapFactoryMock.new();
      await uniswapFactoryMock.createExchange(DAIToken.address, {from: owner});

      const swapFactory = await UniswapSwapperFactoryContract.new(
        UniswapSwapperTemplate.address,
        uniswapFactoryMock.address,
        {
          from: owner
        }
      );

      const tx = await swapFactory.deploy();
      const {proxyAddress} = tx.logs[0].args;

      // Load proxy interface
      const swapProxy = await UniswapSwapper.at(proxyAddress);

      // User approves the swap
      await DAIToken.approve(proxyAddress, INPUT_AMOUNT, {from: owner});

      await truffleAssert.fails(
        swapProxy.swap(lender, DAIToken.address, RaiseToken.address, INPUT_AMOUNT, OUTPUT_AMOUNT, {
          from: owner
        }),
        "Swap not spent input token"
      );
    });
  });
  describe("UniswapSwapper Minimal Proxy: ETH to Token", () => {
    beforeEach(beforeTest);

    it("Expects to swap ETH to RAISE", async () => {
      const tx = await UniswapSwapperFactory.deploy({from: owner});
      // Assert contract creation
      expect(tx.logs).not.to.be.empty;
      expect(tx.logs[0]).to.have.nested.property("args.proxyAddress");
      truffleAssert.eventEmitted(tx, "NewSwapContract");
      const {proxyAddress} = tx.logs[0].args;

      // Track lender balance prior the investment
      const lenderEtherBalance = new BN(await web3One.eth.getBalance(lender));
      const lenderDAIBalance = new BN(await DAIToken.balanceOf(lender));

      // Load proxy interface and exchange rates
      const swapProxyTruffle = await UniswapSwapper.at(proxyAddress);

      const exchangeAddress = await new web3One.eth.Contract(
        UniswapFactoryAbi,
        uniswapAddress
      ).methods
        .getExchange(DAIToken.address)
        .call();
      const exchange = new web3One.eth.Contract(UniswapExchangeAbi, exchangeAddress);
      const ethCosts = new BN(
        await exchange.methods.getEthToTokenOutputPrice(OUTPUT_AMOUNT).call()
      );

      // Add 1% slippage, not needed in test but needed in production
      const ethCostsWithSlippage = ethCosts.add(ethCosts.mul(new BN("1").div(new BN("100"))));

      // Swap ETH to 200 DAI
      const swapTx = await swapProxyTruffle.swapEth(lender, DAIToken.address, OUTPUT_AMOUNT, {
        value: ethCostsWithSlippage,
        from: lender
      });

      await truffleAssert.eventEmitted(
        swapTx,
        "Swap"
        //({loan, guy}) => loan === lender && guy === lender
      );
      // Retrieve gasUsed, real eth spent, and gas price to know the total of ETH spent
      const {
        receipt: {gasUsed}
      } = swapTx;
      const {
        args: {inputTokenSpent}
      } = swapTx.logs[0];

      const gasPrice = (await web3.eth.getTransaction(swapTx.tx)).gasPrice;

      // All the remaining ETH should come back to the user
      const afterDaiBalance = new BN(await DAIToken.balanceOf(lender));
      const afterEtherBalance = new BN(await web3One.eth.getBalance(lender));

      // Destroyed contract address must NOT hold any token or ETH
      const destroyedContractEther = await web3One.eth.getBalance(proxyAddress);
      const destroyedContractDAI = await DAIToken.balanceOf(proxyAddress);

      expect(destroyedContractEther).to.be.eq.BN("0");
      expect(destroyedContractDAI).to.be.eq.BN("0");

      // User DAI balance should increase 200 DAI
      expect(afterDaiBalance).to.be.eq.BN(lenderDAIBalance.add(OUTPUT_AMOUNT));
      // User ETH balance must decrease gas costs and ether costs
      expect(afterEtherBalance).to.be.eq.BN(
        lenderEtherBalance.sub(
          new BN(inputTokenSpent).add(new BN(gasUsed.toString()).mul(new BN(gasPrice)))
        )
      );
    });

    it("Expects to prevent reentrancy after swap", async () => {
      const doubleSwap = await DoubleSwapMock.new();
      const doubleSwapBalancePrior = await DAIToken.balanceOf(DAIToken.address);
      await truffleAssert.fails(
        doubleSwap.tryDoubleEthSwap(UniswapSwapperFactory.address, DAIToken.address, {
          value: web3.utils.toWei("3"),
          from: lender
        }),
        truffleAssert.ErrorType.REVERT,
        "this contract will selfdestruct"
      );
      const doubleSwapBalanceAfter = await DAIToken.balanceOf(DAIToken.address);

      // DAI Balance for doubleSwap contract should be the same due revert
      expect(doubleSwapBalanceAfter).to.be.eq.BN(doubleSwapBalancePrior);
    });
    it("Getter isDestroyed should return true if called after selfdestruct in same transaction", async () => {
      const doubleSwap = await DoubleSwapMock.new();
      await truffleAssert.passes(
        doubleSwap.checkDestroyedEthSwap(UniswapSwapperFactory.address, DAIToken.address, {
          value: web3.utils.toWei("1"),
          from: lender
        })
      );
    });

    it("Should not swap if not init", async () => {
      const swapFactoryMock = await UniswapSwapperFactoryMock.new(
        UniswapSwapperTemplate.address,
        uniswapAddress,
        {
          from: owner
        }
      );

      const tx = await swapFactoryMock.deployNoInit({from: owner});
      const {proxyAddress} = tx.logs[0].args;
      const swapper = await UniswapSwapper.at(proxyAddress);

      await truffleAssert.fails(
        swapper.swapEth(lender, DAIToken.address, OUTPUT_AMOUNT, {
          value: web3.utils.toWei("1"),
          from: owner
        }),
        truffleAssert.ErrorType.REVERT,
        "not init"
      );
    });

    it("Should revert if missing exchange", async () => {
      const doubleSwap = await DoubleSwapMock.new();
      const anotherToken = await DAITokenContract.new();
      await truffleAssert.fails(
        doubleSwap.checkMissingExchangeEthSwap(
          UniswapSwapperFactory.address,
          anotherToken.address,
          {
            value: web3.utils.toWei("1"),
            from: lender
          }
        ),
        truffleAssert.ErrorType.REVERT,
        "exchange can not be 0 address"
      );
    });

    it("Should revert if NO input eth inside contract", async () => {
      const tx = await UniswapSwapperFactory.deploy();
      const {proxyAddress} = tx.logs[0].args;
      const swapper = await UniswapSwapper.at(proxyAddress);

      await truffleAssert.fails(
        swapper.swapEth(lender, DAIToken.address, OUTPUT_AMOUNT, {
          value: "0",
          from: other
        }),
        truffleAssert.ErrorType.REVERT
      );
    });

    it("Should revert if output token is 0 address", async () => {
      const tx = await UniswapSwapperFactory.deploy();
      const {proxyAddress} = tx.logs[0].args;
      const swapper = await UniswapSwapper.at(proxyAddress);

      await truffleAssert.fails(
        swapper.swapEth(lender, zeroAddress, OUTPUT_AMOUNT, {
          value: web3.utils.toWei("1"),
          from: other
        }),
        truffleAssert.ErrorType.REVERT,
        "output token can not be 0"
      );
    });

    it("Should revert if wrong token input token address", async () => {
      const tx = await UniswapSwapperFactory.deploy();
      const {proxyAddress} = tx.logs[0].args;
      const swapper = await UniswapSwapper.at(proxyAddress);
      const wrongAddress = "0x0000000000000000000000000000000000000011";

      await truffleAssert.fails(
        swapper.swapEth(lender, wrongAddress, OUTPUT_AMOUNT, {
          value: web3.utils.toWei("1"),
          from: lender
        }),
        truffleAssert.ErrorType.REVERT
      );
    });

    it("Should prevent DDOS if has extra output tokens", async () => {
      const tx = await UniswapSwapperFactory.deploy();
      const {proxyAddress} = tx.logs[0].args;

      // Load proxy interface
      const swapProxy = await UniswapSwapper.at(proxyAddress);

      // Mint output tokens to proxyAddress
      await RaiseToken.transfer(proxyAddress, INPUT_AMOUNT, {from: owner});

      await truffleAssert.passes(
        swapProxy.swapEth(lender, DAIToken.address, OUTPUT_AMOUNT, {
          value: web3.utils.toWei("1"),
          from: lender
        }),
        truffleAssert.ErrorType.REVERT,
        "output token still here"
      );
    });

    it("Should prevent DDOS if has extra input tokens", async () => {
      const tx = await UniswapSwapperFactory.deploy();
      const {proxyAddress} = tx.logs[0].args;

      // Load proxy interface
      const swapProxy = await UniswapSwapper.at(proxyAddress);

      // Sends 1 wei Ether via selfdestruct
      const selfdestructContract = await Selfdestructor.new();
      await selfdestructContract.sendEtherWithSelfdestruct(proxyAddress, {from: owner, value: "1"}); // 1 wei

      await truffleAssert.passes(
        swapProxy.swapEth(lender, DAIToken.address, OUTPUT_AMOUNT, {
          value: web3.utils.toWei("1"),
          from: lender
        })
      );
    });

    xit("Should revert if swap does not return output token", async () => {
      const uniswapFactoryMock = await UniswapFactoryMock.new();
      await uniswapFactoryMock.createExchange(DAIToken.address, {from: owner});

      const swapFactory = await UniswapSwapperFactoryContract.new(
        UniswapSwapperTemplate.address,
        uniswapFactoryMock.address,
        {
          from: owner
        }
      );

      const tx = await swapFactory.deploy();
      const {proxyAddress} = tx.logs[0].args;

      // Load proxy interface
      const swapProxy = await UniswapSwapper.at(proxyAddress);

      await truffleAssert.fails(
        swapProxy.swapEth(lender, DAIToken.address, OUTPUT_AMOUNT, {
          value: web3.utils.toWei("1"),
          from: owner
        }),
        "no output token from uniswap"
      );
    });
  });
});
