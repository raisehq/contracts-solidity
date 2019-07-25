const Deposit = artifacts.require('DepositRegistry');
const ReferralTracker = artifacts.require('ReferralTracker');
const HeroToken = artifacts.require('HeroOrigenToken');
const {readFileSync, writeFileSync} = require('fs');

const migrationInt = async (deployer, network, accounts) => {
    try {
        const contracts = JSON.parse(readFileSync(`./contracts-${network}.json`));
        const deployerAddress = accounts[0];
        const admin = accounts[1];

        const heroTokenAddress = contracts['HeroToken'].address;

        // Contracts deployment if updated logic::
        const oldDepositBytecode = contracts['Deposit'] ? contracts['Deposit'].bytecode : undefined;
        const oldReferralBytecode = contracts['ReferralTracker'] ? contracts['ReferralTracker'].bytecode : undefined;

        const depositHasBeenUpdated = oldDepositBytecode !== Deposit.bytecode;
        const referralHasBeenUpdated = oldReferralBytecode !== ReferralTracker.bytecode;
        
        if (referralHasBeenUpdated || depositHasBeenUpdated) {
            await deployer.deploy(ReferralTracker, Deposit.address, heroTokenAddress, {
                from: deployerAddress
            });

            const depositDeployed = await Deposit.deployed();
            const referralContract = await ReferralTracker.deployed();
    
            await depositDeployed.setReferralTracker(referralContract.address, {
                from: deployerAddress,
                gas: 800000
            });
            

            if (referralHasBeenUpdated) {
                // set administrator
                await referralContract.setAdministrator(admin, {from: deployerAddress});

                // Add admin as pauser for referral contract
                const isPauser = await referralContract.isPauser(admin);
                console.log('> ADMIN IS PAUSER : ', isPauser);
                !isPauser && (await referralContract.addPauser(admin, {
                    from: deployerAddress,
                    gas: 800000
                }));

                if (network !== 'mainnet') {
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
            }

            const data = {
                Deposit: {
                    address: Deposit.address,
                    abi: Deposit.abi,
                    bytecode: Deposit.bytecode
                },
                ReferralTracker: {
                    address: ReferralTracker.address,
                    abi: ReferralTracker.abi,
                    bytecode: ReferralTracker.bytecode
                }
            };

            const newContracts = {
                ...contracts,
                ...data
            };

            await writeFileSync(`./contracts-${network}.json`, JSON.stringify(newContracts));
        } else {
            console.log('|============ ReferralTracker: no changes to deploy ==============|');
        }
    } catch (error) {
        throw error;
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
