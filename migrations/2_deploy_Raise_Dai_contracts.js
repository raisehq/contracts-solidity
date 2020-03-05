const merge = require("lodash/merge");
const RaiseFakeToken = artifacts.require("RaiseFake");
const RaiseToken = artifacts.require("RaiseTokenContract");
const DAIFake = artifacts.require("DAIFake");
const MockERC20 = artifacts.require("MockERC20");
const devAccounts = require("../int.accounts.json");
const {
  getContracts,
  contractIsDeployed,
  mintTokens,
  setMetadata,
  metadataFactory,
  writeMetadataTemp,
  PRIOR_METADATA,
  MCD_DAI_ABI
} = require("../scripts/helpers");
const USDT_ABI = require("../abis/USDT-abi.json");
const USDC_ABI = require("../abis/USDC-abi.json");
const {writeFileSync} = require("fs");

const TOKENS_PER_ACCOUNT = web3.utils.toWei("10000000", "ether"); // 10 million tokens each user

const DAI_CONTRACT_ID = "DAI";
const RAISE_CONTRACT_ID = "RaiseToken";
const USDT_CONTRACT_ID = "USDT";
const USDC_CONTRACT_ID = "USDC";

const migrationKovan = async (deployer, network, accounts) => {
  try {
    let contractMetadata = metadataFactory();
    const IntAccounts = [...new Set([...accounts, ...devAccounts])]; // unique accounts not repeated
    const deployerAddress = accounts[0];
    const netId = await web3.eth.net.getId();
    let contracts = await getContracts();

    const daiDeployed = () => contractIsDeployed(contracts, netId, DAI_CONTRACT_ID);
    const raiseDeployed = () => contractIsDeployed(contracts, netId, RAISE_CONTRACT_ID);
    const usdcDeployed = () => contractIsDeployed(contracts, netId, USDC_CONTRACT_ID);
    const usdtDeployed = () => contractIsDeployed(contracts, netId, USDT_CONTRACT_ID);

    if (!raiseDeployed()) {
      console.log("Deploying RAISE Fake token.");
      const raiseFakeInstance = await deployer.deploy(RaiseFakeToken, {
        from: deployerAddress,
        gas: 8000000
      });
      console.log("raise", raiseFakeInstance.address);
      console.log("Sending RAISE fake tokens to", IntAccounts.length, "accounts");
      await mintTokens(raiseFakeInstance, IntAccounts, TOKENS_PER_ACCOUNT, deployerAddress);
      contractMetadata = setMetadata(contractMetadata, netId, RAISE_CONTRACT_ID, RaiseFakeToken);
    }

    if (!usdcDeployed()) {
      console.log("Deploying USDC Fake token.");
      const usdcInstance = await deployer.deploy(MockERC20, "USDC", "USDC", {
        from: deployerAddress,
        gas: 8000000
      });
      console.log("USDC", usdcInstance.address);
      console.log("Sending USDC fake tokens to", IntAccounts.length, "accounts");
      await mintTokens(usdcInstance, IntAccounts, TOKENS_PER_ACCOUNT, deployerAddress);
      contractMetadata = setMetadata(contractMetadata, netId, USDC_CONTRACT_ID, {
        address: usdcInstance.address,
        abi: MockERC20.abi,
        bytecode: MockERC20.bytecode
      });
    }

    if (!usdtDeployed()) {
      console.log("Deploying USDT Fake token.");
      const usdtInstance = await deployer.deploy(MockERC20, "USDT", "USDT", {
        from: deployerAddress,
        gas: 8000000
      });
      console.log("USDC", usdtInstance.address);
      console.log("Sending USDC fake tokens to", IntAccounts.length, "accounts");
      await mintTokens(usdtInstance, IntAccounts, TOKENS_PER_ACCOUNT, deployerAddress);
      contractMetadata = setMetadata(contractMetadata, netId, USDT_CONTRACT_ID, {
        address: usdtInstance.address,
        abi: MockERC20.abi,
        bytecode: MockERC20.bytecode
      });
    }

    if (!daiDeployed()) {
      console.log("Deploying DAI Fake token.");
      const daiFakeInstance = await deployer.deploy(DAIFake, {
        from: deployerAddress,
        gas: 8000000
      });

      console.log("Sending DAI fake tokens to", IntAccounts.length, "accounts");
      await mintTokens(daiFakeInstance, IntAccounts, TOKENS_PER_ACCOUNT, deployerAddress);
      contractMetadata = setMetadata(contractMetadata, netId, DAI_CONTRACT_ID, DAIFake);
    }

    console.log(contractMetadata.address);
    console.log("Writting artifacts...");

    const metadata = merge(contracts, contractMetadata);
    writeMetadataTemp(metadata);
  } catch (err) {
    throw err;
  }
};

const mainnetMigration = async (deployer, network, accounts) => {
  try {
    const contracts = await getContracts();
    const RAISE_ADDRESS = "0x10bA8C420e912bF07BEdaC03Aa6908720db04e0c"; // hardcoded address of raise token contract on mainnet,
    const DAI_ADDRESS = "0x6b175474e89094c44da98b954eedeac495271d0f"; // hardcoded addres of mc dai token contract on mainnet;
    const USDT_ADDRESS = "0xdac17f958d2ee523a2206206994597c13d831ec7";
    const USDC_ADDRESS = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";

    const newMetadata = {
      address: {
        "1": {
          [RAISE_CONTRACT_ID]: RAISE_ADDRESS,
          [DAI_CONTRACT_ID]: DAI_ADDRESS,
          [USDT_CONTRACT_ID]: USDT_ADDRESS,
          [USDC_CONTRACT_ID]: USDC_ADDRESS
        }
      },
      abi: {
        "1": {
          [RAISE_CONTRACT_ID]: RaiseToken.abi,
          [DAI_CONTRACT_ID]: MCD_DAI_ABI,
          [USDT_CONTRACT_ID]: USDT_ABI,
          [USDC_CONTRACT_ID]: USDC_ABI
        }
      }
    };

    const metadata = merge(contracts, newMetadata);
    writeMetadataTemp(metadata);
  } catch (error) {
    throw error;
  }
};

module.exports = async (deployer, network, accounts) => {
  // Skip migrations for coverage, due is very slow and error prone, not needed due tests also do deployments
  if (network.includes("coverage") || network.includes("test")) {
    return;
  }
  console.log(`Deploying in network: ${network}`);

  const currentContracts = await getContracts();

  try {
    // Copying prior contracts to last.contracts.json to do JSON diff at the end of migrations
    console.log("Writting prior metadata to ", `${process.env.PWD}/${PRIOR_METADATA}`);
    writeFileSync(
      `${process.env.PWD}/${PRIOR_METADATA}`,
      JSON.stringify(currentContracts, null, 2)
    );
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
