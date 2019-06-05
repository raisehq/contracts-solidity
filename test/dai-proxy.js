const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
chai.use(chaiAsPromised)
const { expect } = chai
const DAIProxyContract = artifacts.require('DAIProxy');
const DAIContract = artifacts.require('DAI');
const AuthContract = artifacts.require('Authorization');
const DepositRegistryContract = artifacts.require('DepositRegistry')
const HeroTokenContract = artifacts.require('HeroOrigenToken')

contract('DAIProxy Contract', function (accounts) {
    let token;
    let DAIProxy;
    let Auth;
    let DAI;

    const owner = accounts[0]
    const firstUser = accounts[1]

    xdescribe('deploy', () => {
        it('should be able to deploy and create associated token contract', async () => {
            HeroToken = await HeroTokenContract.new()
            Auth = await Authorization.new()
            DAI = await DAIContract.new();
            DAIProxy = await DAIProxyContract.new(DAI.address)
            DepositRegistry = await DepositRegistryContract.new(HeroToken.address,  { from: owner});

            await HeroToken.approve(DepositRegistry.address, 200,{ from: owner });
            await DepositRegistry.deposit({ from: owner });
            console.log(await DepositRegistry.hasDeposited(owner));
        })
    })

})