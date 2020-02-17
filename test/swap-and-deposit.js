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
const UniswapExchangeAbi = artifacts.require("IUniswapExchange").abi;
const UniswapFactoryAbi = artifacts.require("IUniswapFactory").abi;
const DAITokenContract = artifacts.require("DAIFake");
const RaiseTokenContract = artifacts.require("RaiseFake");
const AbiERC20 = artifacts.require("DAIFake").abi;
const KYCContract = artifacts.require("KYCRegistry");
const AuthContract = artifacts.require("Authorization");
const DepositRegistryContract = artifacts.require("DepositRegistry");

const {
  getWeb3,
  UNISWAP_EXCHANGE_BYTECODE,
  UNISWAP_FACTORY_BYTECODE
} = require("../scripts/helpers.js");

// Exchange Alpha mimics DAI pool at 17 feb 2020
const exchangeAlphaPool = {
  tokenPool: web3.utils.toWei("2072168"),
  ethPool: web3.utils.toWei("8257")
};
// Exchange Beta mimics RAISE pool at 17 feb 2020
const exchangeBetaPool = {
  tokenPool: web3.utils.toWei("263875"),
  ethPool: web3.utils.toWei("24")
};
/**
 * initializeUniswap: deploy uniswap factory and exchange template to replicate Uniswap in local testnet
 * @param {*} anyWeb3
 * @param {*} tokenA
 * @param {*} tokenB
 * @param {*} owner
 */
const initializeUniswap = async (anyWeb3, tokenA, tokenB, owner) => {
  const web3One = getWeb3(anyWeb3);
  const defaultOptions = {from: owner, gas: 9000000};
  const tokenInstanceA = new web3One.eth.Contract(AbiERC20, tokenA);
  const tokenInstanceB = new web3One.eth.Contract(AbiERC20, tokenB);

  // deploy exchange contract
  const uniswapExchange = await new web3One.eth.Contract(UniswapExchangeAbi, {
    data: UNISWAP_EXCHANGE_BYTECODE
  })
    .deploy({arguments: []})
    .send(defaultOptions);

  // deploy uniswap factory
  const uniswapFactory = await new web3One.eth.Contract(UniswapFactoryAbi, {
    data: UNISWAP_FACTORY_BYTECODE
  })
    .deploy({arguments: []})
    .send(defaultOptions);
  // Initialize factory
  await uniswapFactory.methods
    .initializeFactory(uniswapExchange.options.address)
    .send(defaultOptions);

  // Create exchange Alpha
  await uniswapFactory.methods.createExchange(tokenA).send(defaultOptions);
  const exchangeAlphaAddress = await uniswapFactory.methods.getExchange(tokenA).call();
  const exchangeAlpha = new web3One.eth.Contract(UniswapExchangeAbi, exchangeAlphaAddress);
  // Create exchange Beta
  await uniswapFactory.methods.createExchange(tokenB).send(defaultOptions);
  const exchangeBetaAddress = await uniswapFactory.methods.getExchange(tokenB).call();
  console.log(exchangeAlphaAddress, exchangeBetaAddress);
  const exchangeBeta = new web3One.eth.Contract(UniswapExchangeAbi, exchangeBetaAddress);

  const deadline = Math.floor(new Date().getTime() / 1000 + 600000);
  // Approve to exchanges
  await tokenInstanceA.methods
    .approve(exchangeAlphaAddress, exchangeAlphaPool.tokenPool)
    .send(defaultOptions);
  await tokenInstanceB.methods
    .approve(exchangeBetaAddress, exchangeBetaPool.tokenPool)
    .send(defaultOptions);

  // Add liquidity to uniswap exchanges
  await exchangeBeta.methods
    .addLiquidity("0", exchangeBetaPool.tokenPool, deadline.toString())
    .send({value: exchangeBetaPool.ethPool, from: owner, gas: 9000000});

  await exchangeAlpha.methods
    .addLiquidity("0", exchangeAlphaPool.tokenPool, deadline.toString())
    .send({value: exchangeAlphaPool.ethPool, from: owner, gas: 9000000});

  // return factory address;
  return uniswapFactory.options.address;
};

contract("SwapAndDeposit", accounts => {
  let SwapFactory;
  let SwapAndDepositTemplate;
  let RaiseToken;
  let DAIToken;

  const owner = accounts[0];
  const admin = accounts[1];
  const borrower = accounts[2];
  const lender = accounts[3];

  describe("Unit tests for SwapAndDeposit minimal proxy", () => {
    before(async () => {
      try {
        RaiseToken = await RaiseTokenContract.new({from: owner});
        DAIToken = await DAITokenContract.new({from: owner});

        // Mint DAI tokens to lender
        await DAIToken.mintTokens(lender, {from: owner});
        // adding borrower and lender to KYC
        KYCRegistry = await KYCContract.new();
        await KYCRegistry.setAdministrator(admin);
        await KYCRegistry.addAddressToKYC(borrower, {from: admin});
        await KYCRegistry.addAddressToKYC(lender, {from: admin});

        DepositRegistry = await DepositRegistryContract.new(
          RaiseToken.address,
          KYCRegistry.address,
          {from: owner}
        );

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
    });
    describe("Deploy", () => {
      beforeEach(async () => {});
      it("Expects to deploy a minimal proxy", async () => {
        const tx = await SwapFactory.deploy();
        console.log(tx);
        truffleAssert.eventEmitted(tx, "NewSwapContract");
      });
    });
  });
});
