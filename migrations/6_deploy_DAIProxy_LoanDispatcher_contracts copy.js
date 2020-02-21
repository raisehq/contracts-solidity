const _ = require("lodash");
const DAIProxy = artifacts.require("DAIProxy");
const LoanDispatcher = artifacts.require("LoanContractDispatcher");
const LoanContract = artifacts.require("LoanContract");
const {writeFileSync} = require("fs");
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

const DAI_ID = "DAI";
const DAI_PROXY_ID = "DAIProxy";
const DISPATCHER_ID = "LoanDispatcher";
const AUTH_ID = "Auth";
const SWAP_FACTORY_ID = "SwapAndDepositFactory";
const LOAN_ID = "LoanContract";

const migration = async (deployer, network, accounts) => {
  let contractsMetadata = metadataFactory();
  const web3One = getWeb3(web3);
  const contracts = await getContracts();
  const netId = await web3One.eth.net.getId();
  const deployerAddress = accounts[0];
  const admin = network.includes("mainnet") ? process.env.ADMIN_ADDRESS : accounts[1];

  const daiAddress = _.get(contracts, `address.${netId}.${DAI_ID}`);
  const authAddress = _.get(contracts, `address.${netId}.${AUTH_ID}`);
  const swapFactoryAddress = _.get(contracts, `address.${netId}.${SWAP_FACTORY_ID}`);

  const daiproxyHasBeenUpdated = () => contractIsUpdated(contracts, netId, DAI_PROXY_ID, DAIProxy);
  const loandispatcherHasBeenUpdated = () =>
    contractIsUpdated(contracts, netId, DISPATCHER_ID, LoanDispatcher);

  if (daiproxyHasBeenUpdated()) {
    console.log("|============ deploying DAIProxy and LoanDispatcher ==============|");
    const DAIProxyGas = await getDeployGas(web3, DAIProxy, [authAddress, daiAddress]);
    await deployer.deploy(DAIProxy, authAddress, daiAddress, {
      from: deployerAddress,
      gas: DAIProxyGas
    });
    const LoanGas = await getDeployGas(web3, LoanDispatcher, [
      authAddress,
      daiAddress,
      DAIProxy.address,
      swapFactoryAddress
    ]);
    await deployer.deploy(
      LoanDispatcher,
      authAddress,
      daiAddress,
      DAIProxy.address,
      swapFactoryAddress,
      {
        from: deployerAddress,
        gas: LoanGas
      }
    );

    // Update contracts
    contractsMetadata = setMetadata(contractsMetadata, netId, DAI_PROXY_ID, DAIProxy);
    contractsMetadata = setMetadata(contractsMetadata, netId, DISPATCHER_ID, LoanDispatcher);
    contractsMetadata = setMetadata(contractsMetadata, netId, LOAN_ID, {
      abi: LoanContract.abi,
      bytecode: LoanContract.bytecode
    });
  } else if (loandispatcherHasBeenUpdated()) {
    console.log("|============ DAIProxy: no changes to deploy ==============|");
    const DAIProxyAddress = _.get(contracts, `address.${netId}.DAIProxy`);
    const LoanGas = await getDeployGas(web3, LoanDispatcher, [
      authAddress,
      daiAddress,
      DAIProxy.address,
      swapFactoryAddress
    ]);
    await deployer.deploy(
      LoanDispatcher,
      authAddress,
      daiAddress,
      DAIProxyAddress,
      swapFactoryAddress,
      {
        from: deployerAddress,
        gas: LoanGas
      }
    );
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
      const setAdminGas = await getMethodGas(
        web3,
        LoanDispatcher,
        dispatcherDeployed.address,
        "setAdministrator",
        [admin],
        {from: deployerAddress}
      );
      await dispatcherDeployed.setAdministrator(admin, {from: deployerAddress, gas: setAdminGas});
      network === "cypress" && (await dispatcherDeployed.setMinTermLength(300, {from: admin}));
    }
  }
  const metadata = _.merge(contracts, contractsMetadata);
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
