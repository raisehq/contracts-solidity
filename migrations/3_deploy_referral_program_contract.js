const Deposit = artifacts.require('DepositRegistry');
const ReferralTracker = artifacts.require('ReferralTracker');
const { readFileSync, writeFile } = require('fs');

const FileHelper = {
  write: (filepath, data) =>
    new Promise((resolve, reject) =>
      writeFile(filepath, JSON.stringify(data), err =>
        err ? reject(err) : resolve()
      )
    )
};

const migration = async (deployer, networks, accounts) => {
  const contracts = JSON.parse(readFileSync('./contracts.json'));

  const deployerAddress = accounts[0];

  await deployer.deploy(
    ReferralTracker,
    contracts.Deposit.address,
    contracts.HeroToken.address,
    {
      from: deployerAddress
    }
  );

  const depositContract = await Deposit.at(contracts.Deposit.address);

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

module.exports = async (deployer, networks, accounts) => {
  await migration(deployer, networks, accounts);
};
