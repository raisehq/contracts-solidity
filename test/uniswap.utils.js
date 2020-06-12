const UniswapExchangeAbi = artifacts.require("IUniswapExchange").abi;
const UniswapFactoryAbi = artifacts.require("IUniswapFactory").abi;
const AbiERC20 = artifacts.require("DAIFake").abi;

const {
  getWeb3,
  UNISWAP_EXCHANGE_BYTECODE,
  UNISWAP_FACTORY_BYTECODE
} = require("../scripts/helpers.js");

// Liquidity pool ALPHA mimics DAI pool at 17 feb 2020
const exchangeAlphaPool = {
  tokenPool: web3.utils.toWei("2072168"),
  ethPool: web3.utils.toWei("8257")
};

// Liquidity pool BETA mimics RAISE pool at 17/02/2020
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
  const exchangeBeta = new web3One.eth.Contract(UniswapExchangeAbi, exchangeBetaAddress);

  const deadline = Math.floor(new Date().getTime() / 1000 + 600000000000);

  // Approve to exchanges
  await tokenInstanceA.methods
    .approve(exchangeAlphaAddress, exchangeAlphaPool.tokenPool)
    .send(defaultOptions);

  await tokenInstanceB.methods
    .approve(exchangeBetaAddress, exchangeBetaPool.tokenPool)
    .send(defaultOptions);

  // Add liquidity to uniswap exchanges

  await exchangeAlpha.methods
    .addLiquidity("0", exchangeAlphaPool.tokenPool, deadline.toString())
    .send({value: exchangeAlphaPool.ethPool, from: owner, gas: 9000000});

  await exchangeBeta.methods
    .addLiquidity("0", exchangeBetaPool.tokenPool, deadline.toString())
    .send({value: exchangeBetaPool.ethPool, from: owner, gas: 9000000});

  // return factory address;
  return uniswapFactory.options.address;
};

module.exports = {
  initializeUniswap
};
