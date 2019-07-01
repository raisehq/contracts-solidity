const Deposit = artifacts.require('DepositRegistry');
const ReferralTracker = artifacts.require('ReferralTracker');
const devAccounts = require('../int.accounts.json');
const { readFileSync, writeFile } = require('fs');

const FileHelper = {
  write: (filepath, data) =>
    new Promise((resolve, reject) =>
      writeFile(filepath, JSON.stringify(data), err =>
        err ? reject(err) : resolve()
      )
    )
};

const migration = async (deployer, accounts) => {

  let data = JSON.parse(readFileSync('./contracts.json'));

  const deployerAddress = accounts[0];

  const depositContractAddress = data["Deposit"]["address"];
  const heroTokenAddress = data["HeroToken"]["address"];

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

  console.log(data);

  await FileHelper.write('./contracts.json', data);
};


module.exports = async (deployer, network, accounts) => {
  await migration(deployer, accounts);
};
