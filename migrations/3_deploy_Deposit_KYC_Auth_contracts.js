const Deposit = artifacts.require('DepositRegistry');
const KYC = artifacts.require('KYCRegistry');
const Auth = artifacts.require('Authorization');
const devAccounts = require('../int.accounts.json');
const {readFileSync, writeFileSync} = require('fs');

const migrationInt = async (deployer, network, accounts) => {
    try {
        const contracts = JSON.parse(readFileSync(`./contracts-${network}.json`));
        const deployerAddress = accounts[0];
        const admin = accounts[1];

        const heroTokenAddress = contracts['HeroToken'].address;

        // Contracts deployment if updated logic::
        const oldKycBytecode = contracts['KYC'] ? contracts['KYC'].bytecode : undefined;
        const oldDepositBytecode = contracts['Deposit'] ? contracts['Deposit'].bytecode : undefined;
        const oldAuthBytecode = contracts['Auth'] ? contracts['Auth'].bytecode : undefined;

        const kycHasBeenUpdated = oldKycBytecode !== KYC.bytecode;
        const depositHasBeenUpdated = oldDepositBytecode !== Deposit.bytecode;
        const authHasBeenUpdated = oldAuthBytecode !== Auth.bytecode;

        const data = {};

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

            // Update contracts 
            data.KYC = {
                address: KYC.address,
                abi: KYC.abi,
                bytecode: KYC.bytecode
            };
            data.Deposit = {
                address: Deposit.address,
                abi: Deposit.abi,
                bytecode: oldDepositBytecode // Don't overwrite old bytecode so in next migration referral can check the state
            };
            data.Auth = {
                address: Auth.address,
                abi: Auth.abi,
                bytecode: Auth.bytecode
            };
        } else if (depositHasBeenUpdated) { // deploy all contracts that depend on deposit contract if deposit changed
            console.log('|============ KYC: no changes to deploy ==============|');
            await deployer.deploy(Deposit, heroTokenAddress, contracts['KYC'].address, {
                from: deployerAddress
            });
            await deployer.deploy(Auth, contracts['KYC'].address, Deposit.address, {
                from: deployerAddress
            });

            // Update contracts 
            data.Deposit = {
                address: Deposit.address,
                abi: Deposit.abi,
                bytecode: oldDepositBytecode // Don't overwrite old bytecode so in next migration referral can check the state
            };
            data.Auth = {
                address: Auth.address,
                abi: Auth.abi,
                bytecode: Auth.bytecode
            };
        } else if (authHasBeenUpdated) { // deploy auth if changed
            await deployer.deploy(Auth, contracts['KYC'].address, contracts['Deposit'].address, {
                from: deployerAddress
            });

            // Update contracts 
            data.Auth = {
                address: Auth.address,
                abi: Auth.abi,
                bytecode: Auth.bytecode
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

            const newContracts = {
                ...contracts,
                ...data
            };

            await writeFileSync(`./contracts-${network}.json`, JSON.stringify(newContracts));
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
