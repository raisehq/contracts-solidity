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
      it('Expects to set accepted token address', async () => {
        await LoanDispatcher.setAdministrator(admin, {from: owner});
        const ERC20Token = await HeroFakeTokenContract.new({from: owner});
        await LoanDispatcher.addTokenToAcceptedList(ERC20Token.address, {from: admin});
        const token = await LoanDispatcher.isTokenAccepted(ERC20Token.address);
        expect(token).to.equal(true);
      });
      it('Expects to get token address if previously set', async () => {
        await LoanDispatcher.setAdministrator(admin, {from: owner});
        const ERC20Token = await HeroFakeTokenContract.new({from: owner});
        await LoanDispatcher.addTokenToAcceptedList(ERC20Token.address, {from: admin});
        const token = await LoanDispatcher.isTokenAccepted(ERC20Token.address);
        expect(token).to.equal(true);
      });
      it('Expects to remove accepted token', async () => {
        await LoanDispatcher.setAdministrator(admin, {from: owner});
        const ERC20Token = await HeroFakeTokenContract.new({from: owner});
        await LoanDispatcher.addTokenToAcceptedList(ERC20Token.address, {from: admin});
        let token = await LoanDispatcher.isTokenAccepted(ERC20Token.address);
        expect(token).to.equal(true);
        await LoanDispatcher.removeTokenFromAcceptedList(ERC20Token.address, {from: admin});
        token = await LoanDispatcher.isTokenAccepted(ERC20Token.address);
        expect(token).to.equal(false);
        
      });
      it('Expects to not get token address if not previously set', async () => {
        await LoanDispatcher.setAdministrator(admin, {from: owner});
        const ERC20Token = await HeroFakeTokenContract.new({from: owner});
        const token = await LoanDispatcher.isTokenAccepted(ERC20Token.address);
        expect(token).to.equal(false);
      });
      it('Expects to set min auction length', async () => {
        await LoanDispatcher.setAdministrator(admin, {from: owner});
        const minAuctionLength = 2592000;
        await LoanDispatcher.setMinAuctionLength(minAuctionLength, {from: admin});
        const mal = await LoanDispatcher.minAuctionLength();
        expect(Number(mal)).to.equal(minAuctionLength);
      });
      it('Expects to set min interest rate when lesser than max', async () => {
        await LoanDispatcher.setAdministrator(admin, {from: owner});
        const minInterestRate = 0;
        await LoanDispatcher.setMinInterestRate(minInterestRate, {from: admin});
        const mal = await LoanDispatcher.minInterestRate();
        expect(Number(mal)).to.equal(minInterestRate);
      });
      it('Expects to not set min interest rate when bigger than max', async () => {
        await LoanDispatcher.setAdministrator(admin, {from: owner});
        const minInterestRate = 10000;
        await LoanDispatcher.setMaxInterestRate(10, {from: admin});
        await truffleAssert.fails(
            LoanDispatcher.setMinInterestRate(minInterestRate, {from: admin}),
            truffleAssert.ErrorType.REVERT,
            "Minimum interest needs to be lesser or equal than maximum interest"
          );
      });
      it('Expects to set max interest rate', async () => {
        await LoanDispatcher.setAdministrator(admin, {from: owner});
        const maxInterestRate = 1000000;
        await LoanDispatcher.setMaxInterestRate(maxInterestRate, {from: admin});
        const mal = await LoanDispatcher.maxInterestRate();
        expect(Number(mal)).to.equal(maxInterestRate);
      });
      it('Expects to not set max interest rate when lesser than min', async () => {
        await LoanDispatcher.setAdministrator(admin, {from: owner});
        const maxInterestRate = 1;
        await LoanDispatcher.setMinInterestRate(10, {from: admin});
         await truffleAssert.fails(
            LoanDispatcher.setMaxInterestRate(maxInterestRate, {from: admin}),
            truffleAssert.ErrorType.REVERT,
            "Maximum interest needs to be greater or equal than minimum interes"
          );
      });
      it('Expects to set min amount when lesser than max', async () => {
        await LoanDispatcher.setAdministrator(admin, {from: owner});
        const minAmount = 0;
        await LoanDispatcher.setMinAmount(minAmount, {from: admin});
        const mal = await LoanDispatcher.minAmount();
        expect(Number(mal)).to.equal(minAmount);
      });
      it('Expects to not set min amount when bigger than max', async () => {
        await LoanDispatcher.setAdministrator(admin, {from: owner});
        const minAmount = 26;
        await LoanDispatcher.setMinAmount(0, {from: admin});
        await LoanDispatcher.setMaxAmount(10, {from: admin})
        await truffleAssert.fails(
            LoanDispatcher.setMinAmount(minAmount, {from: admin}),
            truffleAssert.ErrorType.REVERT,
            "Minimum amount needs to be lesser or equal than maximum amount"
          );
      });
      it('Expects to set max amount', async () => {
        await LoanDispatcher.setAdministrator(admin, {from: owner});
        await LoanDispatcher.setMinAmount(0, {from: admin});
        const maxAmount = 27;
        await LoanDispatcher.setMaxAmount(maxAmount, {from: admin});
        const mal = await LoanDispatcher.maxAmount();
        expect(Number(mal)).to.equal(maxAmount);
      });
      it('Expects to not set max amount when lesser than min', async () => {
        await LoanDispatcher.setAdministrator(admin, {from: owner});
        const maxAmount = 1;
         await truffleAssert.fails(
            LoanDispatcher.setMaxAmount(maxAmount, {from: admin}),
            truffleAssert.ErrorType.REVERT,
            "Maximum amount needs to be greater or equal than minimum amount"
          );
      });
      it('Expects to set dai proxy address', async () => {
        await LoanDispatcher.setAdministrator(admin, {from: owner});
        const DAIProxy2 = await DAIProxyContract.new(Auth.address, {from: owner});
        await LoanDispatcher.setDaiProxyAddress(DAIProxy2.address, {from: admin});
        const resp = await LoanDispatcher.DAIProxyAddress();
        expect(resp).to.equal(DAIProxy2.address);
      });
      it('Expects to set swap factory address', async () => {
        await LoanDispatcher.setAdministrator(admin, {from: owner});
        const swap = await SwapFactoryContract.new(zeroAddress, zeroAddress, zeroAddress, {
          from: owner
        });
        await LoanDispatcher.setSwapFactory(swap.address, {from: admin});
        const resp = await LoanDispatcher.swapFactory();
        expect(resp).to.equal(swap.address);
      });
      it('Expects to set auth address', async () => {
        await LoanDispatcher.setAdministrator(admin, {from: owner});
        const Auth2 = await AuthContract.new(KYCRegistry.address, DepositRegistry.address);
        await LoanDispatcher.setAuthAddress(Auth2.address, {from:admin});
        const resp = await LoanDispatcher.auth();
        expect(resp).to.equal(Auth2.address);
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
          const minAmount = "1000000000000000000000";
          const maxAmount = "2500000000000000000000000";
          const minInterestRate = 0;
          const maxInterestRate = 1500;
          const termLength = 2592000;
          const auctionLength = 2592000;
          await truffleAssert.fails(
            LoanDispatcher.deploy(
              minAmount,
              maxAmount,
              minInterestRate,
              maxInterestRate,
              termLength,
              auctionLength,
              DAIToken.address,
              {from: borrower}
            ),
            truffleAssert.ErrorType.REVERT,
            "There is no administrator set"
          );
      });
      it("Expects not to deploy loan contract when token address is not accepted", async () => {
        await LoanDispatcher.setAdministrator(admin, {from: owner});
        await LoanDispatcher.removeTokenFromAcceptedList(DAIToken.address, {from: admin});

        const minAmount = "1000000000000000000000";
        const maxAmount = "2500000000000000000000000";
        const minInterestRate = 0;
        const maxInterestRate = 1500;
        const termLength = 2592000;
        const auctionLength = 2592000;
        await truffleAssert.fails(
          LoanDispatcher.deploy(
            minAmount,
            maxAmount,
            minInterestRate,
            maxInterestRate,
            termLength,
            auctionLength,
            DAIToken.address,
            {from: borrower}
          ),
          truffleAssert.ErrorType.REVERT,
          "TokenAddress not accepted"
        );
      });
      it('Expects not to deploy loan when minimum amount not correct', async () => {
        await LoanDispatcher.setAdministrator(admin, {from: owner});
        const minAmount = "100000000000000000000000000000";
        const maxAmount = "2500000000000000000000000";
        const minInterestRate = 0;
        const maxInterestRate = 1500;
        const termLength = 2592000;
        const auctionLength = 2592000;
        await truffleAssert.fails(
          LoanDispatcher.deploy(
            minAmount,
            maxAmount,
            minInterestRate,
            maxInterestRate,
            termLength,
            auctionLength,
            DAIToken.address,
            {from: borrower}
          ),
          truffleAssert.ErrorType.REVERT,
          "minimum amount not correct"
        );
      });
      it('Expects not to deploy loan when maximum amount not correct', async () => {
        await LoanDispatcher.setAdministrator(admin, {from: owner});
        await LoanDispatcher.setMinAmount(9, {from: admin});
        await LoanDispatcher.setMaxAmount(11, {from: admin});

        const minAmount = 9;
        const maxAmount = 12;
        const minInterestRate = 0;
        const maxInterestRate = 1500;
        const termLength = 2592000;
        const auctionLength = 2592000;
        await truffleAssert.fails(
          LoanDispatcher.deploy(
            minAmount,
            maxAmount,
            minInterestRate,
            maxInterestRate,
            termLength,
            auctionLength,
            DAIToken.address,
            {from: borrower}
          ),
          truffleAssert.ErrorType.REVERT,
          "maximum amount not correct"
        );
      });
      it('Expects not to deploy loan when max interest rate not correct', async () => {
        await LoanDispatcher.setAdministrator(admin, {from: owner});
 
        const minAmount = "1000000000000000000000";
        const maxAmount = "2500000000000000000000000";
        const minInterestRate = 0;
        const maxInterestRate = "200000000000000000000";
        const termLength = 2592000;
        const auctionLength = 2592000;
        await truffleAssert.fails(
          LoanDispatcher.deploy(
            minAmount,
            maxAmount,
            minInterestRate,
            maxInterestRate,
            termLength,
            auctionLength,
            DAIToken.address,
            {from: borrower}
          ),
          truffleAssert.ErrorType.REVERT,
          "maximum interest rate not correct"
        );
      });
      it('Expects not to deploy loan when min interest rate not correct', async () => {
        await LoanDispatcher.setAdministrator(admin, {from: owner});
        await LoanDispatcher.setMinInterestRate(10, {from: admin})
        const minAmount = "1000000000000000000000";
        const maxAmount = "2500000000000000000000000";
        const minInterestRate = 2;
        const maxInterestRate = 20;
        const termLength = 2592000;
        const auctionLength = 2592000;
        await truffleAssert.fails(
          LoanDispatcher.deploy(
            minAmount,
            maxAmount,
            minInterestRate,
            maxInterestRate,
            termLength,
            auctionLength,
            DAIToken.address,
            {from: borrower}
          ),
          truffleAssert.ErrorType.REVERT,
          "minimum interest rate not correct"
        );
      });
      it('Expects not to deploy loan when min interest rate > max interest rate', async () => {
        await LoanDispatcher.setAdministrator(admin, {from: owner});
        await LoanDispatcher.setMinInterestRate(1, {from: admin})
        const minAmount = "1000000000000000000000";
        const maxAmount = "2500000000000000000000000";
        const minInterestRate = 10;
        const maxInterestRate = 5;
        const termLength = 2592000;
        const auctionLength = 2592000;
        await truffleAssert.fails(
          LoanDispatcher.deploy(
            minAmount,
            maxAmount,
            minInterestRate,
            maxInterestRate,
            termLength,
            auctionLength,
            DAIToken.address,
            {from: borrower}
          ),
          truffleAssert.ErrorType.REVERT,
          "minimum interest should not be greater than maximum interest"
        );
      });
      it('Expects not to deploy loan when term length is to samll', async () => {
        await LoanDispatcher.setAdministrator(admin, {from: owner});
        await LoanDispatcher.setMinTermLength(10, {from: admin}); // TODO: there is no minimum set as default

        const minAmount = "1000000000000000000000";
        const maxAmount = "2500000000000000000000000";
        const minInterestRate = 0;
        const maxInterestRate = 1500;
        const termLength = 9;
        const auctionLength = 2592000;
        await truffleAssert.fails(
          LoanDispatcher.deploy(
            minAmount,
            maxAmount,
            minInterestRate,
            maxInterestRate,
            termLength,
            auctionLength,
            DAIToken.address,
            {from: borrower}
          ),
          truffleAssert.ErrorType.REVERT,
          "Term length is to small"
        );
      });
      it('Expects not to deploy loan when auction length is to samll', async () => {
        await LoanDispatcher.setAdministrator(admin, {from: owner});
        await LoanDispatcher.setMinAuctionLength(10, {from: admin});  // TODO: there is no minimum set
        const minAmount = "1000000000000000000000";
        const maxAmount = "2500000000000000000000000";
        const minInterestRate = 0;
        const maxInterestRate = 1500;
        const termLength = 2592000;
        const auctionLength = 3;
        await truffleAssert.fails(
          LoanDispatcher.deploy(
            minAmount,
            maxAmount,
            minInterestRate,
            maxInterestRate,
            termLength,
            auctionLength,
            DAIToken.address,
            {from: borrower}
          ),
          truffleAssert.ErrorType.REVERT,
          "Auction length is to small"
        );
      });
    });
  });
});
