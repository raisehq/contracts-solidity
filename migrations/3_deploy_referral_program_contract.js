const Deposit = artifacts.require('DepositRegistry');
const HeroToken = artifacts.require('HeroOrigenToken');
const ReferralTracker = artifacts.require('ReferralTracker');
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
  const contracts = JSON.parse(readFileSync('./contracts.json'));
  const heroTokenAddress = contracts.HeroToken.address;

  const deployerAddress = accounts[0];
  const depositContractAddress = contracts["Deposit"]["address"];

  await deployer.deploy(ReferralTracker, depositContractAddress, heroTokenAddress, {
    from: deployerAddress
  });

  const depositContract = await Deposit.at(depositContractAddress);
  await depositContract.setReferralTracker(ReferralTracker.address);


  const newContracts = {
    ...contracts,
    ...{
      ReferralTracker: {
        address: ReferralTracker.address,
        abi: ReferralTracker.abi
      }
    }
  };

  await FileHelper.write('./contracts.json', newContracts);
};


module.exports = async (deployer, network, accounts) => {
  await migration(deployer, accounts);
};
