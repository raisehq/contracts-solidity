const HeroToken = artifacts.require('HeroOrigenToken');
const DAI = artifacts.require('DAIFake');
const devAccounts = require('../int.accounts.json');
const {writeFileSync, readFileSync} = require('fs');
const axios = require('axios');
const DAIabi = require('../abis/DAI-abi.json');
const Heroabi = require('../abis/Hero-abi.json');

const getS3Contracts = async (network) => {
    try {
        const {data: contracts} = await axios(
            `https://blockchain-definitions.s3-eu-west-1.amazonaws.com/v3/contracts-${network}.json`
        );
        return contracts;
    } catch (error) {
        if (error.response.status !== 404) throw error;
        console.log(`No exist previous contracts-${network}.json we continue and create new one.`);
        return {};
    }
}

const getContracts = async (network) => {
    try {
        const contracts = JSON.parse(readFileSync(`./contracts-${network}.json`));
        return contracts;
    } catch (error) {
        if (error.code === 'ENOENT') {
            const contracts = await getS3Contracts(network);
            return contracts;
        }
        throw error;
    }
}

const getContractTokens = async (contracts, deployerAddress) => {
    try {
        // Check if the contract.json has the address of HeroToken and DAI
        if (contracts['HeroToken'] && contracts['HeroToken'].address) {
            // Check if deployer is owner of already deployed contracts.
            const HeroInstance = await HeroToken.at(contracts['HeroToken'].address);
            const owner = await HeroInstance.owner();

            // This will happen only when deployed bia gitlab ci
            if (owner === deployerAddress) {
                return {
                    heroTokenAddress: contracts['HeroToken'].address,
                    daiAddress: contracts['DAI'].address
                };
            }
        }
        return {};
    } catch (error) {
        console.log('Cannot create instance of Contract HeroToken, no code for address: ', contracts['HeroToken'].address);
        return {};
    }
};

const migrationInt = async (deployer, network, accounts) => {
    try {
        const deployerAddress = accounts[0];
        
        let HeroTokenAddress = '';
        let DAIAddress = '';
        let contracts = await getContracts(network);

        const oldHeroTokenBytecode = contracts['HeroToken'] ? contracts['HeroToken'].bytecode : undefined;
        const oldDAIBytecode = contracts['DAI'] ? contracts['DAI'].bytecode : undefined;

        const daiHasBeenUpdated = DAI.bytecode !== oldDAIBytecode;
        const herotokenHasBeenUpdated = HeroToken.bytecode !== oldHeroTokenBytecode;
        
        if (network !== 'development') {
            const { heroTokenAddress, daiAddress } = await getContractTokens(contracts, deployerAddress);
            
            HeroTokenAddress = heroTokenAddress;
            DAIAddress = daiAddress
            
            if (!heroTokenAddress || !daiAddress) { // deploy in kovan only if they are not deployed already
                await deployer.deploy(HeroToken, {
                    from: deployerAddress,
                    overwrite: false
                });
                await deployer.deploy(DAI, {
                    from: deployerAddress,
                    overwrite: false
                });
                
                HeroTokenAddress = HeroToken.address;
                DAIAddress = DAI.address;
            }
        } else { // Deploy a new HeroToken and DAI because in local we do not have them
            await deployer.deploy(HeroToken, {
                from: deployerAddress,
                overwrite: false
            });
            await deployer.deploy(DAI, {
                from: deployerAddress,
                overwrite: false
            });
            
            HeroTokenAddress = HeroToken.address;
            DAIAddress = DAI.address;
        }

        if (herotokenHasBeenUpdated || daiHasBeenUpdated) {
            const IntAccounts = [...new Set([...accounts, ...devAccounts])]; //unique accounts not repeated
            if (IntAccounts.length > 0) {
                console.log(`> Sending tokens to ${IntAccounts.length} accounts`, '\n');
            }
            const tokens = web3.utils.toWei('10000000', 'ether'); // 10 million tokens each user
                    
            if (herotokenHasBeenUpdated) {
                const heroDeployed = await HeroToken.at(HeroTokenAddress);
                for (let i = 0; i < IntAccounts.length; i++) {
                    await heroDeployed.mint(IntAccounts[i], tokens, {
                        from: deployerAddress,
                        gas: 800000
                    });
                }
            }
            if (daiHasBeenUpdated) {
                const daiDeployed = await DAI.at(DAIAddress);
                for (let i = 0; i < IntAccounts.length; i++) {
                    await daiDeployed.mint(IntAccounts[i], tokens, {
                        from: deployerAddress,
                        gas: 800000
                    });
                }
            }

            const data = {
                HeroToken: {
                    address: HeroTokenAddress,
                    abi: HeroToken.abi,
                    bytecode: HeroToken.bytecode
                },
                DAI: {
                    address: DAIAddress,
                    abi: DAI.abi,
                    bytecode: DAI.bytecode
                }
            };
            
            const newContracts = {
                ...contracts,
                ...data
            };

            await writeFileSync(`./contracts-${network}.json`, JSON.stringify(newContracts));
        }
    } catch (err) {
        throw err;
    }
};

const mainnetMigrationInit = async (deployer, network, accounts) => {
    try {
        const heroTokenAddress = '0x02585e4a14da274d02df09b222d4606b10a4e940'; // hardcoded address of hero token contract on mainnet,
        const daiAddress = '0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359'; // hardcoded addres of dai token contract on mainnet;

        const contracts = await getContracts(network);

        const data = {
            HeroToken: {
                address: heroTokenAddress,
                abi: Heroabi
            },
            DAI: {
                address: daiAddress,
                abi: DAIabi
            }
        };

        const newContracts = {
            ...contracts,
            ...data
        };

        await writeFileSync(`./contracts-${network}.json`, JSON.stringify(newContracts));
    } catch (error) {
        throw error;
    }
};

module.exports = async (deployer, network, accounts) => {
        console.log(`Deploying in network:: ${network}`);
    try {
        if (network !== 'mainnet') {
            await migrationInt(deployer, network, accounts);
        } else {
            await mainnetMigrationInit(deployer, network, accounts);
        }
    } catch (err) {
      // Prettier error output
        console.error(err);
        throw err;
    }
};