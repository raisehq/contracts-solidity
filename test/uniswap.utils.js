const UniswapExchangeAbi = artifacts.require("IUniswapExchange").abi;
const UniswapFactoryAbi = artifacts.require("IUniswapFactory").abi;
const AbiERC20 = artifacts.require("DAIFake").abi;
const uniswap = require("@uniswap/sdk");
const BN = require("bn.js");
const BigNumber = uniswap.BigNumber;

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

const tokenInputToTokenCosts = async (
  anyWeb3,
  uniswapFactoryAddress,
  inputToken,
  outputToken,
  amount,
  from
) => {
  const web3One = getWeb3(anyWeb3);
  const uniswapFactory = await new web3One.eth.Contract(UniswapFactoryAbi, uniswapFactoryAddress);
  const exchangeAddressA = await uniswapFactory.methods.getExchange(inputToken).call();
  const exchangeAddressB = await uniswapFactory.methods.getExchange(outputToken).call();
  const inputExchange = new web3One.eth.Contract(UniswapExchangeAbi, exchangeAddressA);
  const outputExchange = new web3One.eth.Contract(UniswapExchangeAbi, exchangeAddressB);
  const inputTokenContract = new web3One.eth.Contract(AbiERC20, inputToken);
  const outputTokenContract = new web3One.eth.Contract(AbiERC20, outputToken);
  const inputExchangeTokenBalance = await inputTokenContract.methods
    .balanceOf(exchangeAddressA)
    .call();
  const outputExchangeTokenBalance = await outputTokenContract.methods
    .balanceOf(exchangeAddressB)
    .call();
  const inputExchangeEthBalance = await web3.eth.getBalance(exchangeAddressA);
  const outputExchangeEthBalance = await web3.eth.getBalance(exchangeAddressB);
  const inputReserves = {
    // details for the passed token
    token: {
      chainId: 1,
      address: inputToken,
      decimals: 18
    },

    // details for the Uniswap exchange of the passed token
    exchange: {
      chainId: 1,
      address: exchangeAddressA,
      decimals: 18
    },

    // details for the ETH portion of the reserves of the passed token
    ethReserve: {
      token: {
        chainId: 1,
        address: "ETH",
        decimals: 18
      },
      amount: new BigNumber(inputExchangeEthBalance.toString())
    },

    // details for the token portion of the reserves of the passed token
    tokenReserve: {
      token: {
        chainId: 1,
        address: inputToken,
        decimals: 18
      },
      amount: new BigNumber(inputExchangeTokenBalance.toString())
    }
  };
  const outputReserves = {
    // details for the passed token
    token: {
      chainId: 1,
      address: outputToken,
      decimals: 18
    },

    // details for the Uniswap exchange of the passed token
    exchange: {
      chainId: 1,
      address: exchangeAddressB,
      decimals: 18
    },

    // details for the ETH portion of the reserves of the passed token
    ethReserve: {
      token: {
        chainId: 1,
        address: "ETH",
        decimals: 18
      },
      amount: new BigNumber(outputExchangeEthBalance.toString())
    },

    // details for the token portion of the reserves of the passed token
    tokenReserve: {
      token: {
        chainId: 1,
        address: outputToken,
        decimals: 18
      },
      amount: new BigNumber(outputExchangeTokenBalance.toString())
    }
  };
  const result = uniswap.tradeTokensForExactTokensWithData(
    inputReserves,
    outputReserves,
    BigNumber(amount.toString())
  );
  return new BN(result.inputAmount.amount.toString());
};
module.exports = {
  initializeUniswap,
  tokenInputToTokenCosts
};
