const chai = require("chai");
const bnChai = require("bn-chai");
const chaiAsPromised = require("chai-as-promised");
const web3 = global.web3;
const {BN} = web3.utils;
chai.use(chaiAsPromised);
chai.use(bnChai(BN));
const truffleAssert = require("truffle-assertions");
const {expect} = chai;
const DAIProxyContract = artifacts.require("DAIProxy");
const HeroFakeTokenContract = artifacts.require("HeroFakeToken");
const LoanContract = artifacts.require("LoanContract");
const AuthContract = artifacts.require("Authorization");
const DepositRegistryContract = artifacts.require("DepositRegistry");
const KYCContract = artifacts.require("KYCRegistry");
const SwapFactoryContract = artifacts.require("SwapAndDepositFactory");
const LoanContractDispatcherContract = artifacts.require("LoanContractDispatcher");

const HeroAmount = "200000000000000000000";
const helpers = require("./helpers.js");

const zeroAddress = "0x0000000000000000000000000000000000000000";

contract("LoanContractDispatcher", accounts => {
  let DAIProxy;
  let DAIToken;
  let DepositRegistry;
  let KYCRegistry;
  let Auth;
  let LoanDispatcher;
  let SwapFactory;

  const averageMiningBlockTime = 15;

  const owner = accounts[0];
  const lender = accounts[1];
  const borrower = accounts[2];
  const admin = accounts[3];

  describe("Unit tests for LoanContractDispatcher", () => {
    before(async () => {
      try {
        DAIToken = await HeroFakeTokenContract.new({from: owner});
        HeroToken = await HeroFakeTokenContract.new({from: owner});
        SwapFactory = await SwapFactoryContract.new(zeroAddress, zeroAddress, zeroAddress, {
          from: owner
        });
        // adding lender and borrower to KYC
        KYCRegistry = await KYCContract.new();
        await KYCRegistry.setAdministrator(admin);
        await KYCRegistry.addAddressToKYC(borrower, {from: admin});

        // give permision to the deposit registry to deposit tokens instead of the lender
        DepositRegistry = await DepositRegistryContract.new(
          HeroToken.address,
          KYCRegistry.address,
          {from: owner}
        );

        // initialize proxies for lender and borrower
        Auth = await AuthContract.new(KYCRegistry.address, DepositRegistry.address);
        DAIProxy = await DAIProxyContract.new(Auth.address, {from: owner});

        // check KYC and Deposit
        borrowerKYC = await Auth.isKYCConfirmed(borrower);

        lenderHasDeposited = await Auth.hasDeposited(lender);
      } catch (error) {
        throw error;
      }
    });
    describe("Setters", () => {
      beforeEach(async () => {
        // initialize loan contract dispatcher
        LoanDispatcher = await LoanContractDispatcherContract.new(
          Auth.address,
          DAIProxy.address,
          SwapFactory.address,
          {
            from: owner
          }
        );
      });
      it("Expects to set administrator as owner", async () => {
        await LoanDispatcher.setAdministrator(admin, {from: owner});
        const administrator = await LoanDispatcher.administrator();
        expect(administrator).to.equal(admin);
      });
      it("Expects to not be able set administrator as not owner", async () => {
        try {
          await LoanDispatcher.setAdministrator(admin, {from: lender});
        } catch (error) {
          expect(error).to.not.equal(undefined);
        }
      });
      it("Expects to change operator fee", async () => {
        try {
          const desiredOperatorFee = web3.utils.toWei(new BN(5));
          await LoanDispatcher.setAdministrator(admin, {from: owner});
          await LoanDispatcher.setOperatorFee(desiredOperatorFee, {from: admin});
          const currentOperatorFee = await LoanDispatcher.operatorFee();
          expect(currentOperatorFee).to.eq.BN(currentOperatorFee);
        } catch (error) {
          throw error;
        }
      });
    });
    describe("Deployment of loan contracts", async () => {
      beforeEach(async () => {
        // initialize loan contract dispatcher
        LoanDispatcher = await LoanContractDispatcherContract.new(
          Auth.address,
          DAIProxy.address,
          SwapFactory.address,
          {
            from: owner
          }
        );
      });
      it("Expects to deploy loan contract when conditions are correct", async () => {
        try {
          await LoanDispatcher.setAdministrator(admin, {from: owner});
          await LoanDispatcher.addTokenToAcceptedList(DAIToken.address, {from: admin});

          const minAmount = "1000000000000000000000";
          const maxAmount = "2500000000000000000000000";
          const minInterestRate = 0;
          const maxInterestRate = 1500;
          const termLength = 2592000;
          const auctionLength = 2592000;
          await LoanDispatcher.deploy(
            minAmount,
            maxAmount,
            minInterestRate,
            maxInterestRate,
            termLength,
            auctionLength,
            DAIToken.address,
            {from: borrower}
          );
          const loanEventHistory = await LoanDispatcher.getPastEvents("LoanContractCreated"); // {fromBlock: 0, toBlock: "latest"} put this to get all
          const loanAddress = loanEventHistory[0].returnValues.contractAddress;
          expect(loanAddress).to.not.equal(undefined);
        } catch (error) {
          expect(error).to.equal(undefined);
        }
      });
      it("Expects not to deploy loan contract when admin is not set", async () => {
        try {

          const minAmount = "1000000000000000000000";
          const maxAmount = "2500000000000000000000000";
          const maxInterestRate = 1500;
          const termLength = 2592000;
          const auctionLength = 2592000;
          await LoanDispatcher.deploy(
            minAmount,
            maxAmount,
            maxInterestRate,
            termLength,
            auctionLength,
            DAIToken.address,
            {from: borrower}
          );
        } catch (error) {
          expect(error).to.not.equal(undefined);
        }
      });
    });
  });
});
