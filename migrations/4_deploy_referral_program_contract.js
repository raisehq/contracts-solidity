const Deposit = artifacts.require('DepositRegistry');
const HeroToken = artifacts.require('HeroOrigenToken');
const ReferralTracker = artifacts.require('ReferralTracker');
const {readFileSync, writeFileSync} = require('fs');

const migration = async (deployer, networks, accounts) => {
	const deployerAddress = accounts[0];
	const admin = accounts[1];

	const contracts = JSON.parse(readFileSync('./contracts.json'));

	const heroTokenAddress = contracts['HeroToken'].address;
	const depositAddress = contracts['Deposit'].address;

	await deployer.deploy(ReferralTracker, depositAddress, heroTokenAddress, {
		from: deployerAddress
	});

	const depositContract = await Deposit.deployed();
	const referralContract = await ReferralTracker.deployed();

	await depositContract.setReferralTracker(referralContract.address, {
		from: deployerAddress,
		gas: 800000
	});

	await referralContract.setAdministrator(admin, {
		from: deployerAddress,
		gas: 800000
	});

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

	const isPauser = await referralContract.isPauser(admin);
	console.log('> ADMIN IS PAUSER : ', isPauser);
	!isPauser &&
		(await referralContract.addPauser(admin, {
		from: deployerAddress,
		gas: 800000
		}));

	const newContracts = {
		...contracts,
		...{
		ReferralTracker: {
			address: ReferralTracker.address,
			abi: ReferralTracker.abi
		}
		}
	};

	await writeFileSync('./contracts.json', JSON.stringify(newContracts));
};

module.exports = async (deployer, networks, accounts) => {
	try {
		await migration(deployer, networks, accounts);
	} catch (err) {
		// Prettier error output
		console.error(err);
		throw err;
	}
};
