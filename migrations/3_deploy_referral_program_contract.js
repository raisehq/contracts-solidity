const Deposit = artifacts.require('DepositRegistry');
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
  const { Deposit: DepositDeployed, HeroToken: HeroTokenDeployed } = JSON.parse(
    readFileSync('./contracts.json')
  );

  const deployerAddress = accounts[0];

  await deployer.deploy(
    ReferralTracker,
    DepositDeployed.address,
    HeroTokenDeployed.address,
    {
      from: deployerAddress
    }
  );

  const depositContract = await Deposit.at(DepositDeployed.address);
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

module.exports = async (deployer, accounts) => {
  await migration(deployer, accounts);
};
