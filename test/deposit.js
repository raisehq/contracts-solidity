const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const { expect } = chai;
const DepositRegistryContract = artifacts.require('DepositRegistry');
const HeroFakeTokenContract = artifacts.require('HeroFakeToken');
const KYCContract = artifacts.require('KYCRegistry');
const ReferralTrackerContract = artifacts.require('ReferralTracker');
const truffleAssert = require('truffle-assertions');

const HeroAmount = '200000000000000000000';


contract('Deposit Contract', function (accounts) {
	let HeroToken;
	let DepositRegistry;
	let ReferralTracker;
	let KYC;

	const owner = accounts[0];
	const user = accounts[1];
	const admin = accounts[2];
	const referrer = accounts[3];


	describe('Deposit Registry', () => {
		before(async () =>  {
			try{
				HeroToken = await HeroFakeTokenContract.new();
				KYC = await KYCContract.new({from: owner});
				await KYC.setAdministrator(admin);
			}catch(error){
				throw error;
			}
		});
		describe('method setAdministrator', () => {
			before(async () => {
				DepositRegistry = await DepositRegistryContract.new(HeroToken.address, KYC.address,  { from: owner });
				await HeroToken.transferFakeHeroTokens(user);
			});
			it('Expects to set administrator if caller is owner', async () => {
				await DepositRegistry.setAdministrator(admin, {from: owner});
				const administrator = await DepositRegistry.admin();
				expect(admin).to.equal(administrator);
			});
			it('Expects to fail if caller is not owner', async () => {
				await truffleAssert.fails(
					DepositRegistry.setAdministrator(admin, {from: user}),
					truffleAssert.ErrorType.REVERT,
					"caller is not the owner"
				);
			})
		});
		describe('method setReferralTracker', () => {
			before(async () => {
				DepositRegistry = await DepositRegistryContract.new(HeroToken.address, KYC.address,  { from: owner });
				await HeroToken.transferFakeHeroTokens(user);
			});
			it('Expects to set referral tracker if owner', async () => {
				ReferralTracker = await ReferralTrackerContract.new(DepositRegistry.address, HeroToken.address);
				await DepositRegistry.setReferralTracker(ReferralTracker.address, {from: owner});
				const ref = await DepositRegistry.ref();
				expect(ref).to.equal(ReferralTracker.address); 
			});
			it('Expects to not set referral tracker if not owner', async () => {
				await truffleAssert.fails(
					DepositRegistry.setReferralTracker(admin, {from: user}),
					truffleAssert.ErrorType.REVERT,
					"caller is not the owner"
				);
			});
		});
		describe('method hasDeposited', () => {
			beforeEach(async () => {
				DepositRegistry = await DepositRegistryContract.new(HeroToken.address, KYC.address,  { from: owner });
				await HeroToken.transferFakeHeroTokens(user);
			});
			it('Expects to get true if user has deposited', async () => {
				await HeroToken.transferFakeHeroTokens(user);
				await HeroToken.approve(DepositRegistry.address, HeroAmount,{ from: user });
				await DepositRegistry.depositFor(user, { from: user });
				const deposited = await DepositRegistry.hasDeposited(user);
				expect(deposited).to.equal(true);
			});
			it('Expects to get false if user has not deposited', async () => {
				const deposited = await DepositRegistry.hasDeposited(user);
				expect(deposited).to.equal(false);
			});
		});
		describe('method depositFor', () => {
			beforeEach(async () => {
				DepositRegistry = await DepositRegistryContract.new(HeroToken.address, KYC.address,  { from: owner });
				await HeroToken.transferFakeHeroTokens(user);
			});
			it('Expects the deposit to be done if no deposited and has amount aproved', async () => {
				try{
					await HeroToken.approve(DepositRegistry.address, HeroAmount,{ from: user });
					await DepositRegistry.depositFor(user, { from: user });
					const deposited =  await DepositRegistry.hasDeposited(user);
					const balance = Number(await HeroToken.balanceOf(DepositRegistry.address));

					expect(deposited).to.equal(true);
					expect(balance).to.equal(Number(HeroAmount));
				} catch(error){
					throw error;
				}
			});
			it('Expects to fail when address already deposited', async () => {
				await HeroToken.approve(DepositRegistry.address, HeroAmount,{ from: user });
				await DepositRegistry.depositFor(user, { from: user });
				await truffleAssert.fails(
					DepositRegistry.depositFor(user, {from: user}),
					truffleAssert.ErrorType.REVERT,
					"already deposited"
				);
			});
			it('Expects to fail when amount not approved', async () => {
				await truffleAssert.fails(
					DepositRegistry.depositFor(user, {from: user}),
					truffleAssert.ErrorType.REVERT,
					"address not approved amount"
				);
			});
		});
		describe('method depositForWithReferral', () => {
			beforeEach(async () => {
				DepositRegistry = await DepositRegistryContract.new(HeroToken.address, KYC.address,  { from: owner });
				ReferralTracker = await ReferralTrackerContract.new(DepositRegistry.address, HeroToken.address);
				await DepositRegistry.setReferralTracker(ReferralTracker.address, {from: owner});
				await HeroToken.transferFakeHeroTokens(user);
				await HeroToken.transferFakeHeroTokens(referrer);
			});
			it('Expects deposit to be done correctly', async() => {
				try {
					await HeroToken.approve(DepositRegistry.address, HeroAmount, { from: user });
					await HeroToken.approve(DepositRegistry.address, HeroAmount, { from: referrer });
					await DepositRegistry.depositFor(referrer, { from: referrer });
					await DepositRegistry.depositForWithReferral(user, referrer, { from: user });

					const deposited = await DepositRegistry.hasDeposited(user);
					const balance = Number(await HeroToken.balanceOf(DepositRegistry.address));
					expect(deposited).to.equal(true);
					expect(balance).to.equal(Number(HeroAmount)* 2);
				} catch (error) {
					expect(error).to.equal(undefined);
				}
			});
			it('Expects deposit to fail if referrer has not deposited', async () => {
				await HeroToken.approve(DepositRegistry.address, HeroAmount, { from: user });
				await truffleAssert.fails(
					DepositRegistry.depositForWithReferral(user, referrer, {from: user}),
					truffleAssert.ErrorType.REVERT,
					"referrer has not deposited"
				);
			});
			it('Expects deposit to fail if user already deposited', async () => {
				await HeroToken.approve(DepositRegistry.address, HeroAmount, { from: user });
				await HeroToken.approve(DepositRegistry.address, HeroAmount, { from: referrer });
				await DepositRegistry.depositFor(referrer, { from: referrer });
				await DepositRegistry.depositFor(user, { from: user });

				await truffleAssert.fails(
					DepositRegistry.depositForWithReferral(user, referrer, {from: user}),
					truffleAssert.ErrorType.REVERT,
					"alredy deposited"
				);
			});
			it('Expects deposit to fail if user has not approved amount', async () => {
				await HeroToken.approve(DepositRegistry.address, HeroAmount, { from: referrer });
				await DepositRegistry.depositFor(referrer, { from: referrer });

				await truffleAssert.fails(
					DepositRegistry.depositForWithReferral(user, referrer, {from: user}),
					truffleAssert.ErrorType.REVERT,
					"address not approved amount"
				);
			});
			it('Expects deposit to fail if address and caller are not the same', async ()=> {
				await HeroToken.approve(DepositRegistry.address, HeroAmount, { from: user });
				await HeroToken.approve(DepositRegistry.address, HeroAmount, { from: referrer });
				await DepositRegistry.depositFor(referrer, { from: referrer });
				await truffleAssert.fails(
					DepositRegistry.depositForWithReferral(user, referrer, {from: owner}),
					truffleAssert.ErrorType.REVERT,
					"cannot deposit with a referral from another address"
				);
			});
		});
		describe('method withdraw', () => {
			beforeEach(async () => {
				DepositRegistry = await DepositRegistryContract.new(HeroToken.address, KYC.address,  { from: owner });
				await HeroToken.transferFakeHeroTokens(user);
			});
			it('Expect to fail if funds have not been previously deposited', async () => {
				await truffleAssert.fails(
					DepositRegistry.withdraw(user, {from: owner}),
					truffleAssert.ErrorType.REVERT,
					"address not deposited"
				);
			});
			it('Expect to fail if lender is not verified or not unlocked', async () => {
				await HeroToken.approve(DepositRegistry.address, HeroAmount, { from: user });
				await DepositRegistry.depositFor(user, { from: user });

				const deposited = await DepositRegistry.hasDeposited(user);
				expect(deposited).to.equal(true);
				await truffleAssert.fails(
					DepositRegistry.withdraw(user, {from: user}),
					truffleAssert.ErrorType.REVERT,
					"cannot withdraw without KYC or unlocked"
				);
			});
			it('Expects to be able to withdraw if caller is verified', async () => {
				await HeroToken.approve(DepositRegistry.address, HeroAmount, { from: user });
				const balanceBefore = Number(await HeroToken.balanceOf(user));
				await DepositRegistry.depositFor(user, { from: user });
				await KYC.addAddressToKYC(user, {from: admin});

				const deposited = await DepositRegistry.hasDeposited(user);
				expect(deposited).to.equal(true);
				await DepositRegistry.withdraw(user, {from:user});

				const balanceAfter = Number(await HeroToken.balanceOf(user));
				const deposit = await DepositRegistry.hasDeposited(user);
				
				expect(balanceBefore).to.equal(balanceAfter);
				expect(deposit).to.equal(false);
			});
			it('Expects to be able to withdraw if caller is unblocked', async () => {
				await DepositRegistry.setAdministrator(admin, {from:owner});
				await HeroToken.approve(DepositRegistry.address, HeroAmount, { from: user });
				const balanceBefore = Number(await HeroToken.balanceOf(user));
				await DepositRegistry.depositFor(user, { from: user });
				
				await DepositRegistry.unlockAddressForWithdrawal(user, {from: admin});

				await DepositRegistry.withdraw(user, {from:user});

				const balanceAfter = Number(await HeroToken.balanceOf(user));
				const deposit = await DepositRegistry.hasDeposited(user);
				
				expect(balanceBefore).to.equal(balanceAfter);
				expect(deposit).to.equal(false);
			});
		});
		describe('method unlockAddressForWithdrawal', () => {
			beforeEach(async () => {
				DepositRegistry = await DepositRegistryContract.new(HeroToken.address, KYC.address,  { from: owner });
				await HeroToken.transferFakeHeroTokens(user);
				await DepositRegistry.setAdministrator(admin);
			});
			it('Expects to fail if caller is not admin', async () => {
				await truffleAssert.fails(
					DepositRegistry.unlockAddressForWithdrawal(user, {from: owner}),
					truffleAssert.ErrorType.REVERT,
					"caller is not the admin"
				);
			});
			it('Expects to fail if addres has not deposited beforehand', async () => {
				await HeroToken.approve(DepositRegistry.address, HeroAmount, { from: user });
				
				await truffleAssert.fails(
					DepositRegistry.unlockAddressForWithdrawal(user, {from: admin}),
					truffleAssert.ErrorType.REVERT,
					"address has not deposited"
				);
			});
			it('Expects to unlock address correctly', async () => {
				await HeroToken.approve(DepositRegistry.address, HeroAmount, { from: user });
				await DepositRegistry.depositFor(user, { from: user });
				
				await DepositRegistry.unlockAddressForWithdrawal(user, {from:admin});
				const unlocked = await DepositRegistry.isUnlocked(user);
				
				expect(unlocked).to.equal(true);
			});
		});
	});
});
