const Deposit = artifacts.require('DepositRegistry');
const HeroToken = artifacts.require('HeroOrigenToken');
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
  const contracts = networks == 'kovan' ? JSON.parse(readFileSync('./contracts.json')) : {};
  const deployerAddress = accounts[0];
  const heroTokenAddress = networks == "kovan" ? contracts['HeroToken'].address : (await HeroToken.deployed()).address;

  await deployer.deploy(
    ReferralTracker,
    Deposit.address,
    heroTokenAddress,
    {
      from: deployerAddress
    }
  );

  const depositContract = await Deposit.deployed();
  const referralContract = await ReferralTracker.deployed();
  
  await depositContract.setReferralTracker(referralContract.address);

  if (networks == "kovan") {
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
  }
};

module.exports = async (deployer, networks, accounts) => {
  try {
    await migration(deployer, networks, accounts);
  } catch (err) {
    // Prettier error output
    console.error(err);
    throw err;
  }
};
