const _ = require('lodash');
const HeroToken = artifacts.require('HeroOrigenToken');
const DAI = artifacts.require('DAIFake');
const devAccounts = require('../int.accounts.json');
const DAIabi = require('../abis/DAI-abi.json');
const Heroabi = require('../abis/Hero-abi.json');
const { getContracts, contractIsUpdated } =  require('../scripts/helpers');
const { writeFileSync } = require('fs');


const getContractTokens = async (contracts, deployerAddress) => {
    try {
        const netId = await web3.eth.net.getId();
        // Check if the contract.json has the address of HeroToken and DAI
        const heroTokenAddress = _.get(contracts, `address.${netId}.HeroToken`);
        const daiAddress = _.get(contracts, `address.${netId}.DAI`);
        if (heroTokenAddress && daiAddress) {
            // Check if deployer is owner of already deployed contracts.
            const HeroInstance = await HeroToken.at(heroTokenAddress);
            const owner = await HeroInstance.owner();

            // This will happen only when deployed bia gitlab ci
            if (owner === deployerAddress) {
                return {
                    heroTokenAddress,
                    daiAddress
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
        const netId = await web3.eth.net.getId(); 
        let HeroTokenAddress = '';
        let DAIAddress = '';
        let contracts = await getContracts();
        console.log('contracts', contracts.address)

        const daiHasBeenUpdated = () => contractIsUpdated(contracts, netId, 'DAI', DAI)
        const herotokenHasBeenUpdated = () => contractIsUpdated(contracts, netId, 'HeroToken', HeroToken)
        
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
        if (herotokenHasBeenUpdated() || daiHasBeenUpdated()) {
            const currentNetId = await web3.eth.net.getId()
            const IntAccounts = [...new Set([...accounts, ...devAccounts])]; //unique accounts not repeated
            if (IntAccounts.length > 0) {
                console.log(`> Sending tokens to ${IntAccounts.length} accounts`, '\n');
            }
            const tokens = web3.utils.toWei('10000000', 'ether'); // 10 million tokens each user
                    
            if (herotokenHasBeenUpdated()) {
                const heroDeployed = await HeroToken.at(HeroTokenAddress);
                for (let i = 0; i < IntAccounts.length; i++) {
                    console.log('- Sending to', IntAccounts[i])
                    await heroDeployed.mint(IntAccounts[i], tokens, {
                        from: deployerAddress,
                        gas: 800000
                    });
                    console.log('- Sent!')
                }
            }
            if (daiHasBeenUpdated()) {
                const daiDeployed = await DAI.at(DAIAddress);
                for (let i = 0; i < IntAccounts.length; i++) {
                    console.log('- Sending to', IntAccounts[i])
                    await daiDeployed.mint(IntAccounts[i], tokens, {
                        from: deployerAddress,
                        gas: 800000
                    });
                    console.log('- Sent!')
                }
            }

            console.log('Writting Raise artifacts...')
            const data = {
                address: {
                    [currentNetId]: {
                        HeroToken: HeroTokenAddress,
                        DAI: DAIAddress
                    }
                },
                abi: {
                    HeroToken: HeroToken.abi,
                    DAI: DAI.abi,
                },
                bytecode: {
                    HeroToken: HeroToken.bytecode,
                    DAI: DAI.bytecode
                }
            };
            
           const newContracts = _.merge(contracts, data);

            await writeFileSync(`./contracts.json`, JSON.stringify(newContracts, null, 2));
        }
    } catch (err) {
        throw err;
    }
};

const mainnetMigrationInit = async (deployer, network, accounts) => {
    try {
        const constracts = await getContracts();
        const heroTokenAddress = '0x02585e4a14da274d02df09b222d4606b10a4e940'; // hardcoded address of hero token contract on mainnet,
        const daiAddress = '0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359'; // hardcoded addres of dai token contract on mainnet;
        
        const data = {
            address: {
                '1': {
                   HeroToken: heroTokenAddress,
                   DAI: daiAddress,
                }
            },
            abi: {
                HeroToken: Heroabi,
                DAI: DAIabi
            }
        };

        const newContracts = _.merge(contracts, data);

        await writeFileSync(`./contracts.json`, JSON.stringify(newContracts, null, 2));
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