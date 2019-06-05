const Deposit = artifacts.require('DepositRegistry')
const KYC = artifacts.require('KYCRegistry')
const Auth = artifacts.require('Authorization')
const HeroToken = artifacts.require('HeroOrigenToken')

module.exports = async (deployer, network, accounts) => {

   
		const myaccount = await accounts();
        const deployerAddress = myaccount[0];

        await deployer.deploy(HeroToken, {from: deployerAddress});
        await deployer.deploy(Deposit, HeroToken.address, {from: deployerAddress});
		await deployer.deploy(KYC, {from: deployerAddress})
		await deployer.deploy(Auth, KYC.address, Deposit.address, {from: deployerAddress})

        
   
}