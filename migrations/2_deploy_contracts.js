const Deposit = artifacts.require('DepositRegistry');
const KYC = artifacts.require('KYCRegistry');
const Auth = artifacts.require('Authorization');
const HeroToken = artifacts.require('HeroOrigenToken');
const DAI = artifacts.require('DAIFake');
const DAIProxy = artifacts.require('DAIProxy');
const LoanDispatcher = artifacts.require('LoanContractDispatcher');
const ReferralTracker = artifacts.require('ReferralTracker');
const devAccounts = require('../int.accounts.json');
const { writeFileSync } = require('fs');
const axios = require('axios');

const getContractTokens = async (deployer, network, deployerAddress) => {
  if (network === 'kovan') {
    const { data: contracts } = await axios(
      'https://blockchain-definitions.s3-eu-west-1.amazonaws.com/v1/contracts.json'
    );
    // Check if the contract.json has the address of HeroToken and DAI
    if (contracts['HeroToken'].address && contracts['DAI'].address) {
      return {
        heroTokenAddress: contracts['HeroToken'].address,
        daiAddress: contracts['DAI'].address
      };
    }
  }

  // Deploy a new HeroToken and DAI
  await deployer.deploy(HeroToken, {
    from: deployerAddress
  });
  await deployer.deploy(DAI, { from: deployerAddress });
  return {
    heroTokenAddress: HeroToken.address,
    daiAddress: DAI.address
  };
};

const migrationInt = async (deployer, network, accounts) => {
  const deployerAddress = accounts[0];

  const { heroTokenAddress, daiAddress } = await getContractTokens(
    deployer,
    network,
    deployerAddress
  );

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
      gas: LoanFactoryEstimatedGas
    }
  );

  const data = {
    HeroToken: {
      address: heroTokenAddress,
      abi: HeroToken.abi
    },
    DAI: {
      address: daiAddress,
      abi: DAI.abi
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

    DAIProxy: {
      address: DAIProxy.address,
      abi: DAIProxy.abi
    },
    LoanDispatcher: {
      address: LoanDispatcher.address,
      abi: LoanDispatcher.abi
    }
  };

  // Give ERC20 to whitelist addresses and add KYC registry
  const heroDeployed = await HeroToken.at(heroTokenAddress);
  const daiDeployed = await DAI.at(daiAddress);
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

  await writeFileSync('./contracts.json', JSON.stringify(data));
};

module.exports = async (deployer, network, accounts) => {
  try {
    await migrationInt(deployer, network, accounts);
  } catch (err) {
    // Prettier error output
    console.error(err);
    throw err;
  }
};
