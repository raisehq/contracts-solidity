const DAIProxy = artifacts.require('DAIProxy');
const LoanDispatcher = artifacts.require('LoanContractDispatcher');
const {readFileSync, writeFileSync} = require('fs');

const migrationInt = async (deployer, network, accounts) => {
	const deployerAddress = accounts[0];
	const admin = accounts[1];

	const contracts = JSON.parse(readFileSync('./contracts.json'));
	const daiAddress = contracts['DAI'].address;
	const authAddress = contracts['Auth'].address;

	await deployer.deploy(DAIProxy, authAddress, daiAddress, {
		from: deployerAddress
	});

	const dispatcherArgs = [authAddress, daiAddress, DAIProxy.address];
	const dispatcherFrom = {from: deployerAddress};
	const LoanFactory = new web3.eth.Contract(LoanDispatcher.abi, null, {
		data: LoanDispatcher.bytecode
	});
	const LoanFactoryEstimatedGas = await LoanFactory.deploy({
		arguments: dispatcherArgs
	}).estimateGas(dispatcherFrom);

	await deployer.deploy(LoanDispatcher, authAddress, daiAddress, DAIProxy.address, {
		from: deployerAddress,
		gas: LoanFactoryEstimatedGas
	});

	const data = {
		DAIProxy: {
			address: DAIProxy.address,
			abi: DAIProxy.abi
		},
		LoanDispatcher: {
			address: LoanDispatcher.address,
			abi: LoanDispatcher.abi
		}
	};

	const newContracts = {
		...contracts,
		...data
	};

	// set administrator
	const dispatcherDeployed = await LoanDispatcher.deployed();
	await dispatcherDeployed.setAdministrator(admin, {from: deployerAddress});
	
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
