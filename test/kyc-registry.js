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
		describe('Method remove', () => {
			before(async () => {
				try {
					KYC = await KYCContract.new();
				} catch (error) {
					throw error;
				}
			});
			it('Expects to remove address from kyc if caller is owner', async () => {
				await KYC.add(user, {from: owner});
				await KYC.remove(user, {from: owner});
				const userKYC = await KYC.KYCConfirmed(user);
				expect(userKYC).to.equal(false);
			});
			it('Expects to not remove address from kyc if caller is not owner', async () => {
				await KYC.add(user, {from: owner});
				await truffleAssert.fails(
					KYC.remove(admin, {from: user}),
					truffleAssert.ErrorType.REVERT,
					"caller is not the owner"
				);
			});
		});
		describe('Method add', () => {
			before(async () => {
				try {
					KYC = await KYCContract.new();
				} catch (error) {
					throw error;
				}
			});
			it('Expects to add address from kyc if caller is owner', async () => {
				const userKYC = await KYC.KYCConfirmed(user);
				await KYC.add(user, {from: owner});
				const userAdded = await KYC.KYCConfirmed(user);
				expect(userKYC).to.equal(false);
				expect(userAdded).to.equal(true);
			});
			it('Expects to not add address from kyc if caller is not owner', async () => {
				await truffleAssert.fails(
					KYC.add(user, {from: user}),
					truffleAssert.ErrorType.REVERT,
					"caller is not the owner"
				);
			});
		});
		describe('Method removeAddressFromKYCAdmin', () => {
			beforeEach(async () => {
				try {
					KYC = await KYCContract.new();
					await KYC.setAdministrator(admin, {from: owner});
				} catch (error) {
					throw error;
				}
			});
			it('Expects to remove address from kyc if caller is admin', async () => {
				await KYC.add(user, {from: owner});
				await KYC.removeAddressFromKYCAdmin(user, {from: admin});
				const userKYC = await KYC.KYCConfirmed(user);
				expect(userKYC).to.equal(false);
			});
			it('Expects to not remove address from kyc if caller is not admin', async () => {
				await KYC.add(user, {from: owner});
				await truffleAssert.fails(
					KYC.removeAddressFromKYCAdmin(user, {from: owner}),
					truffleAssert.ErrorType.REVERT,
					"caller is not the admin"
				);
			});
			it('Expects to fail if address is not in kyc', async () => {
				await truffleAssert.fails(
					KYC.removeAddressFromKYCAdmin(user, {from: admin}),
					truffleAssert.ErrorType.REVERT,
					"Address not KYCed"
				);
			});
		});
		describe('Method addAddressToKYCAdmin', () => {
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
				await KYC.addAddressToKYCAdmin(user, {from: admin});
				const userAdded = await KYC.KYCConfirmed(user);
				expect(userKYC).to.equal(false);
				expect(userAdded).to.equal(true);
			});
			it('Expects to not add address from kyc if caller is not admin', async () => {
				await truffleAssert.fails(
					KYC.addAddressToKYCAdmin(user, {from: owner}),
					truffleAssert.ErrorType.REVERT,
					"caller is not the admin"
				);
			});
			it('Expects to fail if address is already in kyc', async () => {
				await KYC.addAddressToKYCAdmin(user, {from: admin});
				await truffleAssert.fails(
					KYC.addAddressToKYCAdmin(user, {from: admin}),
					truffleAssert.ErrorType.REVERT,
					"Address already KYCed"
				);
			});
		});
		describe('method isConfirmed', () => {
			before(async () => {
				try {
					KYC = await KYCContract.new();
				} catch (error) {
					throw error;
				}
			});
			it('Expects to return false if address is not in kyc', async () => {
				const inKYC = await KYC.isConfirmed(user);
				expect(inKYC).to.equal(false);
			});
			it('Expects to return true if address is in kyc', async () => {
				await KYC.add(user, {from: owner});
				const inKYC = await KYC.isConfirmed(user);
				expect(inKYC).to.equal(true);
			});
		})
	});
});
