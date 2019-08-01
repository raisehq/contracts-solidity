const _ = require('lodash');
const DAIProxy = artifacts.require('DAIProxy');
const LoanDispatcher = artifacts.require('LoanContractDispatcher');
const {writeFileSync} = require('fs');
const { getContracts } = require('../scripts/helpers');

const migrationInt = async (deployer, network, accounts) => {
	const contracts = await getContracts();
	const netId = await web3.eth.net.getId();
	const deployerAddress = accounts[0];
	const admin = accounts[1];

	const daiAddress = _.get(contracts, `address.${netId}.DAI`);
	const authAddress =_.get(contracts, `address.${netId}.Auth`);

	const oldDaiProxyByteCode = _.get(contracts, 'bytecode.DAIProxy');
	const oldLoanDispatcherBytecode = _.get(contracts, 'bytecode.LoanDispatcher');

	const daiproxyHasBeenUpdated = oldDaiProxyByteCode !== DAIProxy.bytecode;
	const loandispatcherHasBeenUpdated = oldLoanDispatcherBytecode !== LoanDispatcher.bytecode
	
	let data = {};

	if (daiproxyHasBeenUpdated) {
		await deployer.deploy(DAIProxy, authAddress, daiAddress, {
			from: deployerAddress
		});
		await deployer.deploy(LoanDispatcher, authAddress, daiAddress, DAIProxy.address, {
			from: deployerAddress
		});

        // Update contracts 
		data = {
			address: {
				[netId]: {
					DAIProxy: DAIProxy.address,
					LoanDispatcher: LoanDispatcher.address,
				}
			},
			abi: {
				DAIProxy: DAIProxy.abi,
				LoanDispatcher: LoanDispatcher.abi
			},
			bytecode: {
				DAIProxy: DAIProxy.bytecode,
				LoanDispatcher: LoanDispatcher.bytecode
			}
		};
	}
	else if (loandispatcherHasBeenUpdated) {
		console.log('|============ DAIProxy: no changes to deploy ==============|');

		const DAIProxyAddress = _.get(contracts, `address.${netId}.DAIProxy`)
		
		await deployer.deploy(LoanDispatcher, authAddress, daiAddress, DAIProxyAddress, {
			from: deployerAddress
		});
		
		data = {
			address: {
				[netId]: {
					LoanDispatcher: LoanDispatcher.address,
				}
			},
			abi: {
				LoanDispatcher: LoanDispatcher.abi
			},
			bytecode: {
				LoanDispatcher: LoanDispatcher.bytecode
			}
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
		
		const newContracts = _.merge(contracts, data);
		
		await writeFileSync('./contracts.json', JSON.stringify(newContracts));
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
