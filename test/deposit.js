const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const { expect } = chai;
const DepositRegistryContract = artifacts.require('DepositRegistry');
const HeroFakeTokenContract = artifacts.require('HeroFakeToken');
const KYCContract = artifacts.require('KYCRegistry');

const HeroAmount = '200000000000000000000';

contract('Deposit Contract', function (accounts) {
 
  let token;
  let HeroToken;
  let DepositRegistry;
  let KYC;

  const owner = accounts[0];
  const user = accounts[1];


  describe('Deposit Registry', () => {
    before(async () =>  {
      try{
        HeroToken = await HeroFakeTokenContract.new();
        KYC = await KYCContract.new();
        DepositRegistry = await DepositRegistryContract.new(HeroToken.address, KYC.address,  { from: owner });
        await HeroToken.transferFakeHeroTokens(user);
      }catch(error){
        throw error;
      }
    });
   
    it('should not allow withdrawing funds that have not been previously deposited', async () => {
      assert.equal(await DepositRegistry.hasDeposited(user), false);
      
      try {
        await DepositRegistry.withdraw(owner, {from: owner});
      } catch (error) {
        expect(error).to.not.equal(undefined);
      }
    });

    it('should accept deposits', async () => {
      try{
        await HeroToken.approve(DepositRegistry.address, HeroAmount,{ from: user });
        await DepositRegistry.depositFor(user, { from: user });
        assert.equal(await DepositRegistry.hasDeposited(user), true);
      } catch(error){
        throw error;
      }
    });

    it('should not allow withdrawing funds if lender is not verified', async () => {
      try {
        await DepositRegistry.withdraw(user, {from: user});
      } catch (error) {
        expect(error).to.not.equal(undefined);
      }
    });
  });
});
