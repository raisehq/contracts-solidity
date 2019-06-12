const Deposit = artifacts.require('DepositRegistry');
const KYC = artifacts.require('KYCRegistry');
const Auth = artifacts.require('Authorization');
const HeroToken = artifacts.require('HeroOrigenToken');
const DAI = artifacts.require('DAIFake');
const DAIProxy = artifacts.require('DAIProxy');
const LoanDispatcher = artifacts.require('LoanContractDispatcher');

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
  let daiAddress;
  let heroTokenAddress;

  if (process.env.HERO_TOKEN_ADDRESS) {
    daiAddress = process.env.HERO_TOKEN_ADDRESS;
  } else {
    await deployer.deploy(HeroToken, { from: deployerAddress });
    heroTokenAddress = HeroToken.address;
  }

  if (process.env.DAI_ADDRESS) {
    daiAddress = process.env.DAI_ADDRESS;
  } else {
    await deployer.deploy(DAI, {from: deployerAddress});
    daiAddress = DAI.address;
  }

  await deployer.deploy(Deposit, heroTokenAddress, {
    from: deployerAddress
  });
  await deployer.deploy(KYC, { from: deployerAddress });
  await deployer.deploy(Auth, KYC.address, Deposit.address, {
    from: deployerAddress
  });
  await deployer.deploy(DAIProxy, Auth.address, daiAddress, {from: deployerAddress});
  await deployer.deploy(LoanDispatcher, Auth.address, daiAddress, DAIProxy.address, {from: deployerAddress});

  const data = {
    HeroToken: {
      address: heroTokenAddress,
      abi: HeroToken.abi
    },
    Deposit: {
      address: Deposit.address,
      abi: Deposit.abi
    },
    KYC: {
      address: KYC.address,
      abi: KYC.abi
    },
    Auth: {
      address: Auth.address,
      abi: Auth.abi
    },
    DAI: {
      address: daiAddress,
      abi: HeroToken.abi
    },
    DAIProxy: {
      address: DAIProxy.address,
      abi: DAIProxy.abi
    },
    LoanDispatcher: {
      address: LoanDispatcher.address,
      abi: LoanDispatcher.abi
    }
  };

  await FileHelper.write('./contracts.json', data);
};
