const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
chai.use(chaiAsPromised)
const { expect } = chai
const DAIProxyContract = artifacts.require('DAIProxy');
const AuthContract = artifacts.require('Authorization');
const DepositRegistryContract = artifacts.require('DepositRegistry');
const HeroFakeTokenContract = artifacts.require('HeroFakeToken');
const KYCContract = artifacts.require('KYCRegistry');

contract('DAIProxy Contract', function (accounts) {
    let DAIProxy;
    let Auth;
    let HeroFakeToken;
    let DepositRegistry;
    let KYCRegistry;

    const owner = accounts[0];
    const user = accounts[1];
    const user2 = accounts[2];

    describe('deploy', () => {
        it('should be able to deploy and create associated token contract', async () => {
            HeroFakeToken = await HeroFakeTokenContract.new({from: owner});
            await HeroFakeToken.transferFakeHeroTokens(user, {from: owner});
            DepositRegistry = await DepositRegistryContract.new(HeroFakeToken.address,  { from: owner});

            await HeroFakeToken.approve(DepositRegistry.address, 200, { from: user });
            await DepositRegistry.depositFor(owner, {from: owner});

            KYCRegistry = await KYCContract.new();
            await KYCRegistry.add(user);
            Auth = await Authorization.new(KYCRegistry.address, DepositRegistry.address);
            // DAIProxy = await DAIProxyContract.new(Auth.address, );

            expect(await DepositRegistry.hasDeposited(owner)).toEqual(true);
        })
    })

})