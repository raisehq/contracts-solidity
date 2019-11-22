const _ = require("lodash");
const HeroToken = artifacts.require("HeroOrigenERC20Token");
const DAI = artifacts.require("DAIFake");
const devAccounts = require("../int.accounts.json");
const DAIabi = require("../abis/DAI-abi.json");
const Heroabi = require("../abis/Hero-abi.json");
const { getContracts, contractIsUpdated } = require("../scripts/helpers");
const { writeFileSync } = require("fs");

const getContractTokens = async (contracts, deployerAddress) => {
  try {
    const netId = await web3.eth.net.getId();
    // Check if the contract.json has the address of HeroToken and DAI
    const heroTokenAddress = _.get(contracts, `address.${netId}.HeroToken`);
    const daiAddress = _.get(contracts, `address.${netId}.DAI`);
    if (heroTokenAddress && daiAddress) {
      // Check if deployer is owner of already deployed contracts.
      const HeroInstance = await HeroToken.at(heroTokenAddress);
      const owner = await HeroInstance.owner();

      // This will happen only when deployed bia gitlab ci
      if (owner === deployerAddress) {
        return {
          heroTokenAddress,
          daiAddress
        };
      }
    }
    return {};
  } catch (error) {
    console.log("Cannot create instance of Contract HeroToken, no code for address: ", error);
    return {};
  }
};

const migrationKovan = async (deployer, network, accounts) => {
  try {
    const deployerAddress = accounts[0];
    const netId = await web3.eth.net.getId();
    let HeroTokenAddress = "";
    let DAIAddress = "";
    let contracts = await getContracts();

    const daiHasBeenUpdated = () => contractIsUpdated(contracts, netId, "DAI", DAI);
    const herotokenHasBeenUpdated = () =>
      contractIsUpdated(contracts, netId, "HeroToken", HeroToken);

    const { heroTokenAddress, daiAddress } = await getContractTokens(contracts, deployerAddress);

    HeroTokenAddress = heroTokenAddress;
    DAIAddress = daiAddress;

    if (!heroTokenAddress || !daiAddress) {
      // deploy in kovan only if they are not deployed already
      await deployer.deploy(HeroToken, {
        from: deployerAddress,
        overwrite: false
      });
      await deployer.deploy(DAI, {
        from: deployerAddress,
        overwrite: false
      });

      HeroTokenAddress = HeroToken.address;
      DAIAddress = DAI.address;
    }
    if (herotokenHasBeenUpdated() || daiHasBeenUpdated()) {
      const currentNetId = await web3.eth.net.getId();
      const IntAccounts = [...new Set([...accounts, ...devAccounts])]; //unique accounts not repeated
      const tokens = web3.utils.toWei("10000000", "ether"); // 10 million tokens each user

      if (herotokenHasBeenUpdated()) {
        const heroDeployed = await HeroToken.at(HeroTokenAddress);
        for (let i = 0; i < IntAccounts.length; i++) {
          await heroDeployed.mint(IntAccounts[i], tokens, {
            from: deployerAddress,
            gas: 800000
          });
          console.log("- Sent!");
        }
      }
      if (daiHasBeenUpdated()) {
        const daiDeployed = await DAI.at(DAIAddress);
        for (let i = 0; i < IntAccounts.length; i++) {
          await daiDeployed.mint(IntAccounts[i], tokens, {
            from: deployerAddress,
            gas: 800000
          });
          console.log("- Sent!");
        }
      }

      console.log("Writting Raise artifacts...");

      const abis = {
        HeroToken: HeroToken.abi,
        DAI: DAI.abi
      };

      const data = {
        address: {
          [currentNetId]: {
            HeroToken: HeroTokenAddress,
            DAI: DAIAddress
          }
        },
        bytecode: {
          HeroToken: HeroToken.bytecode,
          DAI: DAI.bytecode
        }
      };

      const newContracts = _.merge(contracts, data);
      Object.keys(abis).forEach(key => {
        newContracts["abi"][key] = abis[key];
      });

      await writeFileSync(`./contracts.json`, JSON.stringify(newContracts, null, 2));
    }
  } catch (err) {
    throw err;
  }
};

const migrationCypress = async (deployer, network, accounts) => {
  try {
    const deployerAddress = accounts[0];
    const netId = await web3.eth.net.getId();

    await deployer.deploy(HeroToken, {
      from: deployerAddress
    });
    await deployer.deploy(DAI, {
      from: deployerAddress
    });

    const HeroTokenAddress = HeroToken.address;
    const DAIAddress = DAI.address;

    const IntAccounts = [...new Set([...accounts, ...devAccounts])]; //unique accounts not repeated
    const tokens = web3.utils.toWei("10000000", "ether"); // 10 million tokens each user

    const heroDeployed = await HeroToken.at(HeroTokenAddress);
    const daiDeployed = await DAI.at(DAIAddress);
    for (let i = 0; i < IntAccounts.length; i++) {
      await heroDeployed.mint(IntAccounts[i], tokens, {
        from: deployerAddress,
        gas: 800000
      });
      await daiDeployed.mint(IntAccounts[i], tokens, {
        from: deployerAddress,
        gas: 800000
      });

      console.log(` Sent Herotokens and DAI to ${IntAccounts[i]}`);
    }

    console.log("Writting Raise artifacts...");

    const data = {
      address: {
        [netId]: {
          HeroToken: HeroTokenAddress,
          DAI: DAIAddress
        }
      },
      bytecode: {
        HeroToken: HeroToken.bytecode,
        DAI: DAI.bytecode
      },
      abi: {
        HeroToken: HeroToken.abi,
        DAI: DAI.abi
      }
    };
    await writeFileSync(`./contracts.json`, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(" ERROR 2_deploy_HeroToken_Dai_Contracts");
    throw err;
  }
};

const mainnetMigration = async (deployer, network, accounts) => {
  try {
    const contracts = await getContracts();
    const heroTokenAddress = "0x02585e4a14da274d02df09b222d4606b10a4e940"; // hardcoded address of hero token contract on mainnet,
    const daiAddress = "0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359"; // hardcoded addres of dai token contract on mainnet;

    const data = {
      address: {
        "1": {
          HeroToken: heroTokenAddress,
          DAI: daiAddress
        }
      }
    };
    const abis = {
      HeroToken: HeroToken.abi,
      DAI: DAI.abi
    };

    const newContracts = _.merge(contracts, data);
    Object.keys(abis).forEach(key => {
      newContracts["abi"][key] = abis[key];
    });

    await writeFileSync(`./contracts.json`, JSON.stringify(newContracts, null, 2));
  } catch (error) {
    throw error;
  }
};

module.exports = async (deployer, network, accounts) => {
  console.log(`Deploying in network:: ${network}`);
  try {
    if (network === "cypress" || network === "cypress-fork")
      return await migrationCypress(deployer, network, accounts);
    if (network !== "mainnet") {
      await migrationKovan(deployer, network, accounts);
    } else {
      deployer.then(async () => {
        await mainnetMigration(deployer, network, accounts);
      });
    }
  } catch (err) {
    // Prettier error output
    console.error(err);
    throw err;
  }
};
