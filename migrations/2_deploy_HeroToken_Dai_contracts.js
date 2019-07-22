const HeroToken = artifacts.require('HeroOrigenToken');
const DAI = artifacts.require('DAIFake');
const devAccounts = require('../int.accounts.json');
const {readFileSync, writeFileSync} = require('fs');
const axios = require('axios');

const getContractTokens = async (deployer, network, deployerAddress) => {
    if (network === 'kovan') {
        try {
            const {data: contracts} = await axios(
            'https://blockchain-definitions.s3-eu-west-1.amazonaws.com/v2/contracts.json'
            );
            // Check if the contract.json has the address of HeroToken and DAI
            if (contracts['HeroToken'].address && contracts['DAI'].address) {
            // Check if deployer is owner of already deployed contracts
            const HeroInstance = await HeroToken.at(contracts['HeroToken'].address);
            const owner = await HeroInstance.owner();
            if (owner === deployerAddress) {
                return {
                heroTokenAddress: contracts['HeroToken'].address,
                daiAddress: contracts['DAI'].address
                };
            }
            }
        } catch (error) {
            if (error.response.status !== 404) throw error;
            console.log('No exist previous contracts.json we continue and create new one.');
        }
    }

    // Deploy a new HeroToken and DAI
    await deployer.deploy(HeroToken, {
        from: deployerAddress
    });
    await deployer.deploy(DAI, {from: deployerAddress});
    return {
        heroTokenAddress: HeroToken.address,
        daiAddress: DAI.address
    };
};


const migrationInt = async (deployer, network, accounts) => {
    const deployerAddress = accounts[0];
    const admin = accounts[1];

    const {heroTokenAddress, daiAddress} = await getContractTokens(
        deployer,
        network,
        deployerAddress
    );

    console.log('after check hero and dai', heroTokenAddress, daiAddress);

    const data = {
        HeroToken: {
            address: heroTokenAddress,
            abi: HeroToken.abi
        },
        DAI: {
            address: daiAddress,
            abi: DAI.abi
        }
    };

    // Give ERC20 to whitelist addresses and add KYC registry
    const heroDeployed = await HeroToken.at(heroTokenAddress);
    const daiDeployed = await DAI.at(daiAddress);

    const IntAccounts = [...new Set([...accounts, ...devAccounts])]; //unique accounts not repeated

    if (IntAccounts.length > 0) {
        console.log(`> Sending tokens and adding to KYC registry ${IntAccounts.length} accounts`, '\n');
    }
    try {
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
        }
    } catch (err) {
        console.error('ERROR MINT AND SEND ', err);
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