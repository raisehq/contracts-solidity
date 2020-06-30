const _ = require("lodash");
const DAIProxy = artifacts.require("DAIProxy");
const LoanInstalmentsDispatcher = artifacts.require("LoanInstalmentsDispatcher");
const LoanInstalments = artifacts.require("LoanInstalments");
const {writeFileSync} = require("fs");

const ERC20Wrapper = artifacts.require("ERC20Wrapper");
const {
  getContracts,
  contractIsUpdated,
  getDeployGas,
  getMethodGas,
  getWeb3,
  metadataFactory,
  setMetadata,
  writeMetadataTemp
} = require("../scripts/helpers");
const {BN} = require("web3-utils");

const DAI_PROXY_ID = "DAIProxy";
const AUTH_ID = "Auth";
const SWAP_FACTORY_ID = "SwapAndDepositFactory";
const INSTALMENTS_ID = "LoanInstalments";
const INSTALMENTS_DISPATCHER_ID = "LoanInstalmentsDispatcher";
const ERC20_WRAPPER_ID = "ERC20Wrapper";
const SWAPPER_FACTORY_ID = "UniswapSwapperFactory";

const migration = async (deployer, network, accounts) => {
  const web3One = getWeb3(web3);
  const contracts = await getContracts();
  let contractsMetadata = _.cloneDeep(contracts);
  const netId = await web3One.eth.net.getId();
  const deployerAddress = accounts[0];
  const admin = network.includes("mainnet") ? process.env.ADMIN_ADDRESS : accounts[1];

  const authAddress = _.get(contracts, `address.${netId}.${AUTH_ID}`);
  const swapFactoryAddress = _.get(contracts, `address.${netId}.${SWAP_FACTORY_ID}`);
  const tokenProxyAddress = _.get(contractsMetadata, `address.${netId}.${DAI_PROXY_ID}`);

  const loanHasBeenUpdated = () =>
    contractIsUpdated(contracts, netId, INSTALMENTS_ID, LoanInstalments);
  const loandispatcherHasBeenUpdated = () =>
    contractIsUpdated(contracts, netId, INSTALMENTS_DISPATCHER_ID, LoanInstalmentsDispatcher);

  if (loanHasBeenUpdated()) {
    console.log("|============ deploying LoanInstalments Template ==============|");
    // Library linking, it works if library has not changed
    const erc20WrapperAddress = _.get(contractsMetadata, `address.${netId}.${ERC20_WRAPPER_ID}`);
    await LoanInstalments.link(ERC20_WRAPPER_ID, erc20WrapperAddress);

    await deployer.deploy(LoanInstalments, {from: deployerAddress});
    contractsMetadata = setMetadata(contractsMetadata, netId, INSTALMENTS_ID, LoanInstalments);
  }
  if (loandispatcherHasBeenUpdated()) {
    console.log("|============ deploying LoanInstalmentsDispatcher ==============|");
    const loanInstalmentAddress = _.get(contractsMetadata, `address.${netId}.${INSTALMENTS_ID}`);
    if (!loanInstalmentAddress) {
      throw Error("instalment template not found");
    }
    await deployer.deploy(
      LoanInstalmentsDispatcher,
      authAddress,
      tokenProxyAddress,
      swapFactoryAddress,
      loanInstalmentAddress,
      {
        from: deployerAddress
      }
    );

    // set administrator
    const dispatcherDeployed = await LoanInstalmentsDispatcher.deployed();

    await dispatcherDeployed.setAdministrator(admin, {from: deployerAddress});
    network === "cypress" && (await dispatcherDeployed.setMinTermLength(300, {from: admin}));

    await dispatcherDeployed.addTokenToAcceptedList(contracts.address[netId].DAI, {from: admin});
    await dispatcherDeployed.addTokenToAcceptedList(contracts.address[netId].USDC, {from: admin});
    await dispatcherDeployed.addTokenToAcceptedList(contracts.address[netId].USDT, {from: admin});

    // Update contracts
    contractsMetadata = setMetadata(
      contractsMetadata,
      netId,
      INSTALMENTS_DISPATCHER_ID,
      LoanInstalmentsDispatcher
    );
  } else if (loanHasBeenUpdated() && !loandispatcherHasBeenUpdated()) {
    const loanInstalmentAddress = _.get(contractsMetadata, `address.${netId}.${INSTALMENTS_ID}`);
    const loanDispatcher = _.get(
      contractsMetadata,
      `address.${netId}.${INSTALMENTS_DISPATCHER_ID}`
    );

    const instance = await LoanInstalmentsDispatcher.at(loanDispatcher);
    await instance.setLoanTemplate(loanInstalmentAddress, {from: admin});
  } else {
    console.log("|============ LoanInstalmentsDispatcher: no changes to deploy ==============|");
  }

  const loanDisAddress = _.get(contractsMetadata, `address.${netId}.${INSTALMENTS_DISPATCHER_ID}`);
  const currentDispatcher = await LoanInstalmentsDispatcher.at(loanDisAddress);
  const currentTokenProxyAddress = await currentDispatcher.DAIProxyAddress();

  if (
    tokenProxyAddress &&
    currentTokenProxyAddress !== tokenProxyAddress &&
    !loandispatcherHasBeenUpdated()
  ) {
    console.log("|============ LoanInstalmentsDispatcher: update token proxy ==============|");
    console.log(`old proxy: ${currentTolenProxyAddress}`);
    console.log(`new proxy: ${tokenProxyAddress}`);
    await currentDispatcher.setDaiProxyAddress(tokenProxyAddress, {from: admin});
  }
  // Finish migration script, write results to metadata
  writeMetadataTemp(contractsMetadata);
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
