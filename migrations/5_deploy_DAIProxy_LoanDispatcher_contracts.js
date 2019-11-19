const _ = require("lodash");
const DAIProxy = artifacts.require("DAIProxy");
const LoanDispatcher = artifacts.require("LoanContractDispatcher");
const LoanContract = artifacts.require("LoanContract");
const { writeFileSync } = require("fs");
const {
  getContracts,
  contractIsUpdated,
  getDeployGas,
  getMethodGas,
  getWeb3
} = require("../scripts/helpers");
const { BN } = require("web3-utils");

const migrationInt = async (deployer, network, accounts) => {
  const web3One = getWeb3(web3);
  const contracts = await getContracts();
  const netId = await web3One.eth.net.getId();
  const deployerAddress = accounts[0];
  const admin = network === "mainnet" ? process.env.ADMIN_ADDRESS : accounts[1];

  const daiAddress = _.get(contracts, `address.${netId}.DAI`);
  const authAddress = _.get(contracts, `address.${netId}.Auth`);

  const daiproxyHasBeenUpdated = () => contractIsUpdated(contracts, netId, "DAIProxy", DAIProxy);
  const loandispatcherHasBeenUpdated = () =>
    contractIsUpdated(contracts, netId, "LoanDispatcher", LoanDispatcher);

  let newContracts = _.cloneDeep(contracts);

  if (daiproxyHasBeenUpdated()) {
    console.log("|============ deploying DAIProxy and LoanDispatcher ==============|");
    const DAIProxyGas = await getDeployGas(web3, DAIProxy, [authAddress, daiAddress]);
    await deployer.deploy(DAIProxy, authAddress, daiAddress, {
      from: deployerAddress,
      gas: DAIProxyGas
    });
    console.log("loan params", [authAddress, DAIProxy.address]);
    const LoanGas = await getDeployGas(web3, LoanDispatcher, [
      authAddress,
      daiAddress,
      DAIProxy.address
    ]);
    console.log("loan gas", LoanGas);
    await deployer.deploy(LoanDispatcher, authAddress, daiAddress, DAIProxy.address, {
      from: deployerAddress,
      gas: LoanGas
    });

    // Update contracts
    newContracts = _.merge(newContracts, {
      address: {
        [netId]: {
          DAIProxy: DAIProxy.address,
          LoanDispatcher: LoanDispatcher.address
        }
      },
      bytecode: {
        DAIProxy: DAIProxy.bytecode,
        LoanDispatcher: LoanDispatcher.bytecode
      }
    });
    // Merge ABIS
    let abis = {
      DAIProxy: DAIProxy.abi,
      LoanDispatcher: LoanDispatcher.abi,
      LoanContract: LoanContract.abi
    };
    Object.keys(abis).forEach(key => {
      newContracts["abi"][key] = abis[key];
    });
  } else if (loandispatcherHasBeenUpdated()) {
    console.log("|============ DAIProxy: no changes to deploy ==============|");
    const DAIProxyAddress = _.get(contracts, `address.${netId}.DAIProxy`);
    await deployer.deploy(LoanDispatcher, authAddress, daiAddress, DAIProxyAddress, {
      from: deployerAddress
    });
    // Update contracts
    newContracts = _.merge(newContracts, {
      address: {
        [netId]: {
          LoanDispatcher: LoanDispatcher.address
        }
      },
      bytecode: {
        LoanDispatcher: LoanDispatcher.bytecode
      }
    });

    // Merge ABIS
    let abis = {
      LoanDispatcher: LoanDispatcher.abi,
      LoanContract: LoanContract.abi
    };
    Object.keys(abis).forEach(key => {
      newContracts["abi"][key] = abis[key];
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
        { from: deployerAddress }
      );
      await dispatcherDeployed.setAdministrator(admin, { from: deployerAddress, gas: setAdminGas });
      network === "cypress" && (await dispatcherDeployed.setMinTermLength(300, { from: admin }));
    }
  }
  await writeFileSync("./contracts.json", JSON.stringify(newContracts));
};

module.exports = async (deployer, network, accounts) => {
  /* Truffle 4 support. Async/await works after a deployer then promise chain */
  deployer.then(async () => {
    try {
      await migrationInt(deployer, network, accounts);
    } catch (err) {
      // Prettier error output
      console.log(err);
      throw err;
    }
  });
};
