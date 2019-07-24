const Deposit = artifacts.require('DepositRegistry');
const KYC = artifacts.require('KYCRegistry');
const Auth = artifacts.require('Authorization');
const ReferralTracker = artifacts.require('ReferralTracker');
const HeroToken = artifacts.require('HeroOrigenToken');
const devAccounts = require('../int.accounts.json');
const {readFileSync, writeFileSync} = require('fs');

const migrationInt = async (deployer, network, accounts) => {
    const contracts = JSON.parse(readFileSync('./contracts.json'));
    const deployerAddress = accounts[0];
    const admin = accounts[1];

    const heroTokenAddress = contracts['HeroToken'].address;
    // const daiAddress = contracts['DAI'].address;

    // Contracts deployment if updated logic::
    oldKycBytecode = contracts['KYC'].bytecode;
    oldDepositBytecode = contracts['Deposit'].bytecode;
    oldAuthBytecode = contracts['Auth'].bytecode;
    oldReferralBytecode = contracts['ReferralTracker'].bytecode;

    if (oldKycBytecode !== KYC.bytecode) { // deploy all contracts that depend on kyc contract if kyc changed
        await deployer.deploy(KYC, {
            from: deployerAddress
        });
        await deployer.deploy(Deposit, heroTokenAddress, KYC.address, {
            from: deployerAddress
        });
        await deployer.deploy(Auth, KYC.address, Deposit.address, {
            from: deployerAddress
        });
        await deployer.deploy(ReferralTracker, Deposit.address, heroTokenAddress, {
            from: deployerAddress
        });
    } else if (oldDepositBytecode !== Deposit.bytecode) { // deploy all contracts that depend on deposit contract if deposit changed
        console.log('|============ KYC: no changes to deploy ==============|');
        await deployer.deploy(Deposit, heroTokenAddress, KYC.address, {
            from: deployerAddress
        });
        await deployer.deploy(Auth, KYC.address, Deposit.address, {
            from: deployerAddress
        });
        await deployer.deploy(ReferralTracker, Deposit.address, heroTokenAddress, {
            from: deployerAddress
        });
    } else {
        console.log('|============ KYC && Deposit: no changes to deploy ==============|');
    }
    
    if (oldAuthBytecode !== Auth.bytecode) { // deploy auth if changed
        await deployer.deploy(Auth, KYC.address, Deposit.address, {
            from: deployerAddress
        });
    } else {
        console.log('|============ Auth: no changes to deploy ==============|');
    }

    if (oldReferralBytecode !== ReferralTracker.bytecode) {
        await deployer.deploy(ReferralTracker, Deposit.address, heroTokenAddress, {
            from: deployerAddress
        });
    } else {
        console.log('|============ ReferralTracker: no changes to deploy ==============|');
    }

    const data = {
        Deposit: {
            address: Deposit.address,
            abi: Deposit.abi,
            bytecode: Deposit.bytecode
        },
        KYC: {
            address: KYC.address,
            abi: KYC.abi,
            bytecode: KYC.bytecode
        },
        Auth: {
            address: Auth.address,
            abi: Auth.abi,
            bytecode: Auth.bytecode
        },
        ReferralTracker: {
			address: ReferralTracker.address,
			abi: ReferralTracker.abi,
            bytecode: ReferralTracker.bytecode
        }
    };

    // add KYC registry
    const kycDeployed = await KYC.deployed();
    const depositDeployed = await Deposit.deployed();
	const referralContract = await ReferralTracker.deployed();

    // set administrator
    await depositDeployed.setAdministrator(admin, {from: deployerAddress});
    await kycDeployed.setAdministrator(admin, {from: deployerAddress});
    await referralContract.setAdministrator(admin, {from: deployerAddress});

    // set referral to deposit contract
    await depositDeployed.setReferralTracker(referralContract.address, {
		from: deployerAddress,
		gas: 800000
	});

    // Add admin as pauser for referral contract
    const isPauser = await referralContract.isPauser(admin);
	console.log('> ADMIN IS PAUSER : ', isPauser);
	!isPauser && (await referralContract.addPauser(admin, {
		from: deployerAddress,
		gas: 800000
	}));

    if (network !== 'mainnet') { // TODO: do this in mainnet??????
        // Add default accounts to KYC
        const IntAccounts = [...new Set([...accounts, ...devAccounts])]; //unique accounts not repeated
        if (IntAccounts.length > 0) {
            console.log(`> Adding to KYC registry ${IntAccounts.length} accounts`, '\n');
        }
        try {
            for (let i = 0; i < IntAccounts.length; i++) {
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

        // add funds to referral so users can withdraw
        const tokens = web3.utils.toWei('100000', 'ether'); // 100K tokens
        const HeroInstance = await HeroToken.at(heroTokenAddress);
        await HeroInstance.approve(referralContract.address, tokens, {
            from: admin,
            gas: 800000
        });
        await referralContract.addFunds(tokens, {
            from: admin,
            gas: 800000
        });
    }

    const newContracts = {
        ...contracts,
        ...data
    };

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
