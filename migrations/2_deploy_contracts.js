const Deposit = artifacts.require('DepositRegistry')
const KYC = artifacts.require('KYCRegistry')
const Auth = artifacts.require('Authorization')
const HeroToken = artifacts.require('HeroOrigenToken')

module.exports = function(deployer, network, accounts)  {
    try {

        const deployerAddress = accounts[0];

        deployer.deploy(HeroToken, {from: deployerAddress});
        //deployer.deploy(Deposit, HeroToken.address, {from: deployerAddress});
		//deployer.deploy(KYC, {from: deployerAddress})
		//deployer.deploy(Auth, KYC.address, Deposit.address, {from: deployerAddress})

        
    } catch (error) {
        throw error;
    }
}