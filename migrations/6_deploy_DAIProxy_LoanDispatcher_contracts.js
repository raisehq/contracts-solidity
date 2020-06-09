const _ = require("lodash");
const DAIProxy = artifacts.require("DAIProxy");
const LoanDispatcher = artifacts.require("LoanContractDispatcher");
const LoanContract = artifacts.require("LoanContract");
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
const DISPATCHER_ID = "LoanDispatcher";
const AUTH_ID = "Auth";
const SWAP_FACTORY_ID = "SwapAndDepositFactory";
const LOAN_ID = "LoanContract";
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
  const swapperFactoryAddress = _.get(contracts, `address.${netId}.${SWAPPER_FACTORY_ID}`);

  const erc20WrapperHasBeenUpdated = () =>
    contractIsUpdated(contracts, netId, ERC20_WRAPPER_ID, ERC20Wrapper);
  const daiproxyHasBeenUpdated = () => contractIsUpdated(contracts, netId, DAI_PROXY_ID, DAIProxy);
  const loandispatcherHasBeenUpdated = () =>
    contractIsUpdated(contracts, netId, DISPATCHER_ID, LoanDispatcher);

  // Only re-deploy erc20 wrapper if changed to save some gas
  if (erc20WrapperHasBeenUpdated()) {
    await deployer.deploy(ERC20Wrapper, {
      from: deployerAddress
    });

    // Link the contracts
    deployer.link(ERC20Wrapper, [DAIProxy, LoanContract, LoanDispatcher]);

    // Add ERC20Wrappper lib to metadata
    contractsMetadata = setMetadata(contractsMetadata, netId, ERC20_WRAPPER_ID, ERC20Wrapper);
  }

  if (
    erc20WrapperHasBeenUpdated() ||
    (daiproxyHasBeenUpdated() && loandispatcherHasBeenUpdated())
  ) {
    console.log("|============ deploying DAIProxy and LoanDispatcher ==============|");
    // Library linking, it works if library has not changed
    const erc20WrapperAddress = _.get(contractsMetadata, `address.${netId}.${ERC20_WRAPPER_ID}`);
    console.log("ERC20 wrapper", erc20WrapperAddress);
    await DAIProxy.link(ERC20_WRAPPER_ID, erc20WrapperAddress);
    await LoanDispatcher.link(ERC20_WRAPPER_ID, erc20WrapperAddress);

    console.log("props", authAddress, swapperFactoryAddress);

    await deployer.deploy(DAIProxy, authAddress, swapperFactoryAddress, {
      from: deployerAddress
    });
    console.log("uniswap address=========> ", swapFactoryAddress);
    await deployer.deploy(LoanDispatcher, authAddress, DAIProxy.address, swapFactoryAddress, {
      from: deployerAddress
    });

    // Update contracts
    contractsMetadata = setMetadata(contractsMetadata, netId, DAI_PROXY_ID, DAIProxy);
    contractsMetadata = setMetadata(contractsMetadata, netId, DISPATCHER_ID, LoanDispatcher);
    contractsMetadata = setMetadata(contractsMetadata, netId, LOAN_ID, {
      abi: LoanContract.abi,
      bytecode: LoanContract.bytecode
    });
  } else if (daiproxyHasBeenUpdated() && !loandispatcherHasBeenUpdated()) {
    console.log(
      "|============ Deploy DAIProxy and setting new DAIPROXY at current LoanDispatcher ==============|"
    );
    // Library linking, it works if library has not changed
    const erc20WrapperAddress = _.get(contractsMetadata, `address.${netId}.${ERC20_WRAPPER_ID}`);
    await DAIProxy.link(ERC20_WRAPPER_ID, erc20WrapperAddress);

    const dispatcherAddress = _.get(contracts, `address.${netId}.${DISPATCHER_ID}`);
    const daiProxy = await deployer.deploy(DAIProxy, authAddress, swapperFactoryAddress, {
      from: deployerAddress
    });
    const dispatcherDeployed = await LoanDispatcher.at(dispatcherAddress);
    dispatcherDeployed.setDaiProxyAddress(daiProxy.address, {from: admin});
    // Update contracts
    contractsMetadata = setMetadata(contractsMetadata, netId, DAI_PROXY_ID, DAIProxy);
  } else if (loandispatcherHasBeenUpdated()) {
    console.log("|============ Deploy Loan Dispatcher but keep DAI Proxy ==============|");
    const DAIProxyAddress = _.get(contracts, `address.${netId}.DAIProxy`);

    // Library linking, it works if library has not changed
    const erc20WrapperAddress = _.get(contractsMetadata, `address.${netId}.${ERC20_WRAPPER_ID}`);
    await LoanDispatcher.link(ERC20_WRAPPER_ID, erc20WrapperAddress);

    await deployer.deploy(LoanDispatcher, authAddress, DAIProxyAddress, swapFactoryAddress, {
      from: deployerAddress
    });
    // Update contracts
    contractsMetadata = setMetadata(contractsMetadata, netId, DISPATCHER_ID, LoanDispatcher);
    contractsMetadata = setMetadata(contractsMetadata, netId, LOAN_ID, {
      abi: LoanContract.abi,
      bytecode: LoanContract.bytecode
    });
  } else {
    console.log("|============ DAIProxy && LoanDispatcher: no changes to deploy ==============|");
  }

  if (loandispatcherHasBeenUpdated() || daiproxyHasBeenUpdated()) {
    if (loandispatcherHasBeenUpdated()) {
      // set administrator
      const dispatcherDeployed = await LoanDispatcher.deployed();

      await dispatcherDeployed.setAdministrator(admin, {from: deployerAddress});
      network === "cypress" && (await dispatcherDeployed.setMinTermLength(300, {from: admin}));

      await dispatcherDeployed.addTokenToAcceptedList(contracts.address[netId].DAI, {from: admin});
      await dispatcherDeployed.addTokenToAcceptedList(contracts.address[netId].USDC, {from: admin});
      await dispatcherDeployed.addTokenToAcceptedList(contracts.address[netId].USDT, {from: admin});
    }
  }
  // const metadata = _.merge(contracts, contractsMetadata);
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
