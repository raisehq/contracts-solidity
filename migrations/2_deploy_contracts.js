const Deposit = artifacts.require('DepositRegistry');
const KYC = artifacts.require('KYCRegistry');
const Auth = artifacts.require('Authorization');
let HeroToken = artifacts.require('HeroOrigenToken');
let DAI = artifacts.require('DAIFake');
const DAIProxy = artifacts.require('DAIProxy');
const LoanDispatcher = artifacts.require('LoanContractDispatcher');
const ReferralTracker = artifacts.require('ReferralTracker');
const devAccounts = require('../int.accounts.json');
const { readFileSync, writeFile } = require('fs');
const axios = require('axios');
const Contract = require('truffle-contract');

const FileHelper = {
  write: (filepath, data) =>
    new Promise((resolve, reject) =>
      writeFile(filepath, JSON.stringify(data), err =>
        err ? reject(err) : resolve()
      )
    )
};

const migrationInt = async (deployer, accounts) => {
  const deployerAddress = accounts[0];
  const network = await web3.eth.net.getId();
  let heroTokenAddress;
  let daiAddress;

  const { data: contracts } = await axios(
    'https://blockchain-definitions.s3-eu-west-1.amazonaws.com/v1/contracts.json'
  );

  heroTokenAddress = contracts['HeroToken'].address;
  daiAddress = contracts['DAI'].address;

  console.log('before check hero and dai', heroTokenAddress, daiAddress);
  if (network != 42 || !heroTokenAddress) {
    const deployedHero = await deployer.deploy(HeroToken, {
      from: deployerAddress
    });
    heroTokenAddress = deployedHero.address;
  }
  if (network != 42 || !daiAddress) {
    const deployedDAI = await deployer.deploy(DAI, { from: deployerAddress });
    daiAddress = deployedDAI.address;
  }

  console.log('after check hero and dai', heroTokenAddress, daiAddress);

  await deployer.deploy(KYC, { from: deployerAddress });

  await deployer.deploy(Deposit, heroTokenAddress, KYC.address, {
    from: deployerAddress
  });

  await deployer.deploy(Auth, KYC.address, Deposit.address, {
    from: deployerAddress
  });
  await deployer.deploy(DAIProxy, Auth.address, daiAddress, {
    from: deployerAddress
  });

  const dispatcherArgs = [Auth.address, daiAddress, DAIProxy.address];
  const dispatcherFrom = { from: deployerAddress };
  const LoanFactory = new web3.eth.Contract(LoanDispatcher.abi, null, {
    data: LoanDispatcher.bytecode
  });
  const LoanFactoryEstimatedGas = await LoanFactory.deploy({
    arguments: dispatcherArgs
  }).estimateGas(dispatcherFrom);
  await deployer.deploy(
    LoanDispatcher,
    Auth.address,
    daiAddress,
    DAIProxy.address,
    {
      from: deployerAddress,
      gas: LoanFactoryEstimatedGas,
      gasPrice: 10000000000
    }
  );

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
      abi: DAI.abi
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
  console.log('prior contract api', web3.currentProvider);
  // 42 = Kovan
  // Give ERC20 to whitelist addresses and add KYC registry
  const heroContract = Contract({
    abi: HeroToken.abi
  });
  heroContract.setProvider(web3.currentProvider);
  heroContract.setNetwork(network);
  const daiContract = Contract({
    abi: DAI.abi
  });
  console.log('current provider', web3.currentProvider);
  daiContract.setProvider(web3.currentProvider);

  daiContract.setNetwork(network);
  const heroDeployed = await heroContract.at(heroTokenAddress);
  console.log('prior instance', daiContract);
  const daiDeployed = await daiContract.at(daiAddress);
  console.log('instance dai', daiDeployed);
  const kycDeployed = await KYC.deployed();
  const IntAccounts = [...accounts, ...devAccounts];
  if (IntAccounts.length > 0) {
    console.log(
      `> Sending tokens and adding to KYC registry ${IntAccounts.length +
        1} accounts`,
      '\n'
    );
  }
  for (let i = 0; i < IntAccounts.length; i++) {
    const tokens = web3.utils.toWei('10000000', 'ether'); // 10 million tokens each user
    // HEROTOKENS
    // 42 = Kovan
    await heroDeployed.mint(IntAccounts[i], tokens, {
      from: deployerAddress,
      gas: 800000
    });
    // DAI TOKENS
    await daiDeployed.mint(IntAccounts[i], tokens, {
      from: deployerAddress,
      gas: 800000
    });
    // ADD ADDRESS TO KYC
    await kycDeployed.add(IntAccounts[i], {
      from: deployerAddress,
      gas: 800000
    });
    const inKyc = await kycDeployed.isConfirmed(IntAccounts[i]);
    if (inKyc) {
      console.log(
        `Added ${IntAccounts[i]} to KYC and sent 1000 HERO and 1000 FAKE DAI.`
      );
    } else {
      console.log(
        `Error adding ${
          IntAccounts[i]
        } to KYC but SENT 1000 HERO and 1000 FAKE DAI.`
      );
    }
  }
  if (network == 42) {
    await FileHelper.write('./contracts.json', data);
  }
};

const migrationLive = async (deployer, accounts) => {
  const deployerAddress = accounts[0];
  const heroTokenAddress = process.env.HERO_TOKEN_ADDRESS;
  const daiAddress = process.env.DAI_ADDRESS;

  await deployer.deploy(KYC, { from: deployerAddress });
  await deployer.deploy(Deposit, heroTokenAddress, KYC.address, {
    from: deployerAddress
  });

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
  if (network == 'main') {
    await migrationLive(deployer, deployerAddress);
  } else {
    await migrationInt(deployer, accounts);
  }
};
