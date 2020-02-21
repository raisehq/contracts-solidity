const _ = require("lodash");
const SwapAndDeposit = artifacts.require("SwapAndDeposit");
const SwapAndDepositFactory = artifacts.require("SwapAndDepositFactory");
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

const SwapAndDepositId = "SwapAndDeposit";
const SwapAndDepositFactoryId = "SwapAndDepositFactory";

const migration = async (deployer, network, accounts) => {
  let contractMetadata = metadataFactory();
  const web3One = getWeb3(web3);
  const contracts = await getContracts();
  const netId = await web3One.eth.net.getId();
  const deployerAddress = accounts[0];

  let uniswapAddress = UNISWAP_FACTORY_ADDRESS[netId] || null;
  const authAddress = _.get(contracts, `address.${netId}.Auth`);

  const swapTemplateHasUpdated = () =>
    contractIsUpdated(contracts, netId, SwapAndDepositId, SwapAndDeposit);
  const swapFactoryHasUpdated = () =>
    contractIsUpdated(contracts, netId, SwapAndDepositFactoryId, SwapAndDepositFactory);

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
  }
  if (swapTemplateHasUpdated() && swapFactoryHasUpdated()) {
    console.log("|============ deploying SwapTemplate and SwapFactory ==============|");
    await deployer.deploy(SwapAndDeposit, {
      from: deployerAddress
    });
    await deployer.deploy(
      SwapAndDepositFactory,
      SwapAndDeposit.address,
      authAddress,
      uniswapAddress,
      {
        from: deployerAddress
      }
    );

    // Update contracts
    contractMetadata = setMetadata(contractMetadata, netId, SwapAndDepositId, SwapAndDeposit);
    contractMetadata = setMetadata(
      contractMetadata,
      netId,
      SwapAndDepositFactoryId,
      SwapAndDepositFactory
    );
  } else if (swapTemplateHasUpdated() && !swapFactoryHasUpdated()) {
    console.log(
      "|============ swapTemplate changed: deploying new SwapTemplate and updating swapFactory ==============|"
    );
    const swapFactoryAddress = _.get(contracts, `address.${netId}.${SwapAndDepositFactoryId}`);
    await deployer.deploy(SwapAndDeposit, {
      from: deployerAddress
    });
    const swapFactoryInstance = SwapAndDepositFactory.at(swapFactoryAddress);
    await swapFactoryInstance.setLibraryAddress(SwapAndDeposit.address);

    // Update contracts
    contractMetadata = setMetadata(contractMetadata, netId, SwapAndDepositId, SwapAndDeposit);
  } else {
    console.log(
      "|============ SwapAndDeposit and SwapAndFactory: no changes to deploy ==============|"
    );
  }
  const metadata = _.merge(contracts, contractMetadata);
  writeMetadataTemp(metadata);
};

module.exports = async (deployer, network, accounts) => {
  if (network.includes("coverage")) {
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
