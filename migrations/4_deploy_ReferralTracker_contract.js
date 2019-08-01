const _ = require('lodash');
const Deposit = artifacts.require('DepositRegistry');
const ReferralTracker = artifacts.require('ReferralTracker');
const HeroToken = artifacts.require('HeroOrigenToken');
const {writeFileSync} = require('fs');
const { getContracts, contractIsUpdated } = require('../scripts/helpers');

const migrationInt = async (deployer, network, accounts) => {
    try {
        const contracts = await getContracts();
        const deployerAddress = accounts[0];
        const admin = accounts[1];
        const netId = await web3.eth.net.getId();

        const heroTokenAddress = _.get(contracts, `address.${netId}.HeroToken`);

        const depositHasBeenUpdated = () => contractIsUpdated(contracts, netId, 'Deposit', Deposit);
        const referralHasBeenUpdated = () => contractIsUpdated(contracts, netId, 'ReferraTracker', ReferralTracker);
        
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
                address: {
                    [netId]: {
                        Deposit: Deposit.address,
                        ReferralTracker: ReferralTracker.address
                    }
                },
                abi: {
                    Deposit: Deposit.abi,
                    ReferralTracker: ReferralTracker.abi
                },
                bytecode: {
                    Deposit: Deposit.bytecode,
                    ReferralTracker: ReferralTracker.bytecode
                }
            };

            const newContracts = _.merge(contracts, data)

            await writeFileSync('./contracts.json', JSON.stringify(newContracts));
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