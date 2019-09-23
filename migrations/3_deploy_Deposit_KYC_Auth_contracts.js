const _ = require("lodash");
const Deposit = artifacts.require("DepositRegistry");
const KYC = artifacts.require("KYCRegistry");
const Auth = artifacts.require("Authorization");
const HeroToken = artifacts.require("HeroOrigenToken");
const devAccounts = require("../int.accounts.json");
const {writeFileSync} = require("fs");
const {getContracts, contractIsUpdated} = require("../scripts/helpers");
const Web3 = require("web3");

const loadWeb3One = () => {
  web3 = new Web3(web3.currentProvider);
};
const migrationInt = async (deployer, network, accounts) => {
  try {
    const contracts = await getContracts();
    const deployerAddress = accounts[0];
    const admin = network === "mainnet" ? process.env.ADMIN_ADDRESS : accounts[1];
    const netId = await web3.eth.net.getId();
    const heroTokenAddress = _.get(contracts, `address.${netId}.HeroToken`);
    // Contracts deployment if updated logic::
    const oldDepositBytecode = _.get(contracts, `bytecode.Deposit`);

    const kycHasBeenUpdated = () => contractIsUpdated(contracts, netId, "KYC", KYC);
    const depositHasBeenUpdated = () => contractIsUpdated(contracts, netId, "Deposit", Deposit);
    const authHasBeenUpdated = () => contractIsUpdated(contracts, netId, "Auth", Auth);

    let newContracts = _.cloneDeep(contracts);

    if (kycHasBeenUpdated()) {
      try {
        // deploy all contracts that depend on kyc contract if kyc changed
        await deployer.deploy(KYC, {
          from: deployerAddress
        });
        await deployer.deploy(Deposit, heroTokenAddress, KYC.address, {
          from: deployerAddress
        });
        await deployer.deploy(Auth, KYC.address, Deposit.address, {
          from: deployerAddress
        });

        // Update contracts
        newContracts = _.merge(newContracts, {
          address: {
            [netId]: {
              KYC: KYC.address,
              Deposit: Deposit.address,
              Auth: Auth.address
            }
          },
          bytecode: {
            KYC: KYC.bytecode,
            Auth: Auth.bytecode,
            Deposit: oldDepositBytecode // Don't overwrite old bytecode so in next migration referral can check the state
          }
        });

        // Merge ABIS
        let abis = {
          KYC: KYC.abi,
          Auth: Auth.abi,
          Deposit: Deposit.abi
        };
        Object.keys(abis).forEach(key => {
          newContracts["abi"][key] = abis[key];
        });
      } catch (error) {
        console.error("[kycHasBeenUpdated] ERROR KYC ", error);
        throw error;
      }
    } else if (depositHasBeenUpdated()) {
      // deploy all contracts that depend on deposit contract if deposit changed
      try {
        console.log("|============ KYC: no changes to deploy ==============|");
        const kycAdd = _.get(contracts, `address.${netId}.KYC`);
        await deployer.deploy(Deposit, heroTokenAddress, kycAdd, {
          from: deployerAddress
        });
        await deployer.deploy(Auth, kycAdd, Deposit.address, {
          from: deployerAddress
        });
        // Update contracts
        newContracts = _.merge(newContracts, {
          address: {
            [netId]: {
              Deposit: Deposit.address,
              Auth: Auth.address
            }
          },
          bytecode: {
            Auth: Auth.bytecode,
            Deposit: oldDepositBytecode // Don't overwrite old bytecode so in next migration referral can check the state
          }
        });

        // Merge ABIS
        let abis = {
          Auth: Auth.abi,
          Deposit: Deposit.abi
        };
        Object.keys(abis).forEach(key => {
          newContracts["abi"][key] = abis[key];
        });
      } catch (error) {
        console.error("[depositHasBeenUpdated] ERROR DEPOSIT ", error);
        throw error;
      }
    } else if (authHasBeenUpdated()) {
      // deploy auth if changed
      try {
        await deployer.deploy(
          Auth,
          newContracts.address[netId].KYC.address,
          newContracts.address[netId].Deposit.address,
          {
            from: deployerAddress
          }
        );

        // Update contracts
        newContracts = _.merge(newContracts, {
          address: {
            [netId]: {
              Auth: Auth.address
            }
          },
          bytecode: {
            Auth: Auth.bytecode
          }
        });

        // Merge ABIS
        let abis = {
          Auth: Auth.abi
        };
        Object.keys(abis).forEach(key => {
          newContracts["abi"][key] = abis[key];
        });
      } catch (error) {
        console.error("[authHasBeenUpdated] ERROR AUTH ", error);
        throw error;
      }
    } else {
      console.log("|============ KYC && Deposit && Auth: no changes to deploy ==============|");
    }

    if (kycHasBeenUpdated() || depositHasBeenUpdated() || authHasBeenUpdated()) {
      const IntAccounts = [...new Set([...accounts, ...devAccounts])]; //unique accounts not repeated
      if (IntAccounts.length > 0) {
        console.log(`> Adding to KYC registry ${IntAccounts.length} accounts`, "\n");
      }
      if (depositHasBeenUpdated()) {
        try {
          const depositDeployed = await Deposit.deployed();
          await depositDeployed.setAdministrator(admin, {from: deployerAddress});
          if (network === "cypress") {
            const HeroInstance = await HeroToken.at(heroTokenAddress);
            const HeroAmount = "200000000000000000000";
            for (let i = 1; i < accounts.length; i++) {
              //await HeroToken.transferFakeHeroTokens(accounts[i], { from: deployerAddress });
              await HeroInstance.approve(depositDeployed.address, HeroAmount, {
                from: accounts[i],
                gas: 800000
              });
              await depositDeployed.depositFor(accounts[i], {
                from: accounts[i],
                gas: 800000
              });
              const deped = await depositDeployed.hasDeposited(accounts[i]);
              if (deped) {
                console.log(`Added ${accounts[i]} to Deposit`);
              } else {
                console.log(`Error adding ${accounts[i]} to Deposit`);
              }
            }
          }
        } catch (error) {
          console.error(" ERROR DEPOSIT SET ADMIN or SET DEPOSITFOR ", error);
          throw error;
        }
      }

      if (kycHasBeenUpdated()) {
        try {
          const kycDeployed = await KYC.deployed();
          await kycDeployed.setAdministrator(admin, {from: deployerAddress});

          if (network !== "mainnet") {
            // Add default accounts to KYC

            for (let i = 0; i < IntAccounts.length; i++) {
              await kycDeployed.addAddressToKYC(IntAccounts[i], {
                from: admin,
                gas: 800000
              });

              const kyced = await kycDeployed.isConfirmed(IntAccounts[i]);
              if (kyced) {
                console.log(`Added ${IntAccounts[i]} to KYC`);
              } else {
                console.log(`Error adding ${IntAccounts[i]} to KYC`);
              }
            }
          }
        } catch (error) {
          console.error("ERROR UPDATE KYC Contract ", error);
          throw error;
        }
      }
    }
    await writeFileSync("./contracts.json", JSON.stringify(newContracts, null, 2));
  } catch (err) {
    console.error("ERROR MINT AND SEND ", err);
  }
};

module.exports = async (deployer, network, accounts) => {
  try {
    loadWeb3One();
    deployer.then(async () => {
      await migrationInt(deployer, network, accounts);
    });
  } catch (err) {
    // Prettier error output
    console.error(err);
    throw err;
  }
};
