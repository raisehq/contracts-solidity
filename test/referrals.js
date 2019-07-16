const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const { expect } = chai;
const DepositRegistryContract = artifacts.require('DepositRegistry');
const HeroFakeTokenContract = artifacts.require('HeroFakeToken');
const ReferralTracker = artifacts.require('ReferralTracker');
const KYCContract = artifacts.require('KYCRegistry');
const truffleAssert = require('truffle-assertions');

const HeroAmount = '200000000000000000000';

contract('Referral Tracker', function (accounts) {
	let HeroToken;
	let DepositRegistry;
	let ReferralContract;
	let KYC;

	const owner = accounts[0];
	const user = accounts[1];
	const referrer = accounts[2];
	const admin = accounts[3];
	const user2 = accounts[4];
	const referrer2 = accounts[5];

	describe('referral tracker tests', () => {
		before(async () => {
			HeroToken = await HeroFakeTokenContract.new();
			KYC = await KYCContract.new();
			DepositRegistry = await DepositRegistryContract.new(HeroToken.address, KYC.address, { from: owner });
		});
		describe('Pausable tests', () => {
			beforeEach(async () => {
				try {
					ReferralContract = await ReferralTracker.new(DepositRegistry.address, HeroToken.address, { from: owner });
				} catch (error) {
					throw error;
				}
			});
			it('Expects to add pauser', async () => {
				await ReferralContract.addPauser(admin);
				const isPauser = await ReferralContract.isPauser(admin);
				expect(isPauser).to.equal(true);
			});
			it('Expects admin to be able pause the contract', async () => {
				await ReferralContract.addPauser(admin);
				await ReferralContract.pause({from:admin});
				const isPaused = await ReferralContract.paused();
				expect(isPaused).to.equal(true);
			});
			it('Expects admin to be able to unpause the contract', async () => {
				await ReferralContract.addPauser(admin);
				await ReferralContract.pause({from:admin});
				const isPaused = await ReferralContract.paused();
				expect(isPaused).to.equal(true);
				await ReferralContract.unpause({from:admin});
				const isUnpaused = await ReferralContract.paused();
				expect(isUnpaused).to.equal(false);
			});
		})
		describe('method setAdministrator', () => {
			beforeEach(async () => {
				try {
					ReferralContract = await ReferralTracker.new(DepositRegistry.address, HeroToken.address, { from: owner });
				} catch (error) {
					throw error;
				}
			});
			it('Expects to set administrator if caller is owner', async () => {
				await ReferralContract.setAdministrator(admin, {from: owner});
				const administrator = await ReferralContract.admin();
				expect(admin).to.equal(administrator);
			});
			it('Expects to fail if caller is not owner', async () => {
				await truffleAssert.fails(
					ReferralContract.setAdministrator(admin, {from: user}),
					truffleAssert.ErrorType.REVERT,
					"caller is not the owner"
				);
			})
		});
		describe('method addFunds', () => {
			beforeEach(async () => {
				try {
					ReferralContract = await ReferralTracker.new(DepositRegistry.address, HeroToken.address, { from: owner });
					await ReferralContract.setAdministrator(admin, {from: owner});
				} catch (error) {
					throw error;
				}
			});
			it('Expects to add funds if caller is admin', async () => {
				await HeroToken.transferFakeHeroTokens(admin);
				await HeroToken.approve(ReferralContract.address, HeroAmount,{ from: admin });
				await ReferralContract.addFunds(HeroAmount, {from: admin});
				const funds = Number(await HeroToken.balanceOf(ReferralContract.address));
				expect(funds).to.equal(Number(HeroAmount));
				
			});
			it('Expects to fail if caller is not admin', async () => {
				await truffleAssert.fails(
					ReferralContract.addFunds(HeroAmount, {from: owner}),
					truffleAssert.ErrorType.REVERT,
					"the caller is not the admin"
				);
			});
		});
		describe('method registerReferral', () => {
			beforeEach(async () => {
				try {
					DepositRegistry = await DepositRegistryContract.new(HeroToken.address, KYC.address, { from: owner });
					ReferralContract = await ReferralTracker.new(DepositRegistry.address, HeroToken.address, { from: owner });
					await DepositRegistry.setReferralTracker(ReferralContract.address);
				} catch (error) {
					throw error;
				}
			});
			it('Expects to fail if caller is not registry', async () => {
				await truffleAssert.fails(
					ReferralContract.registerReferral(referrer, user, {from: user}),
					truffleAssert.ErrorType.REVERT,
					"the caller is not the registry"
				);
			});
			it('Expects to add 1 to the referrer unclaimed referrals number', async () => {
				await HeroToken.transferFakeHeroTokens(user);
				await HeroToken.transferFakeHeroTokens(referrer);
				await HeroToken.approve(DepositRegistry.address, HeroAmount,{ from: user });
				await HeroToken.approve(DepositRegistry.address, HeroAmount,{ from: referrer });
				await DepositRegistry.depositFor(referrer, {from: referrer});

				await DepositRegistry.depositForWithReferral(user, referrer, { from: user });
				
				const referralCount = Number(await ReferralContract.unclaimedReferrals(referrer));
				expect(referralCount).to.equal(1); 
			});
			it('Expects to add 2 to the referrer unclaimed referrals number', async () => {
				await HeroToken.transferFakeHeroTokens(user);
				await HeroToken.transferFakeHeroTokens(user2);
				await HeroToken.transferFakeHeroTokens(referrer);
				await HeroToken.approve(DepositRegistry.address, HeroAmount,{ from: user });
				await HeroToken.approve(DepositRegistry.address, HeroAmount,{ from: user2 });
				await HeroToken.approve(DepositRegistry.address, HeroAmount,{ from: referrer });
				await DepositRegistry.depositFor(referrer, {from: referrer});

				await DepositRegistry.depositForWithReferral(user, referrer, { from: user });
				await DepositRegistry.depositForWithReferral(user2, referrer, { from: user2 });
				
				const referralCount = Number(await ReferralContract.unclaimedReferrals(referrer));
				expect(referralCount).to.equal(2); 
			});
		});
		describe('method withdraw', () => {
			beforeEach(async () => {
				try {
					DepositRegistry = await DepositRegistryContract.new(HeroToken.address, KYC.address, { from: owner });
					ReferralContract = await ReferralTracker.new(DepositRegistry.address, HeroToken.address, { from: owner });
					await DepositRegistry.setReferralTracker(ReferralContract.address);
					await ReferralContract.setAdministrator(admin, {from: owner});
					await ReferralContract.addPauser(admin);
				} catch (error) {
					throw error;
				}
			});
			it('Expects to withdraw the bonus correctly', async () => {
				await HeroToken.transferFakeHeroTokens(admin);
				await HeroToken.approve(ReferralContract.address, HeroAmount,{ from: admin });
				await ReferralContract.addFunds(HeroAmount, {from: admin});
				assert.equal(await HeroToken.balanceOf(ReferralContract.address), HeroAmount);
				
				await HeroToken.transferFakeHeroTokens(user);
				await HeroToken.transferFakeHeroTokens(referrer);
				await HeroToken.approve(DepositRegistry.address, HeroAmount,{ from: user });
				await HeroToken.approve(DepositRegistry.address, HeroAmount,{ from: referrer });
				await DepositRegistry.depositFor(referrer, {from: referrer});

				await DepositRegistry.depositForWithReferral(user, referrer, { from: user });


				await ReferralContract.withdraw(referrer, {from: referrer});

				assert.equal(await HeroToken.balanceOf(ReferralContract.address), HeroAmount/2);
				assert.equal(await HeroToken.balanceOf(referrer), HeroAmount/2);
				assert.equal(await ReferralContract.unclaimedReferrals(referrer), 0);
			});
			it('Expects to fail if user has no referrals', async () => {
				await truffleAssert.fails(
					ReferralContract.withdraw(referrer, {from: referrer}),
					truffleAssert.ErrorType.REVERT,
					"no referrals to claim"
				);
			});
			it('Expects to fail if contract does not have enough funds', async () => {
				await HeroToken.transferFakeHeroTokens(user);
				await HeroToken.transferFakeHeroTokens(referrer);
				await HeroToken.approve(DepositRegistry.address, HeroAmount,{ from: user });
				await HeroToken.approve(DepositRegistry.address, HeroAmount,{ from: referrer });
				await DepositRegistry.depositFor(referrer, {from: referrer});

				await DepositRegistry.depositForWithReferral(user, referrer, { from: user });

				await truffleAssert.fails(
					ReferralContract.withdraw(referrer, {from: referrer}),
					truffleAssert.ErrorType.REVERT,
					"Not enough funds"
				);
			});
			it('Expects to fail if contract is paused', async () => {
				await ReferralContract.pause({from: admin});
				await truffleAssert.fails(
					ReferralContract.withdraw(referrer, {from: referrer}),
					truffleAssert.ErrorType.REVERT,
					"Pausable: paused"
				);
			});
			it('Expects to fail if paused and succeed when unpaused and tried again', async () => {
				await HeroToken.transferFakeHeroTokens(admin);
				await HeroToken.approve(ReferralContract.address, HeroAmount,{ from: admin });
				await ReferralContract.addFunds(HeroAmount, {from: admin});
				
				const balance = Number(await HeroToken.balanceOf(ReferralContract.address))
				expect(balance).to.equal(Number(HeroAmount));
				
				await HeroToken.transferFakeHeroTokens(user);
				await HeroToken.transferFakeHeroTokens(referrer2);
				await HeroToken.approve(DepositRegistry.address, HeroAmount,{ from: user });
				await HeroToken.approve(DepositRegistry.address, HeroAmount,{ from: referrer2 });
				await DepositRegistry.depositFor(referrer2, {from: referrer2});
				await DepositRegistry.depositForWithReferral(user, referrer2, { from: user });
				const referrerBalanceAfterDeposit = Number(await HeroToken.balanceOf(referrer2));

				await ReferralContract.pause({from: admin});
				await truffleAssert.fails(
					ReferralContract.withdraw(referrer2, {from: referrer2}),
					truffleAssert.ErrorType.REVERT,
					"Pausable: paused"
				);
				await ReferralContract.unpause({from:admin});
				await ReferralContract.withdraw(referrer2, {from: referrer2});

				const contractBalance = Number(await HeroToken.balanceOf(ReferralContract.address));
				const referrerBalance = Number(await HeroToken.balanceOf(referrer2));
				const unclaimedReferrals = Number(await ReferralContract.unclaimedReferrals(referrer2));
				expect(referrerBalanceAfterDeposit).to.equal(0);
				expect(contractBalance).to.equal(Number(HeroAmount)/2);
				expect(referrerBalance).to.equal(Number(HeroAmount)/2);
				expect(unclaimedReferrals).to.equal(0);
			});
		});
	});
});
