const _ = require('lodash');
const Deposit = artifacts.require('DepositRegistry');
const KYC = artifacts.require('KYCRegistry');
const Auth = artifacts.require('Authorization');
const devAccounts = require('../int.accounts.json');
const {writeFileSync} = require('fs');
const { getContracts } = require('../scripts/helpers');

const migrationInt = async (deployer, network, accounts) => {
    try {
        const contracts = await getContracts();
        const deployerAddress = accounts[0];
        const admin = accounts[1];
        const netId = await web3.eth.net.getId()
        const heroTokenAddress = _.get(contracts, `address.${netId}.HeroToken`);
        console.log('contracts', contracts.address)
        console.log('HERO TOKEN ADD', heroTokenAddress)
        // Contracts deployment if updated logic::
        const oldKycBytecode = _.get(contracts, `bytecode.KYC`);
        const oldDepositBytecode = _.get(contracts, `bytecode.Deposit`);
        const oldAuthBytecode = _.get(contracts, `bytecode.Auth`);

        const kycHasBeenUpdated = oldKycBytecode !== KYC.bytecode;
        const depositHasBeenUpdated = oldDepositBytecode !== Deposit.bytecode;
        const authHasBeenUpdated = oldAuthBytecode !== Auth.bytecode;

        let data = {};

        if (kycHasBeenUpdated) { // deploy all contracts that depend on kyc contract if kyc changed
            await deployer.deploy(KYC, {
                from: deployerAddress
            });
            await deployer.deploy(Deposit, heroTokenAddress, KYC.address, {
                from: deployerAddress
            });
            await deployer.deploy(Auth, KYC.address, Deposit.address, {
                from: deployerAddress
            });

            data = {
                address: {
                    [netId] : {
                        KYC: KYC.address,
                        Deposit: Deposit.address,
                        Auth: Auth.address
                    }
                },
                abi: {
                    KYC: KYC.abi,
                    Auth: Auth.abi,
                    Deposit: Deposit.abi
                },
                bytecode: {
                    KYC: KYC.bytecode,
                    Auth: Auth.bytecode,
                    Deposit: oldDepositBytecode // Don't overwrite old bytecode so in next migration referral can check the state
                }
            };
        } else if (depositHasBeenUpdated) { // deploy all contracts that depend on deposit contract if deposit changed
            console.log('|============ KYC: no changes to deploy ==============|');
            const kycAdd = _.get(contracts, `address.${netId}.KYC`)
            await deployer.deploy(Deposit, heroTokenAddress, kycAdd, {
                from: deployerAddress
            });
            await deployer.deploy(Auth, kycAdd, Deposit.address, {
                from: deployerAddress
            });

            data = {
                address: {
                    [netId] : {
                        Deposit: Deposit.address,
                        Auth: Auth.address
                    }
                },
                abi: {
                    Auth: Auth.abi,
                    Deposit: Deposit.abi
                },
                bytecode: {
                    Auth: Auth.bytecode,
                    Deposit: oldDepositBytecode // Don't overwrite old bytecode so in next migration referral can check the state
                }
            };
        } else if (authHasBeenUpdated) { // deploy auth if changed
            await deployer.deploy(Auth, contracts['KYC'].address, contracts['Deposit'].address, {
                from: deployerAddress
            });

            // Update contracts 
            data = {
                address: {
                    [netId] : {
                        Auth: Auth.address
                    }
                },
                abi: {
                    Auth: Auth.abi,
                },
                bytecode: {
                    Auth: Auth.bytecode
                }
            };
        } else {
            console.log('|============ KYC && Deposit && Auth: no changes to deploy ==============|');
        }

        if (kycHasBeenUpdated || depositHasBeenUpdated || authHasBeenUpdated) {
            if (depositHasBeenUpdated) {
                const depositDeployed = await Deposit.deployed();
                await depositDeployed.setAdministrator(admin, {from: deployerAddress});
            }

            if (kycHasBeenUpdated) {
                const kycDeployed = await KYC.deployed();
                await kycDeployed.setAdministrator(admin, {from: deployerAddress});
                
                if (network !== 'mainnet') {
                    // Add default accounts to KYC
                    const IntAccounts = [...new Set([...accounts, ...devAccounts])]; //unique accounts not repeated
                    if (IntAccounts.length > 0) {
                        console.log(`> Adding to KYC registry ${IntAccounts.length} accounts`, '\n');
                    }
                    for (let i = 0; i < IntAccounts.length; i++) {
                        await kycDeployed.addAddressToKYC(IntAccounts[i], {
                            from: admin,
                            gas: 800000
                        });
            
                        const kyced = await kycDeployed.isConfirmed(IntAccounts[i]);
                        if (kyced) {
                            console.log(`Added ${IntAccounts[i]} to KYC`);
                        } else {
                            console.log(`Error adding ${IntAccounts[i]} to KYC`);
                        }
                    }
                }
            }

            const newContracts = _.merge(contracts, data);

            await writeFileSync('./contracts.json', JSON.stringify(newContracts));
        }
    } catch (err) {
        console.error('ERROR MINT AND SEND ', err);
    }
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
