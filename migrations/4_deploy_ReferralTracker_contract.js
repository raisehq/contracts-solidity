const _ = require('lodash');
const Deposit = artifacts.require('DepositRegistry');
const ReferralTracker = artifacts.require('ReferralTracker');
const HeroToken = artifacts.require('HeroOrigenToken');
const {writeFileSync} = require('fs');
const { getContracts, contractIsUpdated } = require('../scripts/helpers');
const Web3 = require('web3');

const loadWeb3One = () => {
    web3 = new Web3(web3.currentProvider);
}

const migrationInt = async (deployer, network, accounts) => {
    try {
        const contracts = await getContracts();
        const deployerAddress = accounts[0];
        const admin = network === 'mainnet' ? process.env.ADMIN_ADDRESS : accounts[1];
        const netId = await web3.eth.net.getId();

        const heroTokenAddress = _.get(contracts, `address.${netId}.HeroToken`);
        const depositAddress = _.get(contracts, `address.${netId}.Deposit`);
        const depositAbi = _.get(contracts, `abi.Deposit`);
        const depositBytecode = _.get(contracts, `bytecode.Deposit`);

        const depositHasBeenUpdated = () => contractIsUpdated(contracts, netId, 'Deposit', Deposit);
        const referralHasBeenUpdated = () => contractIsUpdated(contracts, netId, 'ReferralTracker', ReferralTracker);
        
        if (referralHasBeenUpdated() || depositHasBeenUpdated()) {
            await deployer.deploy(ReferralTracker, depositAddress, heroTokenAddress, {
                from: deployerAddress
            });

            const depositDeployed = await Deposit.at(depositAddress);
            const referralContract = await ReferralTracker.deployed();
    
            await depositDeployed.setReferralTracker(referralContract.address, {
                from: deployerAddress,
                gas: 800000
            });
            

            if (referralHasBeenUpdated()) {
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
                        Deposit: depositAddress,
                        ReferralTracker: ReferralTracker.address
                    }
                },
                abi: {
                    Deposit: depositAbi,
                    ReferralTracker: ReferralTracker.abi
                },
                bytecode: {
                    Deposit: depositBytecode,
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
        loadWeb3One();
        deployer.then(async () => {
            await migrationInt(deployer, network, accounts);
        });
    } catch (err) {
        // Prettier error output
        console.error(err);
        throw err;
    }
};
