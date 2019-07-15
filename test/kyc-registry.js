const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const { expect } = chai;
const KYCContract = artifacts.require('KYCRegistry');
const truffleAssert = require('truffle-assertions');

contract('KYC Registry', function (accounts) {
	let KYC;

	const owner = accounts[0];
	const user = accounts[1];
	const admin = accounts[2];

	describe('KYC Registry tests', () => {
		describe('method setAddministrator', () => {
			before(async () => {
				try {
					KYC = await KYCContract.new();
				} catch (error) {
					throw error;
				}
			});
			it('Expects to set admin if owner', async () => {
				await KYC.setAdministrator(admin, {from: owner});
				const administrator = await KYC.admin();
				expect(admin).to.equal(administrator);
			});
			it('Expects to not set admin if caller is not owner', async () => {
				await truffleAssert.fails(
					KYC.setAdministrator(admin, {from: user}),
					truffleAssert.ErrorType.REVERT,
					"caller is not the owner"
				);
			});
		});
		describe('Method removeAddressFromKYC', () => {
			beforeEach(async () => {
				try {
					KYC = await KYCContract.new();
					await KYC.setAdministrator(admin, {from: owner});
				} catch (error) {
					throw error;
				}
			});
			it('Expects to remove address from kyc if caller is admin', async () => {
				await KYC.addAddressToKYC(user, {from: admin});
				await KYC.removeAddressFromKYC(user, {from: admin});
				const userKYC = await KYC.KYCConfirmed(user);
				expect(userKYC).to.equal(false);
			});
			it('Expects to not remove address from kyc if caller is not admin', async () => {
				await KYC.addAddressToKYC(user, {from: admin});
				await truffleAssert.fails(
					KYC.removeAddressFromKYC(user, {from: owner}),
					truffleAssert.ErrorType.REVERT,
					"caller is not the admin"
				);
			});
			it('Expects to fail if address is not in kyc', async () => {
				await truffleAssert.fails(
					KYC.removeAddressFromKYC(user, {from: admin}),
					truffleAssert.ErrorType.REVERT,
					"Address not KYCed"
				);
			});
		});
		describe('Method addAddressToKYC', () => {
			beforeEach(async () => {
				try {
					KYC = await KYCContract.new();
					await KYC.setAdministrator(admin, {from: owner});
				} catch (error) {
					throw error;
				}
			});
			it('Expects to add address from kyc if caller is admin', async () => {
				const userKYC = await KYC.KYCConfirmed(user);
				await KYC.addAddressToKYC(user, {from: admin});
				const userAdded = await KYC.KYCConfirmed(user);
				expect(userKYC).to.equal(false);
				expect(userAdded).to.equal(true);
			});
			it('Expects to not add address from kyc if caller is not admin', async () => {
				await truffleAssert.fails(
					KYC.addAddressToKYC(user, {from: owner}),
					truffleAssert.ErrorType.REVERT,
					"caller is not the admin"
				);
			});
			it('Expects to fail if address is already in kyc', async () => {
				await KYC.addAddressToKYC(user, {from: admin});
				await truffleAssert.fails(
					KYC.addAddressToKYC(user, {from: admin}),
					truffleAssert.ErrorType.REVERT,
					"Address already KYCed"
				);
			});
		});
		describe('method isConfirmed', () => {
			before(async () => {
				try {
					KYC = await KYCContract.new();
					await KYC.setAdministrator(admin, {from: owner});
				} catch (error) {
					throw error;
				}
			});
			it('Expects to return false if address is not in kyc', async () => {
				const inKYC = await KYC.isConfirmed(user);
				expect(inKYC).to.equal(false);
			});
			it('Expects to return true if address is in kyc', async () => {
				await KYC.addAddressToKYC(user, {from: admin});
				const inKYC = await KYC.isConfirmed(user);
				expect(inKYC).to.equal(true);
			});
		})
	});
});
