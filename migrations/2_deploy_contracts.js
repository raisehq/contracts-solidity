const Deposit = artifacts.require('DepositRegistry')
const KYC = artifacts.require('KYCRegistry')
const Auth = artifacts.require('Authorization')
const HeroToken = artifact.require('HeroToken')

module.exports = async (deployer, network, accounts) => {
    try {
        const deployerAddress = accounts[0];

        const heroToken = await deployer.deploy(HeroToken, {from: deployerAddress});

        const depositRegistry = await deployer.deploy(Deposit, heroToken.address, {from: deployerAddress});

        const kyc = await deployer.deploy(KYC, {from: deployerAddress})
        
    } catch (error) {
        throw error;
    }
}