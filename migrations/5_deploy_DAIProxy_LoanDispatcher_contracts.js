const DAIProxy = artifacts.require('DAIProxy');
const LoanDispatcher = artifacts.require('LoanContractDispatcher');
const {readFileSync, writeFileSync} = require('fs');

const migrationInt = async (deployer, network, accounts) => {
	const contracts = JSON.parse(readFileSync(`./contracts-${network}.json`));
	const deployerAddress = accounts[0];
	const admin = accounts[1];

	const daiAddress = contracts['DAI'].address;
	const authAddress = contracts['Auth'].address;

	const oldDaiProxyByteCode = contracts['DAIProxy'] ? contracts['DAIProxy'].bytecode : undefined;
	const oldLoanDispatcherBytecode = contracts['LoanDispatcher'] ? contracts['LoanDispatcher'].bytecode : undefined;

	const daiproxyHasBeenUpdated = oldDaiProxyByteCode !== DAIProxy.bytecode;
	const loandispatcherHasBeenUpdated = oldLoanDispatcherBytecode !== LoanDispatcher.bytecode
	
	const data = {};

	if (daiproxyHasBeenUpdated) {
		await deployer.deploy(DAIProxy, authAddress, daiAddress, {
			from: deployerAddress
		});
		await deployer.deploy(LoanDispatcher, authAddress, daiAddress, DAIProxy.address, {
			from: deployerAddress
		});

        // Update contracts 
		data.DAIProxy = {
			address: DAIProxy.address,
			abi: DAIProxy.abi,
			bytecode: DAIProxy.bytecode
		};
		data.LoanDispatcher = {
			address: LoanDispatcher.address,
			abi: LoanDispatcher.abi,
			bytecode: LoanDispatcher.bytecode
		};
	}
	else if (loandispatcherHasBeenUpdated) {
		console.log('|============ DAIProxy: no changes to deploy ==============|');
		await deployer.deploy(LoanDispatcher, authAddress, daiAddress, contracts['DAIProxy'].address, {
			from: deployerAddress
		});
		
        // Update contracts 
		data.LoanDispatcher = {
			address: LoanDispatcher.address,
			abi: LoanDispatcher.abi,
			bytecode: LoanDispatcher.bytecode
		};
	} else {
		console.log('|============ DAIProxy && LoanDispatcher: no changes to deploy ==============|');
	}

	if (loandispatcherHasBeenUpdated || daiproxyHasBeenUpdated) {
		if (loandispatcherHasBeenUpdated) {
			// set administrator
			const dispatcherDeployed = await LoanDispatcher.deployed();
			await dispatcherDeployed.setAdministrator(admin, {from: deployerAddress});
		}
		
		const newContracts = {
			...contracts,
			...data
		};
		
		await writeFileSync(`./contracts-${network}.json`, JSON.stringify(newContracts));
	}
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
