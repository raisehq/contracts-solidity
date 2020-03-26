const _ = require("lodash");
const UniswapSwapper = artifacts.require("UniswapSwapper");
const UniswapSwapperFactory = artifacts.require("UniswapSwapperFactory");
const UniswapExchangeAbi = artifacts.require("IUniswapExchange").abi;
const UniswapFactoryAbi = artifacts.require("IUniswapFactory").abi;
const {writeFileSync} = require("fs");
const {
  getContracts,
  contractIsUpdated,
  getWeb3,
  UNISWAP_FACTORY_BYTECODE,
  UNISWAP_EXCHANGE_BYTECODE,
  UNISWAP_FACTORY_ADDRESS,
  metadataFactory,
  setMetadata,
  writeMetadataTemp
} = require("../scripts/helpers");
const {BN} = require("web3-utils");

const UniswapSwapperId = "UniswapSwapper";
const UniswapSwapperFactoryId = "UniswapSwapperFactory";
const uniswapId = "UniswapFactory";

const migration = async (deployer, network, accounts) => {
  const web3One = getWeb3(web3);
  const contracts = await getContracts();
  let contractMetadata = _.cloneDeep(contracts);
  const netId = await web3One.eth.net.getId();
  const deployerAddress = accounts[0];

  let uniswapAddress = UNISWAP_FACTORY_ADDRESS[netId] || null;
  const authAddress = _.get(contracts, `address.${netId}.Auth`);

  const swapTemplateHasUpdated = () => contractIsUpdated(contracts, netId, UniswapSwapperId, UniswapSwapper);
  const swapFactoryHasUpdated = () =>
    contractIsUpdated(contracts, netId, UniswapSwapperFactoryId, UniswapSwapperFactory);

  if (!uniswapAddress) {
    console.log("--- deploying uniswap ---");
    const uniswapExchange = await new web3One.eth.Contract(UniswapExchangeAbi, {
      data: UNISWAP_EXCHANGE_BYTECODE
    })
      .deploy({arguments: []})
      .send({from: deployerAddress, gas: 6000000});
    const uniswapFactory = await new web3One.eth.Contract(UniswapFactoryAbi, {
      data: UNISWAP_FACTORY_BYTECODE
    })
      .deploy({arguments: []})
      .send({from: deployerAddress, gas: 6000000});
    // Initialize uniswap
    await uniswapFactory.methods.initializeFactory(uniswapExchange.options.address);

    uniswapAddress = await uniswapFactory.options.address;
    console.log("UNISWAP ADDRRESS", uniswapAddress);
    contractMetadata = setMetadata(contractMetadata, netId, uniswapId, {address: uniswapAddress});
  }
  if (swapTemplateHasUpdated() && swapFactoryHasUpdated()) {
    console.log("|============ deploying UniswapSwapper and UniswapSwapperFactory ==============|");
    await deployer.deploy(UniswapSwapper, {
      from: deployerAddress
    });
    await deployer.deploy(UniswapSwapperFactory, UniswapSwapper.address, uniswapAddress, {
      from: deployerAddress
    });

    // Update contracts
    contractMetadata = setMetadata(contractMetadata, netId, UniswapSwapperId, UniswapSwapper);
    contractMetadata = setMetadata(contractMetadata, netId, UniswapSwapperFactoryId, UniswapSwapperFactory);
  } else if (swapTemplateHasUpdated() && !swapFactoryHasUpdated()) {
    console.log(
      "|============ swapTemplate changed: deploying new SwapTemplate and updating swapFactory ==============|"
    );
    const swapFactoryAddress = _.get(contracts, `address.${netId}.${UniswapSwapperFactoryId}`);
    await deployer.deploy(UniswapSwapper, {
      from: deployerAddress
    });
    const swapFactoryInstance = await UniswapSwapperFactory.at(swapFactoryAddress);
    await swapFactoryInstance.setLibraryAddress(UniswapSwapper.address);

    // Update contracts
    contractMetadata = setMetadata(contractMetadata, netId, UniswapSwapperId, UniswapSwapper);
  } else {
    console.log(
      "|============ SwapAndDeposit and SwapAndFactory: no changes to deploy ==============|"
    );
  }

  writeMetadataTemp(contractMetadata);
};

module.exports = async (deployer, network, accounts) => {
  if (network.includes("coverage") || network.includes("test")) {
    return;
  }
  try {
    await migration(deployer, network, accounts);
  } catch (err) {
    // Prettier error output
    console.log(err);
    throw err;
  }
};
