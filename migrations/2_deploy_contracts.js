const Deposit = artifacts.require('DepositRegistry');
const KYC = artifacts.require('KYCRegistry');
const Auth = artifacts.require('Authorization');
let HeroToken = artifacts.require('HeroOrigenToken');
let DAI = artifacts.require('DAIFake');
const DAIProxy = artifacts.require('DAIProxy');
const LoanDispatcher = artifacts.require('LoanContractDispatcher');
const devAccounts = require('../int.accounts.json');
const { writeFile } = require('fs');
const fs = require('fs');
const http = require("http");

const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;


const FileHelper = {
  write: (filepath, data) =>
    new Promise((resolve, reject) =>
      writeFile(filepath, JSON.stringify(data), err =>
        err ? reject(err) : resolve()
      )
    )
};


const getJSON = (url) => {
  var resp ;
  var xmlHttp ;

  resp  = '' ;
  xmlHttp = new XMLHttpRequest();

  if(xmlHttp != null)
  {
      xmlHttp.open( "GET", url, false );
      xmlHttp.send( null );
      resp = xmlHttp.responseText;
  }

  return JSON.parse(resp) ;
}

const migrationInt = async (deployer, accounts) => {
  const deployerAddress = accounts[0];
  const network = await web3.eth.net.getId();
  let herotokenAddress;
  let daiAddress;

  if (network == 42) {
    const heroContracts = await getJSON('http://blockchain-definitions.s3-eu-west-1.amazonaws.com/v1/contracts.json');

    HeroToken = await new web3.eth.Contract(
      heroContracts['HeroToken'].abi,
      heroContracts['HeroToken'].address
    );

    DAI = await new web3.eth.Contract(
      heroContracts['DAI'].abi,
      heroContracts['DAI'].address
    );
    herotokenAddress = HeroToken._address;
    daiAddress = DAI._address;
  } else {
    await deployer.deploy(HeroToken, { from: deployerAddress });
    await deployer.deploy(DAI, { from: deployerAddress });
    herotokenAddress = HeroToken.address;
    daiAddress = DAI.address;
  }

  await deployer.deploy(Deposit, herotokenAddress, {
    from: deployerAddress
  });
  await deployer.deploy(KYC, { from: deployerAddress });
  await deployer.deploy(Auth, KYC.address, Deposit.address, {
    from: deployerAddress
  });
  await deployer.deploy(DAIProxy, Auth.address, daiAddress, {
    from: deployerAddress
  });

  const dispatcherArgs = [
    Auth.address,
    daiAddress,
    DAIProxy.address,
  ];
  const dispatcherFrom = { from: deployerAddress }
  const LoanFactory = new web3.eth.Contract(LoanDispatcher.abi, null, { data: LoanDispatcher.bytecode });
  const LoanFactoryEstimatedGas = await LoanFactory.deploy({arguments: dispatcherArgs}).estimateGas(dispatcherFrom)

  await deployer.deploy(
    LoanDispatcher,
    Auth.address,
    daiAddress,
    DAIProxy.address,
    { from: deployerAddress, gas: LoanFactoryEstimatedGas, gasPrice: 10000000000}
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

  let heroDeployed;
  let daiDeployed;
  // Give ERC20 to whitelist addresses and add KYC registry
  if (network == 42) {
    heroDeployed = HeroToken;
    daiDeployed = DAI;
  } else {
    heroDeployed = await HeroToken.deployed();
    daiDeployed = await DAI.deployed();
  }

  const kycDeployed = await KYC.deployed();
  const IntAccounts = [...accounts, ...devAccounts];
  if (IntAccounts.length > 0) {
    console.log(`> Sending tokens and adding to KYC registry ${IntAccounts.length + 1} accounts`, '\n')
  }
  for (let i = 0; i < IntAccounts.length; i++) {
    const tokens = web3.utils.toWei('10000000', 'ether'); // 10 million tokens each user
    // HEROTOKENS

    if (network == 42) {
      await heroDeployed.methods
        .mint(
          IntAccounts[i],
          tokens
        )
        .send({
          from: deployerAddress,
          gas: 8000000
        });
        // DAI TOKENS
        await daiDeployed.methods
        .mint(
          IntAccounts[i], 
          tokens)        
        .send({
            from: deployerAddress,
            gas: 8000000
        });
    } else {
      await heroDeployed.mint(IntAccounts[i], tokens, {
        from: deployerAddress,
        gas: 8000000
      });
      // DAI TOKENS
      await daiDeployed.mint(IntAccounts[i], tokens, {
        from: deployerAddress,
        gas: 8000000
      });
    }
    // ADD ADDRESS TO KYC
    await kycDeployed.add(IntAccounts[i], {
      from: deployerAddress,
      gas: 8000000
    });
    const inKyc = await kycDeployed.isConfirmed(IntAccounts[i]);
    if (inKyc) {
      console.log(`Added ${IntAccounts[i]} to KYC and sent 1000 HERO and 1000 FAKE DAI.`);
    } else {
      console.log(`Error adding ${IntAccounts[i]} to KYC but SENT 1000 HERO and 1000 FAKE DAI.`);
    }
  }
  await FileHelper.write('./contracts.json', data);
};

const migrationLive = async (deployer, accounts) => {
  const deployerAddress = accounts[0]
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
  if (network == 'main') {
    await migrationLive(deployer, deployerAddress);
  } else {
    await migrationInt(deployer, accounts);
  }
};
