const _ = require("lodash");
const ReferralTracker = artifacts.require("ReferralTracker");
const Auth = artifacts.require("Authorization");
const RaiseToken = artifacts.require("RaiseTokenContract");
const devAccounts = require("../int.accounts.json");
const axios = require("axios");
const bluebird = require("bluebird");
const Web3 = require("web3");
const {
  getContracts,
  contractIsUpdated,
  metadataFactory,
  setMetadata,
  writeMetadataTemp
} = require("../scripts/helpers");

const loadWeb3One = () => {
  web3 = new Web3(web3.currentProvider);
};

const AUTH_ID = "Auth";
const REF_ID = "ReferralTracker";

const migrationInt = async (deployer, network, accounts) => {
  try {
    const contracts = await getContracts();
    let contractMetadata = _.cloneDeep(contracts);
    const deployerAddress = accounts[0];
    const admin = network === "mainnet" ? process.env.ADMIN_ADDRESS : accounts[1];
    const netId = await web3.eth.net.getId();
    const DAITokenAddress = _.get(contracts, `address.${netId}.DAI`);

    const authHasBeenUpdated = () => contractIsUpdated(contracts, netId, AUTH_ID, Auth);
    const referralHasBeenUpdated = () =>
      contractIsUpdated(contracts, netId, REF_ID, ReferralTracker);

    const deployOptions = {
      from: deployerAddress
    };

    if (referralHasBeenUpdated()) {
      try {
        console.log("|============ ReferralTracker deployment ==============|");
        const AuthAddress = _.get(contracts, `address.${netId}.Auth`);
        const referralBonus = web3.utils.toWei("50");
        await deployer.deploy(
          ReferralTracker,
          AuthAddress,
          admin,
          DAITokenAddress,
          referralBonus,
          deployOptions
        );

        // set admin
        const ReferralTrackerDeployed = await ReferralTracker.deployed();
        await ReferralTrackerDeployed.setAdministrator(admin, {from: deployerAddress});

        // Update contracts
        contractMetadata = setMetadata(contractMetadata, netId, REF_ID, ReferralTracker);
      } catch (error) {
        console.error("[referralTrackerHasBeenUpdated] ERROR ReferralTracker ", error);
        throw error;
      }
    } else if (authHasBeenUpdated()) {
      // update referralTrakcer with new auth
      try {
        console.log("|============ Set new auth to ReferralTracker ==============|");
        const AuthAddress = _.get(contracts, `address.${netId}.Auth`);
        const RefAddress = _.get(contracts, `address.${netId}.ReferralTracker`);
        const refInstance = ReferralTracker.at(RefAddress);
        await refInstance.setAuthAddress(AuthAddress, {from: admin});
      } catch (error) {
        console.error("ERROR: Setting new Auth to Referral Tracker ", error);
        throw error;
      }
    } else {
      // TODO: when automation in DAIProxy implemented, add it to registry address
      console.log("|============ ReferralTracker && Auth: no changes to deploy ==============|");
    }

    writeMetadataTemp(contractMetadata);
  } catch (err) {
    console.error("ERROR MINT AND SEND ", err);
  }
};

module.exports = async (deployer, network, accounts) => {
  if (network.includes("coverage") || network.includes("test")) {
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
