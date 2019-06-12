const Deposit = artifacts.require('DepositRegistry');
const KYC = artifacts.require('KYCRegistry');
const Auth = artifacts.require('Authorization');
const HeroToken = artifacts.require('HeroOrigenToken');
const DAI = artifacts.require('DAIFake');
const DAIProxy = artifacts.require('DAIProxy');
const LoanDispatcher = artifacts.require('LoanContractDispatcher');
const IntAccounts = require('../int.accounts.json');
const { writeFile } = require('fs');

const FileHelper = {
  write: (filepath, data) =>
    new Promise((resolve, reject) =>
      writeFile(filepath, JSON.stringify(data), err =>
        err ? reject(err) : resolve()
      )
    )
};

const migrationInt = async (deployer, deployerAddress) => {
  await deployer.deploy(HeroToken, { from: deployerAddress });

  await deployer.deploy(DAI, { from: deployerAddress });

  await deployer.deploy(Deposit, HeroToken.address, {
    from: deployerAddress
  });
  await deployer.deploy(KYC, { from: deployerAddress });
  await deployer.deploy(Auth, KYC.address, Deposit.address, {
    from: deployerAddress
  });
  await deployer.deploy(DAIProxy, Auth.address, DAI.address, {
    from: deployerAddress
  });
  await deployer.deploy(
    LoanDispatcher,
    Auth.address,
    DAI.address,
    DAIProxy.address,
    { from: deployerAddress }
  );

  const data = {
    HeroToken: {
      address: HeroToken.address,
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
      address: DAI.address,
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
  const heroDeployed = await HeroToken.deployed();
  IntAccounts.forEach(async addr => {
    await heroDeployed.transfer(addr, 1000).send({ from: deployerAddress });
  });
  await FileHelper.write('./contracts.json', data);
};

const migrationLive = async (deployer, deployerAddress) => {
  const heroTokenAddress = process.env.HERO_TOKEN_ADDRESS;
  const daiAddress = process.env.DAI_ADDRESS;

  await deployer.deploy(Deposit, heroTokenAddress, {
    from: deployerAddress
  });
  await deployer.deploy(KYC, { from: deployerAddress });
  await deployer.deploy(Auth, KYC.address, Deposit.address, {
    from: deployerAddress
  });
  await deployer.deploy(DAIProxy, Auth.address, daiAddress, {
    from: deployerAddress
  });
  await deployer.deploy(
    LoanDispatcher,
    Auth.address,
    daiAddress,
    DAIProxy.address,
    { from: deployerAddress }
  );

  const data = {
    HeroToken: {
      address: heroTokenAddress
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
      address: daiAddress
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
  await FileHelper.write('./prod.contracts.json', data);
};

module.exports = async (deployer, network, accounts) => {
  const deployerAddress = accounts[0];
  if (network == 'live') {
    await migrationLive(deployer, deployerAddress);
  } else {
    await migrationInt(deployer, deployerAddress);
  }
};
