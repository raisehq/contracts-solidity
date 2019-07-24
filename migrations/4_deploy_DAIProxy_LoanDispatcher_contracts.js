const DAIProxy = artifacts.require('DAIProxy');
const LoanDispatcher = artifacts.require('LoanContractDispatcher');
const {readFileSync, writeFileSync} = require('fs');

const migrationInt = async (deployer, network, accounts) => {
	const contracts = JSON.parse(readFileSync('./contracts.json'));
	const deployerAddress = accounts[0];
	const admin = accounts[1];

	const daiAddress = contracts['DAI'].address;
	const authAddress = contracts['Auth'].address;

	const oldDaiProxyByteCode = contracts['DAIProxy'].bytecode;
	const oldLoanDispatcherBytecode = contracts['LoanDispatcher'].bytecode;
	
	if (oldDaiProxyByteCode !== DAIProxy.bytecode) {
		await deployer.deploy(DAIProxy, authAddress, daiAddress, {
			from: deployerAddress
		});
		await deployer.deploy(LoanDispatcher, authAddress, daiAddress, DAIProxy.address, {
			from: deployerAddress
		});
	}
	else if (oldLoanDispatcherBytecode !== LoanDispatcher.bytecode) {
		console.log('|============ DAIProxy: no changes to deploy ==============|');
		await deployer.deploy(LoanDispatcher, authAddress, daiAddress, DAIProxy.address, {
			from: deployerAddress
		});
	} else {
		console.log('|============ DAIProxy && LoanDispatcher: no changes to deploy ==============|');
	}

	const data = {
		DAIProxy: {
			address: DAIProxy.address,
			abi: DAIProxy.abi,
			bytecode: DAIProxy.bytecode
		},
		LoanDispatcher: {
			address: LoanDispatcher.address,
			abi: LoanDispatcher.abi,
			bytecode: LoanDispatcher.bytecode
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
		if (network !== 'mainnet') {
			await migrationInt(deployer, network, accounts);
		}
	} catch (err) {
		// Prettier error output
		console.error(err);
		throw err;
	}
};
