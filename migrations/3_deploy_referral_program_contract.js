const Deposit = artifacts.require('DepositRegistry');
const ReferralTracker = artifacts.require('ReferralTracker');
const devAccounts = require('../int.accounts.json');
const { readFileSync, writeFile } = require('fs');
const axios = require('axios');

const FileHelper = {
  write: (filepath, data) =>
    new Promise((resolve, reject) =>
      writeFile(filepath, JSON.stringify(data), err =>
        err ? reject(err) : resolve()
      )
    )
};

const migration = async (deployer, accounts) => {

  const network = await web3.eth.net.getId();
  let heroTokenAddress;
  let data = JSON.parse(readFileSync('./contracts.json'));

  // 42 = Kovan
  if (network == 42) {
    const resp = await axios('https://blockchain-definitions.s3-eu-west-1.amazonaws.com/v1/contracts.json');
    const heroContracts = resp.data;

    heroTokenAddress = heroContracts['HeroToken'].address;
  } else {
    heroTokenAddress = data["HeroToken"]["address"];
  }

  const deployerAddress = accounts[0];
  const depositContractAddress = data["Deposit"]["address"];

  await deployer.deploy(ReferralTracker, depositContractAddress, heroTokenAddress, {
    from: deployerAddress
  });

  const depositContract = await Deposit.at(depositContractAddress);
  await depositContract.setReferralTracker(ReferralTracker.address);


  data = {
    ...data,
    ...{
      ReferralTracker: {
        address: ReferralTracker.address,
        abi: ReferralTracker.abi
      }
    }
  };

  await FileHelper.write('./contracts.json', data);
};


module.exports = async (deployer, network, accounts) => {
  await migration(deployer, accounts);
};
