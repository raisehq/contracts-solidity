const Deposit = artifacts.require('DepositRegistry');
const KYC = artifacts.require('KYCRegistry');
const Auth = artifacts.require('Authorization');
const HeroToken = artifacts.require('HeroOrigenToken');

const { writeFile } = require('fs');

const FileHelper = {
  write: (filepath, data) =>
    new Promise((resolve, reject) =>
      writeFile(filepath, JSON.stringify(data), err =>
        err ? reject(err) : resolve()
      )
    )
};

module.exports = async (deployer, network, accounts) => {
  const deployerAddress = accounts[0];

  await deployer.deploy(HeroToken, {
    from: deployerAddress
  });
  await deployer.deploy(Deposit, HeroToken.address, {
    from: deployerAddress
  });
  await deployer.deploy(KYC, { from: deployerAddress });
  await deployer.deploy(Auth, KYC.address, Deposit.address, {
    from: deployerAddress
  });

  const data = {
    HeroToken: {
      address: HeroToken.address
    },
    Deposit: {
      address: Deposit.address
    },
    KYC: {
      address: KYC.address
    },
    Auth: {
      address: Auth.address
    }
  };

  await FileHelper.write('./contracts.json', data);
};
