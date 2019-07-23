const Deposit = artifacts.require('DepositRegistry');
const KYC = artifacts.require('KYCRegistry');
const Auth = artifacts.require('Authorization');
const devAccounts = require('../int.accounts.json');
const {readFileSync, writeFileSync} = require('fs');

const migrationInt = async (deployer, network, accounts) => {
    const contracts = JSON.parse(readFileSync('./contracts.json'));
    const deployerAddress = accounts[0];
    const admin = accounts[1];

    const heroTokenAddress = contracts['HeroToken'].address;
    const daiAddress = contracts['DAI'].address;
    console.log('after check hero and dai', heroTokenAddress, daiAddress);

    await deployer.deploy(KYC, {
        from: deployerAddress
    
    });

    await deployer.deploy(Deposit, heroTokenAddress, KYC.address, {
        from: deployerAddress
    
    });

    await deployer.deploy(Auth, KYC.address, Deposit.address, {
        from: deployerAddress
    
    });

    const data = {
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
        }
    };

    // add KYC registry
    const kycDeployed = await KYC.deployed();
    const depositDeployed = await Deposit.deployed();

    // set administrator
    await depositDeployed.setAdministrator(admin, {from: deployerAddress});
    await kycDeployed.setAdministrator(admin, {from: deployerAddress});

    const IntAccounts = [...new Set([...accounts, ...devAccounts])]; //unique accounts not repeated

    if (IntAccounts.length > 0) {
        console.log(`> Sending tokens and adding to KYC registry ${IntAccounts.length} accounts`, '\n');
    }
    try {
        for (let i = 0; i < IntAccounts.length; i++) {
            // ADD ADDRESS TO KYC

            const inKyc = await kycDeployed.isConfirmed(IntAccounts[i]);
            
            if (inKyc) {
                console.log(`Already in ${IntAccounts[i]} to KYC`);
            } else {
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
    } catch (err) {
        console.error('ERROR MINT AND SEND ', err);
    }

    const newContracts = {
        ...contracts,
        ...data
    }

    await writeFileSync('./contracts.json', JSON.stringify(newContracts));
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
