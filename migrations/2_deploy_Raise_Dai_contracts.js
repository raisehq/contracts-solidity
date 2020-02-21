const merge = require("lodash/merge");
const RaiseFakeToken = artifacts.require("RaiseFake");
const RaiseToken = artifacts.require("RaiseTokenContract");
const DAIFake = artifacts.require("DAIFake");
const devAccounts = require("../int.accounts.json");

const {getContracts, contractIsDeployed, mintTokens, setMetadata} = require("../scripts/helpers");
const {writeFileSync} = require("fs");

const TOKENS_PER_ACCOUNT = web3.utils.toWei("10000000", "ether"); // 10 million tokens each user

const RAISE_CONTRACT_ID = "RaiseToken";
const DAI_CONTRACT_ID = "DAI";

const migrationKovan = async (deployer, network, accounts) => {
  try {
    let contractMetadata = {abi: {}, address: {}, bytecode: {}};
    const IntAccounts = [...new Set([...accounts, ...devAccounts])]; // unique accounts not repeated
    const deployerAddress = accounts[0];
    const netId = await web3.eth.net.getId();
    let contracts = await getContracts();

    const daiNotDeployed = () => contractIsDeployed(contracts, netId, DAI_CONTRACT_ID);
    const raiseNotDeployed = () => contractIsDeployed(contracts, netId, RAISE_CONTRACT_ID);

    if (raiseNotDeployed()) {
      console.log("Deploying RAISE Fake token.");
      const raiseFakeInstance = await deployer.deploy(RaiseFakeToken, {
        from: deployerAddress,
        gas: 8000000
      });

      console.log("Sending RAISE fake tokens to", IntAccounts.length, "accounts");
      await mintTokens(raiseFakeInstance, IntAccounts, TOKENS_PER_ACCOUNT, deployerAddress);
      contractMetadata = setMetadata(
        contractMetadata,
        RAISE_CONTRACT_ID,
        raiseFakeInstance.address,
        RaiseFakeToken.abi,
        RaiseFakeToken.bytecode
      );
    }
    if (daiNotDeployed()) {
      console.log("Deploying DAI Fake token.");
      const daiFakeInstance = await deployer.deploy(DAIFake, {
        from: deployerAddress,
        gas: 8000000
      });

      console.log("Sending DAI fake tokens to", IntAccounts.length, "accounts");
      await mintTokens(daiFakeInstance, IntAccounts, TOKENS_PER_ACCOUNT, deployerAddress);
      contractMetadata = setMetadata(
        contractMetadata,
        DAI_CONTRACT_ID,
        daiFakeInstance.address,
        DAIFake.abi,
        DAIFake.bytecode
      );
    }

    console.log("Writting artifacts...");

    const newContracts = _.merge(contracts, contractMetadata);

    await writeFileSync(`./contracts.json`, JSON.stringify(newContracts, null, 2));
  } catch (err) {
    throw err;
  }
};

const mainnetMigration = async (deployer, network, accounts) => {
  try {
    const contracts = await getContracts();
    const raiseTokenAddress = "0x10bA8C420e912bF07BEdaC03Aa6908720db04e0c"; // hardcoded address of raise token contract on mainnet,
    const daiAddress = "0x6b175474e89094c44da98b954eedeac495271d0f"; // hardcoded addres of mc dai token contract on mainnet;

    const data = {
      address: {
        "1": {
          RaiseToken: raiseTokenAddress,
          DAI: daiAddress
        }
      }
    };
    const abis = {
      RaiseToken: RaiseToken.abi,
      DAI: DAI.abi
    };

    const newContracts = merge(contracts, data);
    Object.keys(abis).forEach(key => {
      newContracts["abi"][key] = abis[key];
    });

    await writeFileSync(`./contracts.json`, JSON.stringify(newContracts, null, 2));
  } catch (error) {
    throw error;
  }
};

module.exports = async (deployer, network, accounts) => {
  // Skip migrations for coverage, due is very slow and error prone, not needed due tests also do deployments
  if (network.includes("coverage")) {
    return;
  }
  console.log(`Deploying in network: ${network}`);

  const currentContracts = await getContracts();

  try {
    // Copying prior contracts to old.contracts.json to do JSON diff at the end of migrations
    await writeFileSync(`./old.contracts.json`, JSON.stringify(currentContracts, null, 2));

    // Start migrations
    if (network.includes("mainnet")) {
      await mainnetMigration(deployer, network, accounts);
    } else {
      await migrationKovan(deployer, network, accounts);
    }
  } catch (err) {
    // Prettier error output
    console.error(err);
    throw err;
  }
};
