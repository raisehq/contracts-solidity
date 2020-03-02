const _ = require("lodash");
const Deposit = artifacts.require("DepositRegistry");
const ReferralTracker = artifacts.require("ReferralTracker");
const RaiseToken = artifacts.require("RaiseTokenContract");
const {writeFileSync} = require("fs");
const erc20Abi = artifacts.require("IERC20").abi;
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

const DEPOSIT_ID = "Deposit";
const REFERRAL_ID = "ReferralTracker";
const RAISE_ID = "RaiseToken";

const migrationInt = async (deployer, network, accounts) => {
  try {
    let contractMetadata = metadataFactory();
    const contracts = await getContracts();
    const deployerAddress = accounts[0];
    const admin = network === "mainnet" ? process.env.ADMIN_ADDRESS : accounts[1];
    const netId = await web3.eth.net.getId();

    const raiseTokenAddress = _.get(contracts, `address.${netId}.${RAISE_ID}`);
    const depositAddress = _.get(contracts, `address.${netId}.${DEPOSIT_ID}`);

    const depositHasBeenUpdated = () => contractIsUpdated(contracts, netId, DEPOSIT_ID, Deposit);
    const referralHasBeenUpdated = () =>
      contractIsUpdated(contracts, netId, REFERRAL_ID, ReferralTracker);

    if (referralHasBeenUpdated() || depositHasBeenUpdated()) {
      await deployer.deploy(ReferralTracker, depositAddress, raiseTokenAddress, {
        from: deployerAddress
      });

      const depositDeployed = await Deposit.at(depositAddress);
      const referralContract = await ReferralTracker.deployed();

      await depositDeployed.setReferralTracker(referralContract.address, {
        from: deployerAddress,
        gas: 1000000
      });

      if (referralHasBeenUpdated()) {
        // set administrator
        await referralContract.setAdministrator(admin, {from: deployerAddress});

        // Add admin as pauser for referral contract
        const isPauser = await referralContract.isPauser(admin);
        console.log("> ADMIN IS PAUSER : ", isPauser);
        if (!isPauser) {
          await referralContract.addPauser(admin, {
            from: deployerAddress,
            gas: 800000
          });
        }
        if (!network.includes("mainnet")) {
          // add funds to referral so users can withdraw
          const tokens = web3.utils.toWei("100000", "ether"); // 100K tokens
          console.log("raisetoken", raiseTokenAddress);
          const raiseInstance = new web3.eth.Contract(erc20Abi, raiseTokenAddress);
          console.log("balance");
          const balance = await raiseInstance.methods.balanceOf(admin).call({from: admin});
          console.log(balance, web3.utils.fromWei(balance));
          await raiseInstance.methods.approve(referralContract.address, tokens).send({
            from: admin,
            gas: 800000
          });
          await referralContract.addFunds(tokens, {
            from: admin,
            gas: 800000
          });
        }
      }
      contractMetadata = setMetadata(contractMetadata, netId, REFERRAL_ID, ReferralTracker);

      const metadata = _.merge(contracts, contractMetadata);
      writeMetadataTemp(metadata);
    } else {
      console.log("|============ ReferralTracker: no changes to deploy ==============|");
    }
  } catch (error) {
    console.error("[REFERALTRACKER] ERROR MIGRATION ", error);
    throw error;
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
