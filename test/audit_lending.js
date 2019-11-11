const DepositContract = artifacts.require('DepositRegistry.sol');
const ReferralTrackerContract = artifacts.require('ReferralTracker.sol');
const HeroTokenContract = artifacts.require('HeroFakeToken.sol');
const KYCContract = artifacts.require('KYCRegistry.sol');
const Authorization = artifacts.require('Authorization.sol');
const LoanContractDispatcher = artifacts.require('LoanContractDispatcher.sol');
const LoanContract = artifacts.require('LoanContractTest.sol');
const DAIProxy = artifacts.require('DAIProxy.sol');
const Utils = require('./audit_utils');
const BigNumber = require('bignumber.js');
const BN = web3.utils.BN;

contract('Lending module', function (accounts) {
    let deposit, referral, token, kyc, authorization, factory, loan, daiToken, daiProxy;

    const owner = accounts[8];
    const admin = accounts[9];

    const decimals = '1000000000000000000';

    beforeEach(async function () {
        token = await HeroTokenContract.new({from: owner});
        daiToken = await HeroTokenContract.new({from: owner});
        kyc = await KYCContract.new({from: owner});
        deposit = await DepositContract.new(daiToken.address, kyc.address, {from: owner});
        referral = await ReferralTrackerContract.new(deposit.address, daiToken.address, {from: owner});
        authorization = await Authorization.new(kyc.address, deposit.address, {from: owner});
        daiProxy = await DAIProxy.new(authorization.address, daiToken.address, {from: owner});
        factory = await LoanContractDispatcher.new(authorization.address, daiToken.address, daiProxy.address, {from: owner});
    });

    xdescribe('LoanContractDispatcher', () => {
        it('check state', async () => {
            await Utils.checkState({factory}, {
                factory: {
                    administrator: 0x0,
                    operatorFee: new BigNumber('1').multipliedBy(decimals).toString(),
                    minAmount: new BigNumber('1').multipliedBy(decimals).toString(),
                    maxAmount: new BigNumber('2500000').multipliedBy(decimals).toNumber(),
                    minTermLength: new BigNumber('2592000').multipliedBy(1).toString(),
                    minAuctionLength: new BigNumber('2592000').multipliedBy(1).toString(),
                    maxInterestRate: new BigNumber('0').multipliedBy(decimals).toString(),
                    minInterestRate: new BigNumber('0').multipliedBy(decimals).toString(),
                    maxInterestRate: new BigNumber('20').multipliedBy(decimals).toString(),
                    isLoanContract: [
                        {[accounts[0]]: false},
                    ],
                }
            });
        });
        it('check setters', async () => {
            await Utils.checkState({factory}, {
                factory: {
                    administrator: 0x0,
                    operatorFee: new BigNumber('1').multipliedBy(decimals).toString(),
                    minAmount: new BigNumber('1').multipliedBy(decimals).toString(),
                    maxAmount: new BigNumber('2500000').multipliedBy(decimals).toNumber(),
                    minTermLength: new BigNumber('2592000').multipliedBy(1).toString(),
                    minAuctionLength: new BigNumber('2592000').multipliedBy(1).toString(),
                    minInterestRate: new BigNumber('0').multipliedBy(decimals).toString(),
                    maxInterestRate: new BigNumber('20').multipliedBy(decimals).toString(),
                    isLoanContract: [
                        {[accounts[0]]: false},
                    ],
                }
            });

            await factory.setAdministrator(admin, {from: admin})
                .then(Utils.receiptShouldFailed)
                .catch(Utils.catchReceiptShouldFailed);
            await factory.setAdministrator(admin, {from: owner})
                .then(Utils.receiptShouldSucceed);

            await factory.setOperatorFee(new BigNumber('2.8').multipliedBy(decimals).toString(), {from: accounts[5]})
                .then(Utils.receiptShouldFailed)
                .catch(Utils.catchReceiptShouldFailed);
            await factory.setOperatorFee(new BigNumber('2.8').multipliedBy(decimals).toString(), {from: admin})
                .then(Utils.receiptShouldSucceed);

            await factory.setMinAmount(new BigNumber('2.8').multipliedBy(decimals).toString(), {from: accounts[5]})
                .then(Utils.receiptShouldFailed)
                .catch(Utils.catchReceiptShouldFailed);

            await factory.setMinAmount('2500001000000000000000000', {from: admin})
                .then(Utils.receiptShouldFailed)
                .catch(Utils.catchReceiptShouldFailed);

            await factory.setMinAmount(new BigNumber('2.8').multipliedBy(decimals).toString(), {from: admin})
                .then(Utils.receiptShouldSucceed);

            await factory.setMaxAmount(new BigNumber('2.8').multipliedBy(decimals).toString(), {from: accounts[5]})
                .then(Utils.receiptShouldFailed)
                .catch(Utils.catchReceiptShouldFailed);

            await factory.setMaxAmount(new BigNumber('0.9').multipliedBy(decimals).toString(), {from: admin})
                .then(Utils.receiptShouldFailed)
                .catch(Utils.catchReceiptShouldFailed);

            await factory.setMaxAmount(new BigNumber('2.8').multipliedBy(decimals).toString(), {from: admin})
                .then(Utils.receiptShouldSucceed);

            await factory.setMinInterestRate(new BigNumber('2.8').multipliedBy(decimals).toString(), {from: accounts[5]})
                .then(Utils.receiptShouldFailed)
                .catch(Utils.catchReceiptShouldFailed);

            await factory.setMinInterestRate(new BigNumber('21').multipliedBy(decimals).toString(), {from: admin})
                .then(Utils.receiptShouldFailed)
                .catch(Utils.catchReceiptShouldFailed);

            await factory.setMinInterestRate(new BigNumber('2.8').multipliedBy(decimals).toString(), {from: admin})
                .then(Utils.receiptShouldSucceed);

            await factory.setMaxInterestRate(new BigNumber('2.8').multipliedBy(decimals).toString(), {from: accounts[5]})
                .then(Utils.receiptShouldFailed)
                .catch(Utils.catchReceiptShouldFailed);

            await factory.setMaxInterestRate(new BigNumber('2.7').multipliedBy(decimals).toString(), {from: admin})
                .then(Utils.receiptShouldFailed)
                .catch(Utils.catchReceiptShouldFailed);

            await factory.setMaxInterestRate(new BigNumber('2.8').multipliedBy(decimals).toString(), {from: admin})
                .then(Utils.receiptShouldSucceed);

            await factory.setMinTermLength(new BigNumber('2592000').multipliedBy(1).toString(), {from: accounts[5]})
                .then(Utils.receiptShouldFailed)
                .catch(Utils.catchReceiptShouldFailed);

            await factory.setMinTermLength(new BigNumber('28').multipliedBy(1).toString(), {from: admin})
                .then(Utils.receiptShouldSucceed);

            await factory.setMinAuctionLength(new BigNumber('2592000').multipliedBy(1).toString(), {from: accounts[5]})
                .then(Utils.receiptShouldFailed)
                .catch(Utils.catchReceiptShouldFailed);

            await factory.setMinAuctionLength(new BigNumber('28').multipliedBy(1).toString(), {from: admin})
                .then(Utils.receiptShouldSucceed);

            await Utils.checkState({factory}, {
                factory: {
                    administrator: admin,
                    operatorFee: new BigNumber('2.8').multipliedBy(decimals).toString(),
                    minAmount: new BigNumber('2.8').multipliedBy(decimals).toString(),
                    maxAmount: new BigNumber('2.8').multipliedBy(decimals).toNumber(),
                    minTermLength: new BigNumber('28').multipliedBy(1).toString(),
                    minAuctionLength: new BigNumber('28').multipliedBy(1).toString(),
                    minInterestRate: new BigNumber('2.8').multipliedBy(decimals).toString(),
                    maxInterestRate: new BigNumber('2.8').multipliedBy(decimals).toString(),
                    isLoanContract: [
                        {[accounts[0]]: false},
                    ],
                }
            });

        });
        xit('deploy', async () => {
            const user = accounts[5];

            await Utils.checkState({factory}, {
                factory: {
                    administrator: 0x0,
                    operatorFee: new BigNumber('1').multipliedBy(decimals).toString(),
                    minAmount: new BigNumber('1').multipliedBy(decimals).toString(),
                    maxAmount: new BigNumber('2500000').multipliedBy(decimals).toNumber(),
                    minTermLength: new BigNumber('2592000').multipliedBy(1).toString(),
                    minAuctionLength: new BigNumber('2592000').multipliedBy(1).toString(),
                    minInterestRate: new BigNumber('0').multipliedBy(decimals).toString(),
                    maxInterestRate: new BigNumber('20').multipliedBy(decimals).toString(),
                    isLoanContract: [
                        {[accounts[0]]: false},
                    ],
                }
            });

            await factory.deploy(
                new BigNumber('280').multipliedBy(decimals).toString(),// uint256 loanMinAmount,
                '2800000000000000000000',// uint256 loanMaxAmount,
                new BigNumber('2.8').multipliedBy(decimals).toString(),// uint256 loanMaxInterestRate,
                new BigNumber('2592000').multipliedBy(2).toString(),// uint256 termLength,
                new BigNumber('2592000').multipliedBy(2).toString(),// uint256 auctionLength
                {from: user}
            )
                .then(Utils.receiptShouldFailed)
                .catch(Utils.catchReceiptShouldFailed);

            await kyc.setAdministrator(admin, {from: owner});
            await kyc.addAddressToKYC(user, {from: admin})
                .then(Utils.receiptShouldSucceed);

            await factory.deploy(
                new BigNumber('280').multipliedBy(decimals).toString(),// uint256 loanMinAmount,
                '2800000000000000000000',// uint256 loanMaxAmount,
                new BigNumber('2.8').multipliedBy(decimals).toString(),// uint256 loanMaxInterestRate,
                new BigNumber('2592000').multipliedBy(2).toString(),// uint256 termLength,
                new BigNumber('2592000').multipliedBy(2).toString(),// uint256 auctionLength
                {from: user}
            )
                .then(Utils.receiptShouldFailed)
                .catch(Utils.catchReceiptShouldFailed);

            await factory.setAdministrator(admin, {from: owner})
                .then(Utils.receiptShouldSucceed);

            await factory.deploy(
                new BigNumber('0.9').multipliedBy(decimals).toString(),// uint256 loanMinAmount,
                '2800000000000000000000',// uint256 loanMaxAmount,
                new BigNumber('2.8').multipliedBy(decimals).toString(),// uint256 loanMaxInterestRate,
                new BigNumber('2592000').multipliedBy(2).toString(),// uint256 termLength,
                new BigNumber('2592000').multipliedBy(2).toString(),// uint256 auctionLength
                {from: user}
            )
                .then(Utils.receiptShouldFailed)
                .catch(Utils.catchReceiptShouldFailed);

            await factory.deploy(
                '2500001000000000000000000',// uint256 loanMinAmount,
                '2800000000000000000000',// uint256 loanMaxAmount,
                new BigNumber('2.8').multipliedBy(decimals).toString(),// uint256 loanMaxInterestRate,
                new BigNumber('2592000').multipliedBy(2).toString(),// uint256 termLength,
                new BigNumber('2592000').multipliedBy(2).toString(),// uint256 auctionLength
                {from: user}
            )
                .then(Utils.receiptShouldFailed)
                .catch(Utils.catchReceiptShouldFailed);

            await factory.deploy(
                '2800000000000000000001',// uint256 loanMinAmount,
                '2800000000000000000000',// uint256 loanMaxAmount,
                new BigNumber('2.8').multipliedBy(decimals).toString(),// uint256 loanMaxInterestRate,
                new BigNumber('2592000').multipliedBy(2).toString(),// uint256 termLength,
                new BigNumber('2592000').multipliedBy(2).toString(),// uint256 auctionLength
                {from: user}
            )
                .then(Utils.receiptShouldFailed)
                .catch(Utils.catchReceiptShouldFailed);

            await factory.deploy(
                new BigNumber('280').multipliedBy(decimals).toString(),// uint256 loanMinAmount,
                new BigNumber('0.9').multipliedBy(decimals).toString(),// uint256 loanMaxAmount,
                new BigNumber('2.8').multipliedBy(decimals).toString(),// uint256 loanMaxInterestRate,
                new BigNumber('2592000').multipliedBy(2).toString(),// uint256 termLength,
                new BigNumber('2592000').multipliedBy(2).toString(),// uint256 auctionLength
                {from: user}
            )
                .then(Utils.receiptShouldFailed)
                .catch(Utils.catchReceiptShouldFailed);

            await factory.deploy(
                new BigNumber('280').multipliedBy(decimals).toString(),// uint256 loanMinAmount,
                '2500001000000000000000000',// uint256 loanMaxAmount,
                new BigNumber('2.8').multipliedBy(decimals).toString(),// uint256 loanMaxInterestRate,
                new BigNumber('2592000').multipliedBy(2).toString(),// uint256 termLength,
                new BigNumber('2592000').multipliedBy(2).toString(),// uint256 auctionLength
                {from: user}
            )
                .then(Utils.receiptShouldFailed)
                .catch(Utils.catchReceiptShouldFailed);

            await factory.deploy(
                new BigNumber('280').multipliedBy(decimals).toString(),// uint256 loanMinAmount,
                new BigNumber('279').multipliedBy(decimals).toString(),// uint256 loanMaxAmount,
                new BigNumber('2.8').multipliedBy(decimals).toString(),// uint256 loanMaxInterestRate,
                new BigNumber('2592000').multipliedBy(2).toString(),// uint256 termLength,
                new BigNumber('2592000').multipliedBy(2).toString(),// uint256 auctionLength
                {from: user}
            )
                .then(Utils.receiptShouldFailed)
                .catch(Utils.catchReceiptShouldFailed);

            await factory.setMinInterestRate(new BigNumber('1').multipliedBy(decimals).toString(), {from: admin})
                .then(Utils.receiptShouldSucceed);

            await factory.deploy(
                new BigNumber('280').multipliedBy(decimals).toString(),// uint256 loanMinAmount,
                '2800000000000000000000',// uint256 loanMaxAmount,
                new BigNumber('0.9').multipliedBy(decimals).toString(),// uint256 loanMaxInterestRate,
                new BigNumber('2592000').multipliedBy(2).toString(),// uint256 termLength,
                new BigNumber('2592000').multipliedBy(2).toString(),// uint256 auctionLength
                {from: user}
            )
                .then(Utils.receiptShouldFailed)
                .catch(Utils.catchReceiptShouldFailed);

            await factory.deploy(
                new BigNumber('280').multipliedBy(decimals).toString(),// uint256 loanMinAmount,
                '2800000000000000000000',// uint256 loanMaxAmount,
                new BigNumber('21').multipliedBy(decimals).toString(),// uint256 loanMaxInterestRate,
                new BigNumber('2592000').multipliedBy(2).toString(),// uint256 termLength,
                new BigNumber('2592000').multipliedBy(2).toString(),// uint256 auctionLength
                {from: user}
            )
                .then(Utils.receiptShouldFailed)
                .catch(Utils.catchReceiptShouldFailed);

            await factory.deploy(
                new BigNumber('280').multipliedBy(decimals).toString(),// uint256 loanMinAmount,
                '2800000000000000000000',// uint256 loanMaxAmount,
                new BigNumber('2.8').multipliedBy(decimals).toString(),// uint256 loanMaxInterestRate,
                new BigNumber('2592000').multipliedBy(0.5).toString(),// uint256 termLength,
                new BigNumber('2592000').multipliedBy(2).toString(),// uint256 auctionLength
                {from: user}
            )
                .then(Utils.receiptShouldFailed)
                .catch(Utils.catchReceiptShouldFailed);

            await factory.deploy(
                new BigNumber('280').multipliedBy(decimals).toString(),// uint256 loanMinAmount,
                '2800000000000000000000',// uint256 loanMaxAmount,
                new BigNumber('2.8').multipliedBy(decimals).toString(),// uint256 loanMaxInterestRate,
                new BigNumber('2592000').multipliedBy(2).toString(),// uint256 termLength,
                new BigNumber('2592000').multipliedBy(0.5).toString(),// uint256 auctionLength
                {from: user}
            )
                .then(Utils.receiptShouldFailed)
                .catch(Utils.catchReceiptShouldFailed);

            await factory.deploy(
                new BigNumber('280').multipliedBy(decimals).toString(),// uint256 loanMinAmount,
                '2800000000000000000000',// uint256 loanMaxAmount,
                new BigNumber('2.8').multipliedBy(decimals).toString(),// uint256 loanMaxInterestRate,
                new BigNumber('2592000').multipliedBy(2).toString(),// uint256 termLength,
                new BigNumber('2592000').multipliedBy(2).toString(),// uint256 auctionLength
                {from: user}
            )
                .then(Utils.receiptShouldSucceed);
        });
    });

    xdescribe('LoanContractDispatcher & DAIProxy', () => {
        let loanMinAmount = new BigNumber('200').multipliedBy(decimals).toString(),
            loanMaxAmount = new BigNumber('400').multipliedBy(decimals).toString(),
            loanMaxInterestRate = new BigNumber('2.8').multipliedBy(decimals).toString(),
            termLength = new BigNumber('2592000').multipliedBy(2).toString(),
            auctionLength = new BigNumber('2592000').multipliedBy(2).toString(),
            borrower = accounts[5],
            user = accounts[1],
            user2 = accounts[2];

        beforeEach(async () => {
            loan = await LoanContract.new(
                termLength,
                loanMinAmount,
                loanMaxAmount,
                loanMaxInterestRate,
                borrower,
                daiToken.address,
                daiProxy.address,
                admin,
                new BigNumber('1').multipliedBy(decimals).toString(),
                auctionLength
            );
        });

        it('check state', async () => {
            await Utils.checkState({loan}, {
                loan: {
                    originator: borrower,
                    administrator: admin,
                    minAmount: loanMinAmount,
                    maxAmount: loanMaxAmount,
                    auctionEndTimestamp: new BigNumber(await loan.auctionStartTimestamp.call()).plus(auctionLength).toString(),
                    auctionLength: auctionLength,
                    termLength: termLength,
                    auctionBalance: 0,
                    loanWithdrawnAmount: 0,
                    borrowerDebt: 0,
                    maxInterestRate: loanMaxInterestRate,
                    operatorFee: new BigNumber('1').multipliedBy(decimals).toString(),
                    operatorBalance: 0,
                    loanWithdrawn: false,
                    minimumReached: false,
                }
            });
        });

        it('fund & onFundingReceived & getLenderBidAmount & getLenderWithdrawn & getMaxAmount & getAuctionBalance & getInterestRate & calculateValueWithInterest & isAuctionExpired & isDefaulted & setSuccessfulAuction & setState', async () => {
            await Utils.checkState({loan}, {
                loan: {
                    originator: borrower,
                    administrator: admin,
                    minAmount: loanMinAmount,
                    maxAmount: loanMaxAmount,
                    auctionEndTimestamp: new BigNumber(await loan.auctionStartTimestamp.call()).plus(auctionLength).toString(),
                    auctionLength: auctionLength,
                    termLength: termLength,
                    auctionBalance: 0,
                    loanWithdrawnAmount: 0,
                    borrowerDebt: 0,
                    maxInterestRate: loanMaxInterestRate,
                    operatorFee: new BigNumber('1').multipliedBy(decimals).toString(),
                    operatorBalance: 0,
                    loanWithdrawn: false,
                    minimumReached: false,
                    currentState: 0,
                }
            });

            await daiProxy.fund(loan.address, new BigNumber(loanMinAmount).plus('2800').toString(), {from: user})
                .then(Utils.receiptShouldFailed)
                .catch(Utils.catchReceiptShouldFailed);

            await kyc.setAdministrator(admin, {from: owner});
            await kyc.addAddressToKYC(user, {from: admin})
                .then(Utils.receiptShouldSucceed);

            await daiProxy.fund(loan.address, new BigNumber(loanMinAmount).plus('2800').toString(), {from: user})
                .then(Utils.receiptShouldFailed)
                .catch(Utils.catchReceiptShouldFailed);

            await daiToken.transferFakeHeroTokens(user, {from: owner});
            await daiToken.transferFakeHeroTokens(user, {from: owner});
            await daiToken.transferFakeHeroTokens(user, {from: owner});
            await daiToken.transferFakeHeroTokens(user2, {from: owner});
            await daiToken.transferFakeHeroTokens(user2, {from: owner});
            await daiToken.transferFakeHeroTokens(user2, {from: owner});

            await deposit.setReferralTracker(referral.address, {from: owner})
                .then(Utils.receiptShouldSucceed);
            await deposit.setAdministrator(admin, {from: owner})
                .then(Utils.receiptShouldSucceed);
            await daiToken.increaseAllowance(deposit.address, new BigNumber('200').multipliedBy(decimals).toString(), {from: user});
            await deposit.depositFor(user)
                .then(Utils.receiptShouldSucceed);

            await daiProxy.fund(loan.address, new BigNumber(loanMinAmount).plus('2800').toString(), {from: user})
                .then(Utils.receiptShouldFailed)
                .catch(Utils.catchReceiptShouldFailed);

            await daiProxy.fund(loan.address, new BigNumber(loanMinAmount).plus('2800').toString(), {from: user})
                .then(Utils.receiptShouldFailed)
                .catch(Utils.catchReceiptShouldFailed);

            await daiToken.increaseAllowance(daiProxy.address, new BigNumber('600').multipliedBy(decimals).toString(), {from: user});

            await daiProxy.fund(loan.address, new BigNumber(loanMinAmount).dividedBy(2).toString(), {from: user})
                .then(Utils.receiptShouldSucceed);
            await daiProxy.fund(loan.address, new BigNumber(loanMinAmount).dividedBy(2).toString(), {from: user})
                .then(Utils.receiptShouldSucceed);

            console.log('lastFundedTimestamp should be near: ', new Date().getTime() / 1000);
            console.log('lastFundedTimestamp             is: ', new BigNumber(await loan.lastFundedTimestamp.call()).toNumber());

            assert.equal(
                await loan.getLenderBidAmount.call(user),
                new BigNumber(loanMinAmount).toString(),
                'lenderPosition is not equal'
            );
            assert.equal(
                await loan.getLenderWithdrawn.call(user),
                false,
                'getLenderWithdrawn is not equal'
            );
            assert.equal(
                await loan.getMaxAmount.call(),
                loanMaxAmount,
                'loanMaxAmount is not equal'
            );
            assert.equal(
                await loan.getAuctionBalance.call(),
                loanMinAmount,
                'getAuctionBalance is not equal'
            );

            await Utils.checkState({loan}, {
                loan: {
                    originator: borrower,
                    administrator: admin,
                    minAmount: loanMinAmount,
                    maxAmount: loanMaxAmount,
                    auctionEndTimestamp: new BigNumber(await loan.auctionStartTimestamp.call()).plus(auctionLength).toString(),
                    auctionLength: auctionLength,
                    termLength: termLength,
                    auctionBalance: new BigNumber(loanMinAmount).dividedBy(1).toString(),
                    loanWithdrawnAmount: 0,
                    borrowerDebt: 0,
                    maxInterestRate: loanMaxInterestRate,
                    operatorFee: new BigNumber('1').multipliedBy(decimals).toString(),
                    operatorBalance: 0,
                    loanWithdrawn: false,
                    minimumReached: true,
                    currentState: 0,
                }
            });

            const now = new BigNumber(new Date().getTime() / 1000).toFixed(0);
            console.log('InterestRate             is: ', new BigNumber(await loan.getInterestRate.call()).toNumber());
            console.log('InterestRate should be near: ', new BigNumber(loanMaxInterestRate).multipliedBy(
                new BigNumber(now).minus(await loan.auctionStartTimestamp.call()).toString()
            ).dividedBy(
                new BigNumber(await loan.auctionEndTimestamp.call()).minus(await loan.auctionStartTimestamp.call())
            ));

            assert.equal(
                new BigNumber(await loan.calculateValueWithInterest.call(new BigNumber('100').multipliedBy(decimals))).toString(),
                new BigNumber('100').multipliedBy(decimals).plus(
                    new BigNumber('100').multipliedBy(decimals).multipliedBy(
                        new BigNumber(await loan.getInterestRate.call()).multipliedBy(termLength).div(3600 * 24 * 30)
                    ).div(new BigNumber('100').multipliedBy(decimals))
                ).toFixed(0),
                'calculateValueWithInterest is not equal'
            );

            assert.equal(
                await loan.isAuctionExpired.call(),
                false,
                'isAuctionExpired is not equal'
            );
            assert.equal(
                await loan.isDefaulted.call(),
                false,
                'isAuctionExpired is not equal'
            );

            await daiProxy.fund(loan.address, new BigNumber(loanMinAmount).dividedBy(1).toString(), {from: user})
                .then(Utils.receiptShouldSucceed);

            let operatorBalance = new BigNumber(
                new BigNumber(loanMinAmount).multipliedBy(2).multipliedBy(new BigNumber('1').multipliedBy(decimals).toString()).dividedBy(new BigNumber('100').multipliedBy(decimals).toString()).toString()
            ).toString();

            await Utils.checkState({loan}, {
                loan: {
                    originator: borrower,
                    administrator: admin,
                    minAmount: loanMinAmount,
                    maxAmount: loanMaxAmount,
                    auctionEndTimestamp: new BigNumber(await loan.auctionStartTimestamp.call()).plus(auctionLength).toString(),
                    auctionLength: auctionLength,
                    termLength: termLength,
                    auctionBalance: new BigNumber(loanMinAmount).multipliedBy(2).minus(operatorBalance).toString(),
                    loanWithdrawnAmount: 0,
                    borrowerDebt: new BigNumber(await loan.calculateValueWithInterest.call(new BigNumber(loanMinAmount).multipliedBy(2).toString())).toString(),
                    maxInterestRate: loanMaxInterestRate,
                    operatorFee: new BigNumber('1').multipliedBy(decimals).toString(),
                    operatorBalance: operatorBalance,
                    loanWithdrawn: false,
                    minimumReached: true,
                    currentState: 2,
                }
            });

            console.log('termEndTimestamp should be near: ', new BigNumber(new Date().getTime() / 1000).plus(termLength).toFixed(0));
            console.log('termEndTimestamp             is: ', new BigNumber(await loan.termEndTimestamp.call()).toNumber());

        });

        it('fund (with isAuctionExpired -> FAILED_TO_FUND)', async () => {
            await Utils.checkState({loan}, {
                loan: {
                    originator: borrower,
                    administrator: admin,
                    minAmount: loanMinAmount,
                    maxAmount: loanMaxAmount,
                    auctionEndTimestamp: new BigNumber(await loan.auctionStartTimestamp.call()).plus(auctionLength).toString(),
                    auctionLength: auctionLength,
                    termLength: termLength,
                    auctionBalance: 0,
                    loanWithdrawnAmount: 0,
                    borrowerDebt: 0,
                    maxInterestRate: loanMaxInterestRate,
                    operatorFee: new BigNumber('1').multipliedBy(decimals).toString(),
                    operatorBalance: 0,
                    loanWithdrawn: false,
                    minimumReached: false,
                    currentState: 0,
                }
            });

            await kyc.setAdministrator(admin, {from: owner});
            await kyc.addAddressToKYC(user, {from: admin})
                .then(Utils.receiptShouldSucceed);
            await daiToken.transferFakeHeroTokens(user, {from: owner});
            await daiToken.transferFakeHeroTokens(user, {from: owner});
            await daiToken.transferFakeHeroTokens(user, {from: owner});
            await daiToken.increaseAllowance(deposit.address, new BigNumber('200').multipliedBy(decimals).toString(), {from: user});
            await deposit.depositFor(user)
                .then(Utils.receiptShouldSucceed);
            await daiToken.increaseAllowance(daiProxy.address, new BigNumber('600').multipliedBy(decimals).toString(), {from: user});

            let newEndTime = new BigNumber(new Date().getTime() / 1000).minus(10000).toFixed(0);
            await loan.setAuctionEndTimestampTest(newEndTime);

            await daiProxy.fund(loan.address, new BigNumber(loanMinAmount).dividedBy(2).toString(), {from: user})
                .then(Utils.receiptShouldSucceed);

            await Utils.checkState({loan}, {
                loan: {
                    originator: borrower,
                    administrator: admin,
                    minAmount: loanMinAmount,
                    maxAmount: loanMaxAmount,
                    auctionEndTimestamp: newEndTime,
                    auctionLength: auctionLength,
                    termLength: termLength,
                    auctionBalance: 0,
                    loanWithdrawnAmount: 0,
                    borrowerDebt: 0,
                    maxInterestRate: loanMaxInterestRate,
                    operatorFee: new BigNumber('1').multipliedBy(decimals).toString(),
                    operatorBalance: 0,
                    loanWithdrawn: false,
                    minimumReached: false,
                    currentState: 1,
                }
            });
        });

        xit('fund (with isAuctionExpired -> setSuccessfulAuction)', async () => {
            await Utils.checkState({loan}, {
                loan: {
                    originator: borrower,
                    administrator: admin,
                    minAmount: loanMinAmount,
                    maxAmount: loanMaxAmount,
                    auctionEndTimestamp: new BigNumber(await loan.auctionStartTimestamp.call()).plus(auctionLength).toString(),
                    auctionLength: auctionLength,
                    termLength: termLength,
                    auctionBalance: 0,
                    loanWithdrawnAmount: 0,
                    borrowerDebt: 0,
                    maxInterestRate: loanMaxInterestRate,
                    operatorFee: new BigNumber('1').multipliedBy(decimals).toString(),
                    operatorBalance: 0,
                    loanWithdrawn: false,
                    minimumReached: false,
                    currentState: 0,
                }
            });

            await kyc.setAdministrator(admin, {from: owner});
            await kyc.addAddressToKYC(user, {from: admin})
                .then(Utils.receiptShouldSucceed);
            await daiToken.transferFakeHeroTokens(user, {from: owner});
            await daiToken.transferFakeHeroTokens(user, {from: owner});
            await daiToken.transferFakeHeroTokens(user, {from: owner});
            await daiToken.increaseAllowance(deposit.address, new BigNumber('600').multipliedBy(decimals).toString(), {from: user});
            await deposit.depositFor(user)
                .then(Utils.receiptShouldSucceed);
            await daiToken.increaseAllowance(daiProxy.address, new BigNumber('600').multipliedBy(decimals).toString(), {from: user});

            await daiProxy.fund(loan.address, new BigNumber(loanMinAmount).dividedBy(1).toString(), {from: user})
                .then(Utils.receiptShouldSucceed);

            let newEndTime = new BigNumber(new Date().getTime() / 1000).minus(10000).toFixed(0);
            await loan.setAuctionEndTimestampTest(newEndTime);

            await daiProxy.fund(loan.address, new BigNumber(loanMinAmount).dividedBy(1).toString(), {from: user})
                .then(Utils.receiptShouldSucceed);

            let operatorBalance = new BigNumber(
                new BigNumber(loanMinAmount).multipliedBy(1).multipliedBy(new BigNumber('1').multipliedBy(decimals).toString()).dividedBy(new BigNumber('100').multipliedBy(decimals).toString()).toString()
            ).toString();

            await Utils.checkState({loan}, {
                loan: {
                    originator: borrower,
                    administrator: admin,
                    minAmount: loanMinAmount,
                    maxAmount: loanMaxAmount,
                    auctionEndTimestamp: newEndTime,
                    auctionLength: auctionLength,
                    termLength: termLength,
                    auctionBalance: new BigNumber(loanMinAmount).multipliedBy(1).minus(operatorBalance).toString(),
                    loanWithdrawnAmount: 0,
                    borrowerDebt: new BigNumber(await loan.calculateValueWithInterest.call(new BigNumber(loanMinAmount).multipliedBy(1).toString())).toString(),
                    maxInterestRate: loanMaxInterestRate,
                    operatorFee: new BigNumber('1').multipliedBy(decimals).toString(),
                    operatorBalance: operatorBalance,
                    loanWithdrawn: false,
                    minimumReached: true,
                    currentState: 2,
                    termEndTimestamp: new BigNumber(await loan.auctionEndTimestamp.call()).plus(termLength).toString(),
                }
            });
        });

        it('updateStateMachine', async () => {
            await Utils.checkState({loan}, {
                loan: {
                    originator: borrower,
                    administrator: admin,
                    minAmount: loanMinAmount,
                    maxAmount: loanMaxAmount,
                    auctionEndTimestamp: new BigNumber(await loan.auctionStartTimestamp.call()).plus(auctionLength).toString(),
                    auctionLength: auctionLength,
                    termLength: termLength,
                    auctionBalance: 0,
                    loanWithdrawnAmount: 0,
                    borrowerDebt: 0,
                    maxInterestRate: loanMaxInterestRate,
                    operatorFee: new BigNumber('1').multipliedBy(decimals).toString(),
                    operatorBalance: 0,
                    loanWithdrawn: false,
                    minimumReached: false,
                    currentState: 0,
                }
            });

            await loan.updateStateMachine();

            let newEndTime = new BigNumber(new Date().getTime() / 1000).minus(10000).toFixed(0);
            await loan.setAuctionEndTimestampTest(newEndTime);

            await loan.updateStateMachine();

            await Utils.checkState({loan}, {
                loan: {
                    originator: borrower,
                    administrator: admin,
                    minAmount: loanMinAmount,
                    maxAmount: loanMaxAmount,
                    auctionEndTimestamp: newEndTime,
                    auctionLength: auctionLength,
                    termLength: termLength,
                    auctionBalance: 0,
                    loanWithdrawnAmount: 0,
                    borrowerDebt: 0,
                    maxInterestRate: loanMaxInterestRate,
                    operatorFee: new BigNumber('1').multipliedBy(decimals).toString(),
                    operatorBalance: 0,
                    loanWithdrawn: false,
                    minimumReached: false,
                    currentState: 1,
                }
            });

        });

        xit('updateStateMachine2', async () => {
            await Utils.checkState({loan}, {
                loan: {
                    originator: borrower,
                    administrator: admin,
                    minAmount: loanMinAmount,
                    maxAmount: loanMaxAmount,
                    auctionEndTimestamp: new BigNumber(await loan.auctionStartTimestamp.call()).plus(auctionLength).toString(),
                    auctionLength: auctionLength,
                    termLength: termLength,
                    auctionBalance: 0,
                    loanWithdrawnAmount: 0,
                    borrowerDebt: 0,
                    maxInterestRate: loanMaxInterestRate,
                    operatorFee: new BigNumber('1').multipliedBy(decimals).toString(),
                    operatorBalance: 0,
                    loanWithdrawn: false,
                    minimumReached: false,
                    currentState: 0,
                }
            });

            await loan.updateStateMachine();

            await kyc.setAdministrator(admin, {from: owner});
            await kyc.addAddressToKYC(user, {from: admin})
                .then(Utils.receiptShouldSucceed);
            await daiToken.transferFakeHeroTokens(user, {from: owner});
            await daiToken.transferFakeHeroTokens(user, {from: owner});
            await daiToken.transferFakeHeroTokens(user, {from: owner});
            await daiToken.increaseAllowance(deposit.address, new BigNumber('600').multipliedBy(decimals).toString(), {from: user});
            await deposit.depositFor(user)
                .then(Utils.receiptShouldSucceed);
            await daiToken.increaseAllowance(daiProxy.address, new BigNumber('600').multipliedBy(decimals).toString(), {from: user});

            await daiProxy.fund(loan.address, new BigNumber(loanMinAmount).dividedBy(1).toString(), {from: user})
                .then(Utils.receiptShouldSucceed);

            let newEndTime = new BigNumber(new Date().getTime() / 1000).minus(10000).toFixed(0);
            await loan.setAuctionEndTimestampTest(newEndTime);

            await loan.updateStateMachine();

            let operatorBalance = new BigNumber(
                new BigNumber(loanMinAmount).multipliedBy(1).multipliedBy(new BigNumber('1').multipliedBy(decimals).toString()).dividedBy(new BigNumber('100').multipliedBy(decimals).toString()).toString()
            ).toString();

            await Utils.checkState({loan}, {
                loan: {
                    originator: borrower,
                    administrator: admin,
                    minAmount: loanMinAmount,
                    maxAmount: loanMaxAmount,
                    auctionEndTimestamp: newEndTime,
                    auctionLength: auctionLength,
                    termLength: termLength,
                    auctionBalance: new BigNumber(loanMinAmount).multipliedBy(1).minus(operatorBalance).toString(),
                    loanWithdrawnAmount: 0,
                    borrowerDebt: new BigNumber(await loan.calculateValueWithInterest.call(new BigNumber(loanMinAmount).multipliedBy(1).toString())).toString(),
                    maxInterestRate: loanMaxInterestRate,
                    operatorFee: new BigNumber('1').multipliedBy(decimals).toString(),
                    operatorBalance: operatorBalance,
                    loanWithdrawn: false,
                    minimumReached: true,
                    currentState: 2,
                    termEndTimestamp: new BigNumber(await loan.auctionEndTimestamp.call()).plus(termLength).toString(),
                }
            });

            newEndTime = new BigNumber(new Date().getTime() / 1000).minus(10000).toFixed(0);
            await loan.setAuctionEndTimestampTest(newEndTime);
            await loan.setTermEndTimestampTest(newEndTime);

            await loan.updateStateMachine();

            assert.equal(
                await loan.currentState.call(),
                3,
                'currentState is not equal'
            );

        });

        it('withdrawRefund', async () => {
            await Utils.checkState({loan}, {
                loan: {
                    originator: borrower,
                    administrator: admin,
                    minAmount: loanMinAmount,
                    maxAmount: loanMaxAmount,
                    auctionEndTimestamp: new BigNumber(await loan.auctionStartTimestamp.call()).plus(auctionLength).toString(),
                    auctionLength: auctionLength,
                    termLength: termLength,
                    auctionBalance: 0,
                    loanWithdrawnAmount: 0,
                    borrowerDebt: 0,
                    maxInterestRate: loanMaxInterestRate,
                    operatorFee: new BigNumber('1').multipliedBy(decimals).toString(),
                    operatorBalance: 0,
                    loanWithdrawn: false,
                    minimumReached: false,
                    currentState: 0,
                }
            });

            await kyc.setAdministrator(admin, {from: owner});
            await kyc.addAddressToKYC(user, {from: admin})
                .then(Utils.receiptShouldSucceed);
            await daiToken.transferFakeHeroTokens(user, {from: owner});
            await daiToken.transferFakeHeroTokens(user, {from: owner});
            await daiToken.transferFakeHeroTokens(user, {from: owner});
            await daiToken.increaseAllowance(deposit.address, new BigNumber('200').multipliedBy(decimals).toString(), {from: user});
            await deposit.depositFor(user)
                .then(Utils.receiptShouldSucceed);
            await daiToken.increaseAllowance(daiProxy.address, new BigNumber('600').multipliedBy(decimals).toString(), {from: user});

            await daiProxy.fund(loan.address, new BigNumber(loanMinAmount).dividedBy(2).toString(), {from: user})
                .then(Utils.receiptShouldSucceed);

            await loan.withdrawRefund({from: user})
                .then(Utils.receiptShouldFailed)
                .catch(Utils.catchReceiptShouldFailed);

            let newEndTime = new BigNumber(new Date().getTime() / 1000).minus(10000).toFixed(0);
            await loan.setAuctionEndTimestampTest(newEndTime);

            await loan.updateStateMachine();

            await Utils.checkState({loan, daiToken}, {
                loan: {
                    originator: borrower,
                    administrator: admin,
                    minAmount: loanMinAmount,
                    maxAmount: loanMaxAmount,
                    auctionEndTimestamp: newEndTime,
                    auctionLength: auctionLength,
                    termLength: termLength,
                    auctionBalance: new BigNumber(loanMinAmount).dividedBy(2).toString(),
                    loanWithdrawnAmount: 0,
                    borrowerDebt: 0,
                    maxInterestRate: loanMaxInterestRate,
                    operatorFee: new BigNumber('1').multipliedBy(decimals).toString(),
                    operatorBalance: 0,
                    loanWithdrawn: false,
                    minimumReached: false,
                    currentState: 1,
                },
                daiToken: {
                    balanceOf: [
                        {[deposit.address]: new BigNumber('200').multipliedBy(decimals).toString()},
                        {[loan.address]: new BigNumber(loanMinAmount).dividedBy(2).toString()},
                        {[user]: new BigNumber('400').multipliedBy(decimals).minus(new BigNumber(loanMinAmount).dividedBy(2).toString()).toString()},
                    ],
                },
            });

            await loan.withdrawRefund({from: user2})
                .then(Utils.receiptShouldFailed)
                .catch(Utils.catchReceiptShouldFailed);

            assert.equal(
                await loan.getLenderWithdrawn.call(user),
                false,
                'lenderPosition is not equal'
            );

            await loan.withdrawRefund({from: user})
                .then(Utils.receiptShouldSucceed);

            await loan.withdrawRefund({from: user})
                .then(Utils.receiptShouldFailed)
                .catch(Utils.catchReceiptShouldFailed);

            assert.equal(
                await loan.getLenderWithdrawn.call(user),
                true,
                'lenderPosition is not equal'
            );

            await Utils.checkState({loan, daiToken}, {
                loan: {
                    originator: borrower,
                    administrator: admin,
                    minAmount: loanMinAmount,
                    maxAmount: loanMaxAmount,
                    auctionEndTimestamp: newEndTime,
                    auctionLength: auctionLength,
                    termLength: termLength,
                    auctionBalance: new BigNumber(loanMinAmount).dividedBy(2).toString(),
                    loanWithdrawnAmount: new BigNumber(await loan.getLenderBidAmount.call(user)).toString(),
                    borrowerDebt: 0,
                    maxInterestRate: loanMaxInterestRate,
                    operatorFee: new BigNumber('1').multipliedBy(decimals).toString(),
                    operatorBalance: 0,
                    loanWithdrawn: false,
                    minimumReached: false,
                    currentState: 5,
                },
                daiToken: {
                    balanceOf: [
                        {[deposit.address]: new BigNumber('200').multipliedBy(decimals).toString()},
                        {[loan.address]: 0},
                        {[user]: new BigNumber('400').multipliedBy(decimals).toString()},
                    ],
                },
            });

        });

        xit('withdrawLoan', async () => {
            await Utils.checkState({loan}, {
                loan: {
                    originator: borrower,
                    administrator: admin,
                    minAmount: loanMinAmount,
                    maxAmount: loanMaxAmount,
                    auctionEndTimestamp: new BigNumber(await loan.auctionStartTimestamp.call()).plus(auctionLength).toString(),
                    auctionLength: auctionLength,
                    termLength: termLength,
                    auctionBalance: 0,
                    loanWithdrawnAmount: 0,
                    borrowerDebt: 0,
                    maxInterestRate: loanMaxInterestRate,
                    operatorFee: new BigNumber('1').multipliedBy(decimals).toString(),
                    operatorBalance: 0,
                    loanWithdrawn: false,
                    minimumReached: false,
                    currentState: 0,
                }
            });

            await kyc.setAdministrator(admin, {from: owner});
            await kyc.addAddressToKYC(user, {from: admin})
                .then(Utils.receiptShouldSucceed);
            await daiToken.transferFakeHeroTokens(user, {from: owner});
            await daiToken.transferFakeHeroTokens(user, {from: owner});
            await daiToken.transferFakeHeroTokens(user, {from: owner});
            await daiToken.increaseAllowance(deposit.address, new BigNumber('200').multipliedBy(decimals).toString(), {from: user});
            await deposit.depositFor(user)
                .then(Utils.receiptShouldSucceed);
            await daiToken.increaseAllowance(daiProxy.address, new BigNumber('600').multipliedBy(decimals).toString(), {from: user});

            await loan.withdrawLoan({from: borrower})
                .then(Utils.receiptShouldFailed)
                .catch(Utils.catchReceiptShouldFailed);

            await daiProxy.fund(loan.address, new BigNumber(loanMinAmount).dividedBy(1).toString(), {from: user})
                .then(Utils.receiptShouldSucceed);

            let newEndTime = new BigNumber(new Date().getTime() / 1000).minus(10000).toFixed(0);
            await loan.setAuctionEndTimestampTest(newEndTime);

            await Utils.checkState({loan, daiToken}, {
                loan: {
                    originator: borrower,
                    administrator: admin,
                    minAmount: loanMinAmount,
                    maxAmount: loanMaxAmount,
                    auctionEndTimestamp: newEndTime,
                    auctionLength: auctionLength,
                    termLength: termLength,
                    auctionBalance: new BigNumber(loanMinAmount).dividedBy(1).toString(),
                    loanWithdrawnAmount: 0,
                    borrowerDebt: 0,
                    maxInterestRate: loanMaxInterestRate,
                    operatorFee: new BigNumber('1').multipliedBy(decimals).toString(),
                    operatorBalance: 0,
                    loanWithdrawn: false,
                    minimumReached: true,
                    currentState: 0,
                },
                daiToken: {
                    balanceOf: [
                        {[deposit.address]: new BigNumber('200').multipliedBy(decimals).toString()},
                        {[loan.address]: new BigNumber(loanMinAmount).dividedBy(1).toString()},
                        {[user]: new BigNumber('400').multipliedBy(decimals).minus(new BigNumber(loanMinAmount).dividedBy(1).toString()).toString()},
                        {[borrower]: new BigNumber('0').multipliedBy(decimals).toString()},
                    ],
                },
            });

            await loan.withdrawLoan({from: accounts[9]})
                .then(Utils.receiptShouldFailed)
                .catch(Utils.catchReceiptShouldFailed);

            await loan.withdrawLoan({from: borrower})
                .then(Utils.receiptShouldSucceed);

            await loan.withdrawLoan({from: borrower})
                .then(Utils.receiptShouldFailed)
                .catch(Utils.catchReceiptShouldFailed);

            let operatorBalance = new BigNumber(
                new BigNumber(loanMinAmount).multipliedBy(1).multipliedBy(new BigNumber('1').multipliedBy(decimals).toString()).dividedBy(new BigNumber('100').multipliedBy(decimals).toString()).toString()
            ).toString();

            await Utils.checkState({loan, daiToken}, {
                loan: {
                    originator: borrower,
                    administrator: admin,
                    minAmount: loanMinAmount,
                    maxAmount: loanMaxAmount,
                    auctionEndTimestamp: newEndTime,
                    auctionLength: auctionLength,
                    termLength: termLength,
                    auctionBalance: new BigNumber(loanMinAmount).dividedBy(1).minus(operatorBalance).toString(),
                    loanWithdrawnAmount: 0,
                    borrowerDebt: new BigNumber(await loan.calculateValueWithInterest.call(new BigNumber(loanMinAmount).multipliedBy(1).toString())).toString(),
                    maxInterestRate: loanMaxInterestRate,
                    operatorFee: new BigNumber('1').multipliedBy(decimals).toString(),
                    operatorBalance: operatorBalance,
                    loanWithdrawn: true,
                    minimumReached: true,
                    currentState: 2,
                },
                daiToken: {
                    balanceOf: [
                        {[deposit.address]: new BigNumber('200').multipliedBy(decimals).toString()},
                        {[loan.address]: new BigNumber(operatorBalance).dividedBy(1).toString()},
                        {[user]: new BigNumber('400').multipliedBy(decimals).minus(new BigNumber(loanMinAmount).dividedBy(1).toString()).toString()},
                        {[borrower]: new BigNumber(loanMinAmount).dividedBy(1).minus(operatorBalance).toString()},
                    ],
                },
            });
        });

        xit('withdrawFees', async () => {
            await Utils.checkState({loan}, {
                loan: {
                    originator: borrower,
                    administrator: admin,
                    minAmount: loanMinAmount,
                    maxAmount: loanMaxAmount,
                    auctionEndTimestamp: new BigNumber(await loan.auctionStartTimestamp.call()).plus(auctionLength).toString(),
                    auctionLength: auctionLength,
                    termLength: termLength,
                    auctionBalance: 0,
                    loanWithdrawnAmount: 0,
                    borrowerDebt: 0,
                    maxInterestRate: loanMaxInterestRate,
                    operatorFee: new BigNumber('1').multipliedBy(decimals).toString(),
                    operatorBalance: 0,
                    loanWithdrawn: false,
                    minimumReached: false,
                    currentState: 0,
                }
            });

            await kyc.setAdministrator(admin, {from: owner});
            await kyc.addAddressToKYC(user, {from: admin})
                .then(Utils.receiptShouldSucceed);
            await daiToken.transferFakeHeroTokens(user, {from: owner});
            await daiToken.transferFakeHeroTokens(user, {from: owner});
            await daiToken.transferFakeHeroTokens(user, {from: owner});
            await daiToken.increaseAllowance(deposit.address, new BigNumber('200').multipliedBy(decimals).toString(), {from: user});
            await deposit.depositFor(user)
                .then(Utils.receiptShouldSucceed);
            await daiToken.increaseAllowance(daiProxy.address, new BigNumber('600').multipliedBy(decimals).toString(), {from: user});

            await daiProxy.fund(loan.address, new BigNumber(loanMinAmount).dividedBy(1).toString(), {from: user})
                .then(Utils.receiptShouldSucceed);

            let newEndTime = new BigNumber(new Date().getTime() / 1000).minus(10000).toFixed(0);
            await loan.setAuctionEndTimestampTest(newEndTime);

            await Utils.checkState({loan, daiToken}, {
                loan: {
                    originator: borrower,
                    administrator: admin,
                    minAmount: loanMinAmount,
                    maxAmount: loanMaxAmount,
                    auctionEndTimestamp: newEndTime,
                    auctionLength: auctionLength,
                    termLength: termLength,
                    auctionBalance: new BigNumber(loanMinAmount).dividedBy(1).toString(),
                    loanWithdrawnAmount: 0,
                    borrowerDebt: 0,
                    maxInterestRate: loanMaxInterestRate,
                    operatorFee: new BigNumber('1').multipliedBy(decimals).toString(),
                    operatorBalance: 0,
                    loanWithdrawn: false,
                    minimumReached: true,
                    currentState: 0,
                },
                daiToken: {
                    balanceOf: [
                        {[deposit.address]: new BigNumber('200').multipliedBy(decimals).toString()},
                        {[loan.address]: new BigNumber(loanMinAmount).dividedBy(1).toString()},
                        {[user]: new BigNumber('400').multipliedBy(decimals).minus(new BigNumber(loanMinAmount).dividedBy(1).toString()).toString()},
                        {[borrower]: new BigNumber('0').multipliedBy(decimals).toString()},
                    ],
                },
            });

            await loan.withdrawFees({from: borrower})
                .then(Utils.receiptShouldFailed)
                .catch(Utils.catchReceiptShouldFailed);

            await loan.withdrawFees({from: admin})
                .then(Utils.receiptShouldFailed)
                .catch(Utils.catchReceiptShouldFailed);

            await loan.withdrawLoan({from: borrower})
                .then(Utils.receiptShouldSucceed);

            let operatorBalance = new BigNumber(
                new BigNumber(loanMinAmount).multipliedBy(1).multipliedBy(new BigNumber('1').multipliedBy(decimals).toString()).dividedBy(new BigNumber('100').multipliedBy(decimals).toString()).toString()
            ).toString();

            await Utils.checkState({loan, daiToken}, {
                loan: {
                    originator: borrower,
                    administrator: admin,
                    minAmount: loanMinAmount,
                    maxAmount: loanMaxAmount,
                    auctionEndTimestamp: newEndTime,
                    auctionLength: auctionLength,
                    termLength: termLength,
                    auctionBalance: new BigNumber(loanMinAmount).dividedBy(1).minus(operatorBalance).toString(),
                    loanWithdrawnAmount: 0,
                    borrowerDebt: new BigNumber(await loan.calculateValueWithInterest.call(new BigNumber(loanMinAmount).multipliedBy(1).toString())).toString(),
                    maxInterestRate: loanMaxInterestRate,
                    operatorFee: new BigNumber('1').multipliedBy(decimals).toString(),
                    operatorBalance: operatorBalance,
                    loanWithdrawn: true,
                    minimumReached: true,
                    currentState: 2,
                },
                daiToken: {
                    balanceOf: [
                        {[deposit.address]: new BigNumber('200').multipliedBy(decimals).toString()},
                        {[loan.address]: new BigNumber(operatorBalance).dividedBy(1).toString()},
                        {[user]: new BigNumber('400').multipliedBy(decimals).minus(new BigNumber(loanMinAmount).dividedBy(1).toString()).toString()},
                        {[borrower]: new BigNumber(loanMinAmount).dividedBy(1).minus(operatorBalance).toString()},
                        {[admin]: new BigNumber(0).dividedBy(1).toString()},
                    ],
                },
            });

            await loan.withdrawFees({from: admin})
                .then(Utils.receiptShouldSucceed);

            await loan.withdrawFees({from: admin})
                .then(Utils.receiptShouldFailed)
                .catch(Utils.catchReceiptShouldFailed);

            await Utils.checkState({loan, daiToken}, {
                loan: {
                    originator: borrower,
                    administrator: admin,
                    minAmount: loanMinAmount,
                    maxAmount: loanMaxAmount,
                    auctionEndTimestamp: newEndTime,
                    auctionLength: auctionLength,
                    termLength: termLength,
                    auctionBalance: new BigNumber(loanMinAmount).dividedBy(1).minus(operatorBalance).toString(),
                    loanWithdrawnAmount: 0,
                    borrowerDebt: new BigNumber(await loan.calculateValueWithInterest.call(new BigNumber(loanMinAmount).multipliedBy(1).toString())).toString(),
                    maxInterestRate: loanMaxInterestRate,
                    operatorFee: new BigNumber('1').multipliedBy(decimals).toString(),
                    operatorBalance: 0,
                    loanWithdrawn: true,
                    minimumReached: true,
                    currentState: 2,
                },
                daiToken: {
                    balanceOf: [
                        {[deposit.address]: new BigNumber('200').multipliedBy(decimals).toString()},
                        {[loan.address]: new BigNumber(0).dividedBy(1).toString()},
                        {[user]: new BigNumber('400').multipliedBy(decimals).minus(new BigNumber(loanMinAmount).dividedBy(1).toString()).toString()},
                        {[borrower]: new BigNumber(loanMinAmount).dividedBy(1).minus(operatorBalance).toString()},
                        {[admin]: new BigNumber(operatorBalance).dividedBy(1).toString()},
                    ],
                },
            });

        });

        it('repay & onRepaymentReceived & withdrawRepayment & fund(to be fully tested) & unlockFundsWithdrawal', async () => {
            await Utils.checkState({loan}, {
                loan: {
                    originator: borrower,
                    administrator: admin,
                    minAmount: loanMinAmount,
                    maxAmount: loanMaxAmount,
                    auctionEndTimestamp: new BigNumber(await loan.auctionStartTimestamp.call()).plus(auctionLength).toString(),
                    auctionLength: auctionLength,
                    termLength: termLength,
                    auctionBalance: 0,
                    loanWithdrawnAmount: 0,
                    borrowerDebt: 0,
                    maxInterestRate: loanMaxInterestRate,
                    operatorFee: new BigNumber('1').multipliedBy(decimals).toString(),
                    operatorBalance: 0,
                    loanWithdrawn: false,
                    minimumReached: false,
                    currentState: 0,
                }
            });

            await kyc.setAdministrator(admin, {from: owner});
            await kyc.addAddressToKYC(user, {from: admin})
                .then(Utils.receiptShouldSucceed);
            await daiToken.transferFakeHeroTokens(user, {from: owner});
            await daiToken.transferFakeHeroTokens(user, {from: owner});
            await daiToken.transferFakeHeroTokens(user, {from: owner});
            await daiToken.transferFakeHeroTokens(user, {from: owner});
            await daiToken.transferFakeHeroTokens(borrower, {from: owner});
            await daiToken.increaseAllowance(deposit.address, new BigNumber('200').multipliedBy(decimals).toString(), {from: user});
            await deposit.depositFor(user)
                .then(Utils.receiptShouldSucceed);
            await daiToken.increaseAllowance(daiProxy.address, new BigNumber('800').multipliedBy(decimals).toString(), {from: user});

            await daiProxy.repay(loan.address, new BigNumber('200').multipliedBy(decimals).toString(), {from: borrower})
                .then(Utils.receiptShouldFailed)
                .catch(Utils.catchReceiptShouldFailed);

            await daiProxy.fund(loan.address, new BigNumber(loanMinAmount).multipliedBy(3).toString(), {from: user})
                .then(Utils.receiptShouldSucceed);

            let operatorBalance = new BigNumber(
                new BigNumber(loanMinAmount).multipliedBy(2).multipliedBy(new BigNumber('1').multipliedBy(decimals).toString()).dividedBy(new BigNumber('100').multipliedBy(decimals).toString()).toString()
            ).toString();
            let debt = new BigNumber(await loan.calculateValueWithInterest.call(new BigNumber(loanMinAmount).multipliedBy(2).toString())).toString();

            await Utils.checkState({loan, daiToken}, {
                loan: {
                    originator: borrower,
                    administrator: admin,
                    minAmount: loanMinAmount,
                    maxAmount: loanMaxAmount,
                    auctionEndTimestamp: new BigNumber(await loan.auctionStartTimestamp.call()).plus(auctionLength).toString(),
                    auctionLength: auctionLength,
                    termLength: termLength,
                    auctionBalance: new BigNumber(loanMinAmount).multipliedBy(2).minus(operatorBalance).toString(),
                    loanWithdrawnAmount: 0,
                    borrowerDebt: debt,
                    maxInterestRate: loanMaxInterestRate,
                    operatorFee: new BigNumber('1').multipliedBy(decimals).toString(),
                    operatorBalance: operatorBalance,
                    loanWithdrawn: false,
                    minimumReached: true,
                    currentState: 2,
                },
                daiToken: {
                    balanceOf: [
                        {[deposit.address]: new BigNumber('200').multipliedBy(decimals).toString()},
                        {[loan.address]: new BigNumber(loanMinAmount).multipliedBy(2).toString()},
                        {[user]: new BigNumber('200').multipliedBy(decimals).toString()},
                        {[borrower]: new BigNumber('200').multipliedBy(decimals).toString()},
                        {[admin]: new BigNumber(0).dividedBy(1).toString()},
                    ],
                },
            });

            await loan.withdrawLoan({from: borrower})
                .then(Utils.receiptShouldSucceed);
            await daiToken.increaseAllowance(daiProxy.address, new BigNumber(loanMinAmount).multipliedBy(2).minus(operatorBalance).plus(new BigNumber('200').multipliedBy(decimals)).toString(), {from: borrower});

            await Utils.checkState({loan, daiToken}, {
                loan: {
                    originator: borrower,
                    administrator: admin,
                    minAmount: loanMinAmount,
                    maxAmount: loanMaxAmount,
                    auctionEndTimestamp: new BigNumber(await loan.auctionStartTimestamp.call()).plus(auctionLength).toString(),
                    auctionLength: auctionLength,
                    termLength: termLength,
                    auctionBalance: new BigNumber(loanMinAmount).multipliedBy(2).minus(operatorBalance).toString(),
                    loanWithdrawnAmount: 0,
                    borrowerDebt: debt,
                    maxInterestRate: loanMaxInterestRate,
                    operatorFee: new BigNumber('1').multipliedBy(decimals).toString(),
                    operatorBalance: operatorBalance,
                    loanWithdrawn: true,
                    minimumReached: true,
                    currentState: 2,
                },
                daiToken: {
                    balanceOf: [
                        {[deposit.address]: new BigNumber('200').multipliedBy(decimals).toString()},
                        {[loan.address]: operatorBalance},
                        {[user]: new BigNumber('200').multipliedBy(decimals).toString()},
                        {[borrower]: new BigNumber('200').multipliedBy(decimals).plus(new BigNumber(loanMinAmount).multipliedBy(2).minus(operatorBalance).toString()).toString()},
                        {[admin]: new BigNumber(0).dividedBy(1).toString()},
                    ],
                },
            });

            await loan.onRepaymentReceived(loan.address, debt, {from: borrower})
                .then(Utils.receiptShouldFailed)
                .catch(Utils.catchReceiptShouldFailed);

            await daiProxy.repay(loan.address, debt, {from: user})
                .then(Utils.receiptShouldFailed)
                .catch(Utils.catchReceiptShouldFailed);

            await daiProxy.repay(loan.address, debt, {from: borrower})
                .then(Utils.receiptShouldFailed)
                .catch(Utils.catchReceiptShouldFailed);

            await kyc.addAddressToKYC(borrower, {from: admin})
                .then(Utils.receiptShouldSucceed);

            await loan.withdrawRepayment({from: user})
                .then(Utils.receiptShouldFailed)
                .catch(Utils.catchReceiptShouldFailed);

            await daiProxy.repay(loan.address, debt, {from: borrower})
                .then(Utils.receiptShouldSucceed);

            await Utils.checkState({loan, daiToken}, {
                loan: {
                    originator: borrower,
                    administrator: admin,
                    minAmount: loanMinAmount,
                    maxAmount: loanMaxAmount,
                    auctionEndTimestamp: new BigNumber(await loan.auctionStartTimestamp.call()).plus(auctionLength).toString(),
                    auctionLength: auctionLength,
                    termLength: termLength,
                    auctionBalance: new BigNumber(loanMinAmount).multipliedBy(2).minus(operatorBalance).toString(),
                    loanWithdrawnAmount: 0,
                    borrowerDebt: debt,
                    maxInterestRate: loanMaxInterestRate,
                    operatorFee: new BigNumber('1').multipliedBy(decimals).toString(),
                    operatorBalance: operatorBalance,
                    loanWithdrawn: true,
                    minimumReached: true,
                    currentState: 4,
                },
                daiToken: {
                    balanceOf: [
                        {[deposit.address]: new BigNumber('200').multipliedBy(decimals).toString()},
                        {[loan.address]: new BigNumber(await loan.calculateValueWithInterest(new BigNumber(loanMinAmount).multipliedBy(2).toString())).plus(operatorBalance).toString()},
                        {[user]: new BigNumber('200').multipliedBy(decimals).toString()},
                        {[borrower]: new BigNumber('200').multipliedBy(decimals).minus(operatorBalance).minus(new BigNumber(await loan.calculateValueWithInterest(new BigNumber(loanMinAmount).multipliedBy(2).toString())).minus(new BigNumber(loanMinAmount).multipliedBy(2).toString())).toString()},
                        {[admin]: new BigNumber(0).dividedBy(1).toString()},
                    ],
                },
            });

            await loan.withdrawRepayment({from: borrower})
                .then(Utils.receiptShouldFailed)
                .catch(Utils.catchReceiptShouldFailed);

            assert.equal(
                await loan.getLenderWithdrawn.call(user),
                false,
                'lenderPosition is not equal'
            );

            let bidAmountWithInterest = new BigNumber(await loan.calculateValueWithInterest(new BigNumber(loanMinAmount).multipliedBy(2).toString())).toString();

            await loan.withdrawRepayment({from: user})
                .then(Utils.receiptShouldSucceed);

            await loan.withdrawRepayment({from: user})
                .then(Utils.receiptShouldFailed)
                .catch(Utils.catchReceiptShouldFailed);

            assert.equal(
                await loan.getLenderWithdrawn.call(user),
                true,
                'lenderPosition is not equal'
            );

            await Utils.checkState({loan, daiToken}, {
                loan: {
                    originator: borrower,
                    administrator: admin,
                    minAmount: loanMinAmount,
                    maxAmount: loanMaxAmount,
                    auctionEndTimestamp: new BigNumber(await loan.auctionStartTimestamp.call()).plus(auctionLength).toString(),
                    auctionLength: auctionLength,
                    termLength: termLength,
                    auctionBalance: new BigNumber(loanMinAmount).multipliedBy(2).minus(operatorBalance).toString(),
                    loanWithdrawnAmount: bidAmountWithInterest,
                    borrowerDebt: debt,
                    maxInterestRate: loanMaxInterestRate,
                    operatorFee: new BigNumber('1').multipliedBy(decimals).toString(),
                    operatorBalance: operatorBalance,
                    loanWithdrawn: true,
                    minimumReached: true,
                    currentState: 5,
                },
                daiToken: {
                    balanceOf: [
                        {[deposit.address]: new BigNumber('200').multipliedBy(decimals).toString()},
                        {[loan.address]: new BigNumber(bidAmountWithInterest).plus(operatorBalance).minus(bidAmountWithInterest).toString()},
                        {[user]: new BigNumber('200').multipliedBy(decimals).plus(bidAmountWithInterest).toString()},
                        {[borrower]: new BigNumber('200').multipliedBy(decimals).minus(operatorBalance).minus(new BigNumber(bidAmountWithInterest).minus(new BigNumber(loanMinAmount).multipliedBy(2).toString())).toString()},
                        {[admin]: new BigNumber(0).dividedBy(1).toString()},
                    ],
                },
            });

            assert.equal(
                await loan.getInterestRate.call(),
                new BigNumber('0').multipliedBy(decimals).toString(),
                'getInterestRate'
            );

            await loan.unlockFundsWithdrawal({from: borrower})
                .then(Utils.receiptShouldFailed)
                .catch(Utils.catchReceiptShouldFailed);

            await loan.unlockFundsWithdrawal({from: admin})
                .then(Utils.receiptShouldSucceed);

            await loan.withdrawFundsUnlocked({from: user})
                .then(Utils.receiptShouldFailed)
                .catch(Utils.catchReceiptShouldFailed);
        });

        it('withdrawFundsUnlocked', async () => {
            await Utils.checkState({loan}, {
                loan: {
                    originator: borrower,
                    administrator: admin,
                    minAmount: loanMinAmount,
                    maxAmount: loanMaxAmount,
                    auctionEndTimestamp: new BigNumber(await loan.auctionStartTimestamp.call()).plus(auctionLength).toString(),
                    auctionLength: auctionLength,
                    termLength: termLength,
                    auctionBalance: 0,
                    loanWithdrawnAmount: 0,
                    borrowerDebt: 0,
                    maxInterestRate: loanMaxInterestRate,
                    operatorFee: new BigNumber('1').multipliedBy(decimals).toString(),
                    operatorBalance: 0,
                    loanWithdrawn: false,
                    minimumReached: false,
                    currentState: 0,
                }
            });

            await kyc.setAdministrator(admin, {from: owner});
            await kyc.addAddressToKYC(user, {from: admin})
                .then(Utils.receiptShouldSucceed);
            await daiToken.transferFakeHeroTokens(user, {from: owner});
            await daiToken.transferFakeHeroTokens(user, {from: owner});
            await daiToken.transferFakeHeroTokens(user, {from: owner});
            await daiToken.transferFakeHeroTokens(user, {from: owner});
            await daiToken.transferFakeHeroTokens(borrower, {from: owner});
            await daiToken.increaseAllowance(deposit.address, new BigNumber('200').multipliedBy(decimals).toString(), {from: user});
            await deposit.depositFor(user)
                .then(Utils.receiptShouldSucceed);
            await daiToken.increaseAllowance(daiProxy.address, new BigNumber('800').multipliedBy(decimals).toString(), {from: user});

            assert.equal(
                await daiToken.balanceOf.call(user),
                new BigNumber('600').multipliedBy(decimals).toString(),
                'balanceOf is not equal'
            );
            assert.equal(
                await daiToken.balanceOf.call(loan.address),
                new BigNumber('0').multipliedBy(decimals).toString(),
                'balanceOf is not equal'
            );

            await daiProxy.fund(loan.address, new BigNumber(loanMinAmount).multipliedBy(3).toString(), {from: user})
                .then(Utils.receiptShouldSucceed);

            assert.equal(
                await daiToken.balanceOf.call(user),
                new BigNumber('200').multipliedBy(decimals).toString(),
                'balanceOf is not equal'
            );
            assert.equal(
                await daiToken.balanceOf.call(loan.address),
                new BigNumber('400').multipliedBy(decimals).toString(),
                'balanceOf is not equal'
            );

            await loan.unlockFundsWithdrawal({from: admin})
                .then(Utils.receiptShouldSucceed);

            await loan.withdrawFundsUnlocked({from: borrower})
                .then(Utils.receiptShouldFailed)
                .catch(Utils.catchReceiptShouldFailed);

            assert.equal(
                await loan.getLenderWithdrawn.call(user),
                false,
                'getLenderWithdrawn is not equal'
            );

            await loan.withdrawFundsUnlocked({from: user})
                .then(Utils.receiptShouldSucceed);

            await loan.withdrawFundsUnlocked({from: user})
                .then(Utils.receiptShouldFailed)
                .catch(Utils.catchReceiptShouldFailed);

            await loan.withdrawRepayment({from: user})
                .then(Utils.receiptShouldFailed)
                .catch(Utils.catchReceiptShouldFailed);

            assert.equal(
                await loan.getLenderWithdrawn.call(user),
                true,
                'getLenderWithdrawn is not equal'
            );
            assert.equal(
                await loan.loanWithdrawnAmount.call(),
                new BigNumber(loanMinAmount).multipliedBy(2).toString(),
                'loanWithdrawnAmount is not equal'
            );

            assert.equal(
                await daiToken.balanceOf.call(user),
                new BigNumber('600').multipliedBy(decimals).toString(),
                'balanceOf is not equal'
            );
            assert.equal(
                await daiToken.balanceOf.call(loan.address),
                new BigNumber('0').multipliedBy(decimals).toString(),
                'balanceOf is not equal'
            );
        });
    });
});
