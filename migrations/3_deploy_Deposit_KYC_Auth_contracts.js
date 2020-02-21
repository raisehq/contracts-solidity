const _ = require("lodash");
const Deposit = artifacts.require("DepositRegistry");
const KYC = artifacts.require("KYCRegistry");
const Auth = artifacts.require("Authorization");
const RaiseToken = artifacts.require("RaiseTokenContract");
const devAccounts = require("../int.accounts.json");
const {writeFileSync} = require("fs");
const {
  getContracts,
  contractIsUpdated,
  metadataFactory,
  setMetadata,
  writeMetadataTemp
} = require("../scripts/helpers");
const Web3 = require("web3");

const loadWeb3One = () => {
  web3 = new Web3(web3.currentProvider);
};

const KYC_ID = "KYC";
const DEPOSIT_ID = "Deposit";
const AUTH_ID = "Auth";
const RAISE_ID = "RaiseToken";

const migrationInt = async (deployer, network, accounts) => {
  try {
    let contractMetadata = metadataFactory();
    const contracts = await getContracts();
    const deployerAddress = accounts[0];
    const admin = network === "mainnet" ? process.env.ADMIN_ADDRESS : accounts[1];
    const netId = await web3.eth.net.getId();
    const raiseTokenAddress = _.get(contracts, `address.${netId}.${RAISE_ID}`);

    const kycHasBeenUpdated = () => contractIsUpdated(contracts, netId, KYC_ID, KYC);
    const depositHasBeenUpdated = () => contractIsUpdated(contracts, netId, DEPOSIT_ID, Deposit);
    const authHasBeenUpdated = () => contractIsUpdated(contracts, netId, AUTH_ID, Auth);

    const deployOptions = {
      from: deployerAddress
    };
    if (kycHasBeenUpdated()) {
      try {
        // deploy all contracts that depend on kyc contract if kyc changed
        console.log("|============ KYC, Deposit, and Auth deployment ==============|");
        await deployer.deploy(KYC, deployOptions);
        await deployer.deploy(Deposit, raiseTokenAddress, KYC.address, deployOptions);
        await deployer.deploy(Auth, KYC.address, Deposit.address, deployOptions);
        // Update contracts
        contractMetadata = setMetadata(contractMetadata, netId, KYC_ID, KYC);
        contractMetadata = setMetadata(contractMetadata, netId, DEPOSIT_ID, Deposit);
        contractMetadata = setMetadata(contractMetadata, netId, AUTH_ID, Auth);
      } catch (error) {
        console.error("[kycHasBeenUpdated] ERROR KYC ", error);
        throw error;
      }
    } else if (depositHasBeenUpdated()) {
      // deploy all contracts that depend on deposit contract if deposit changed
      try {
        console.log("|============ Deposit and Auth deployment ==============|");
        const kycAdd = _.get(contracts, `address.${netId}.${KYC_ID}`);

        await deployer.deploy(Deposit, raiseTokenAddress, kycAdd, deployOptions);
        await deployer.deploy(Auth, kycAdd, Deposit.address, deployOptions);
        // Update contracts
        contractMetadata = setMetadata(contractMetadata, netId, DEPOSIT_ID, Deposit);
        contractMetadata = setMetadata(contractMetadata, netId, AUTH_ID, Auth);
      } catch (error) {
        console.error("ERROR: Deposit and Auth ", error);
        throw error;
      }
    } else if (authHasBeenUpdated()) {
      // deploy auth if changed
      try {
        await deployer.deploy(
          Auth,
          contracts.address[netId].KYC.address,
          contracts.address[netId].Deposit.address,
          deployOptions
        );
        contractMetadata = setMetadata(contractMetadata, netId, AUTH_ID, Auth);
      } catch (error) {
        console.error("[authHasBeenUpdated] ERROR AUTH ", error);
        throw error;
      }
    } else {
      console.log("|============ KYC && Deposit && Auth: no changes to deploy ==============|");
    }

    if (kycHasBeenUpdated() || depositHasBeenUpdated() || authHasBeenUpdated()) {
      const IntAccounts = [...new Set([...accounts, ...devAccounts])]; //unique accounts not repeated
      if (depositHasBeenUpdated()) {
        try {
          const depositDeployed = await Deposit.deployed();
          await depositDeployed.setAdministrator(admin, deployOptions);
          if (network === "cypress") {
            const RaiseInstance = await RaiseToken.at(raiseTokenAddress);
            for (let i = 1; i < accounts.length; i++) {
              const txOptions = {from: accounts[i], gas: 800000};
              await RaiseInstance.approve(
                depositDeployed.address,
                web3.utils.toWei("200"),
                txOptions
              );
              await depositDeployed.depositFor(accounts[i], txOptions);
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

          if (!network.includes("mainnet")) {
            // Add default accounts to KYC

            for (let i = 0; i < IntAccounts.length; i++) {
              await kycDeployed.addAddressToKYC(IntAccounts[i], {
                from: admin,
                gas: 800000
              });
            }
          }
        } catch (error) {
          console.error("ERROR UPDATE KYC Contract ", error);
          throw error;
        }
      }
    }
    const metadata = _.merge(contracts, contractMetadata);
    writeMetadataTemp(metadata);
  } catch (err) {
    console.error("ERROR MINT AND SEND ", err);
  }
};

module.exports = async (deployer, network, accounts) => {
  if (network.includes("coverage")) {
    return;
  }
  try {
    loadWeb3One();
    await migrationInt(deployer, network, accounts);
  } catch (err) {
    // Prettier error output
    console.error(err);
    throw err;
  }
};
