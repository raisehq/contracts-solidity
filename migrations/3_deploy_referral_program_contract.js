const Deposit = artifacts.require('DepositRegistry');
const HeroToken = artifacts.require('HeroOrigenToken');
const ReferralTracker = artifacts.require('ReferralTracker');
const { readFileSync, writeFileSync } = require('fs');

const migration = async (deployer, networks, deployerAddress) => {
  // Read the contracts deployed from step 2
  const contracts = JSON.parse(readFileSync('./contracts.json'));

  const heroTokenAddress = contracts['HeroToken'].address;
  const depositAddress = contracts['Deposit'].address;

  await deployer.deploy(ReferralTracker, depositAddress, heroTokenAddress, {
    from: deployerAddress
  });

  const depositContract = await Deposit.deployed();
  const referralContract = await ReferralTracker.deployed();

  await depositContract.setReferralTracker(referralContract.address);

  const newContracts = {
    ...contracts,
    ...{
      ReferralTracker: {
        address: ReferralTracker.address,
        abi: ReferralTracker.abi
      }
    }
  };

  await writeFileSync('./contracts.json', JSON.stringify(newContracts));
};

module.exports = async (deployer, networks, accounts) => {
  try {
    const deployerAddress = accounts[0];
    await migration(deployer, networks, deployerAddress);
  } catch (err) {
    // Prettier error output
    console.error(err);
    throw err;
  }
};
