const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
chai.use(chaiAsPromised)
const { expect } = chai
const LoanMaster = artifacts.require('LoanMaster')
const LoanToken = artifacts.require('LoanToken')

contract('LoanMaster Contract', function (accounts) {
  const symbol = 'HLT'
  const name = 'HeroToken'

  let token
  let Master

  const owner = accounts[0]
  const firstLender = accounts[1]
  const secondLender = accounts[2]
  const defaultOriginator = accounts[3]
  const secondOriginator = accounts[4]

  describe('deploy', () => {
    it('should be able to deploy and create associated token contract', async () => {
      Master = await LoanMaster.new()
      token = await LoanToken.at(await Master.token())
      expect(await token.symbol()).to.equal(symbol)
      expect(await token.name()).to.equal(name)
    })
  })

  describe('createLoan', () => {
    it('should be able to create a loan with tokens', async () => {
      Master = await LoanMaster.new()
      token = await LoanToken.at(await Master.token())

      const ownerBalanceBefore = await web3.eth.getBalance(owner)
      const originatorBalanceBefore = await web3.eth.getBalance(defaultOriginator)

      await Master.createLoan(defaultOriginator, 1000, "loan1", { from: firstLender, value: 1050 })
      await Master.createLoan(defaultOriginator, 2000, "loan1", { from: secondLender, value: 2100 })

      const ownerBalanceAfter = await web3.eth.getBalance(owner)
      const originatorBalanceAfter = await web3.eth.getBalance(defaultOriginator)

      // Balance Validation
      expect(Number(ownerBalanceBefore) + 150).to.eql(Number(ownerBalanceAfter));
      expect(Number(originatorBalanceBefore) + 3000).to.eql(Number(originatorBalanceAfter));

      // Token Validation
      const [loanOne, loanTwo] = await Master.getLoanTokenIds("loan1")

      const repaymentRemainingOne = await token.repaymentRemaining(loanOne)
      const originatorOne = await token.getLoanOriginator(loanOne)
      expect(repaymentRemainingOne.toNumber()).to.eql(1000)
      expect(originatorOne).to.eql(defaultOriginator)

      const repaymentRemainingTwo = await token.repaymentRemaining(loanTwo)
      const originatorTwo = await token.getLoanOriginator(loanTwo)
      expect(repaymentRemainingTwo.toNumber()).to.eql(2000)
      expect(originatorTwo).to.eql(defaultOriginator)
    })

    it('a loan creation fails if the originator is not the same for each loan', async () => {
      Master = await LoanMaster.new()
      token = await LoanToken.at(await Master.token())

      await Master.createLoan(defaultOriginator, 1000, "loan1", { from: firstLender, value: 1050 })
      const changedOriginator = Master.createLoan(secondOriginator, 2000, "loan1", { from: secondLender, value: 2100 })
      await expect(changedOriginator).to.eventually.be.rejectedWith(/There can only be one originator on a loan/)
    })
  })

  describe('completeLoan', () => {
    it('should be able to repay a loan to completion', async () => {
      Master = await LoanMaster.new()
      token = await LoanToken.at(await Master.token())

      await Master.createLoan(defaultOriginator, 1000, "loan1", { from: firstLender, value: 1050 })
      await Master.createLoan(defaultOriginator, 2000, "loan1", { from: secondLender, value: 2100 })

      const lenderOneBalanceBefore = await web3.eth.getBalance(firstLender)
      const lenderTwoBalanceBefore = await web3.eth.getBalance(secondLender)

      await Master.completeLoan("loan1", { from: defaultOriginator, value: 3000 })

      const lenderOneBalanceAfter = await web3.eth.getBalance(firstLender)
      const lenderTwoBalanceAfter = await web3.eth.getBalance(secondLender)

      expect(Number(lenderOneBalanceBefore) + 1000).to.eql(Number(lenderOneBalanceAfter));
      expect(Number(lenderTwoBalanceBefore) + 2000).to.eql(Number(lenderTwoBalanceAfter));
    })

    it('only the originator can repay the loan', async () => {
      Master = await LoanMaster.new()
      token = await LoanToken.at(await Master.token())

      await Master.createLoan(defaultOriginator, 1000, "loan1", { from: firstLender, value: 1050 })
      const failedPayment = Master.completeLoan("loan1", { from: firstLender, value: 3000 })

      await expect(failedPayment).to.eventually.be.rejectedWith(/Only the originator can pay off the loan/)
    })

    it('throws an error if the loan doesn\'t exist', async () => {
      Master = await LoanMaster.new()
      token = await LoanToken.at(await Master.token())

      const failedPayment = Master.completeLoan("loan1", { from: firstLender, value: 3000 })

      await expect(failedPayment).to.eventually.be.rejectedWith(/No tokens associated with this loan/)
    })
  })

  describe('setFee', () => {
    it('should be able to change the fee on a token', async () => {
      Master = await LoanMaster.new()

      const initFee = await Master.creationFeeBasisPoints();
      expect(initFee.toNumber()).to.eql(500)

      await Master.setFeeRate(1000)

      const newFee = await Master.creationFeeBasisPoints();
      expect(newFee.toNumber()).to.eql(1000)
    })

    it('cannot set a fee above 100%', async () => {
      Master = await LoanMaster.new()

      const failedFeeSet = Master.setFeeRate(10000)
      await expect(failedFeeSet).to.eventually.be.rejectedWith(/Cant charge more than 100% fee/)
    })

    it('cannot set a fee unless the owner', async () => {
      Master = await LoanMaster.new()

      const failedFeeSet = Master.setFeeRate(100, { from: firstLender })
      await expect(failedFeeSet).to.eventually.be.rejectedWith(/revert/)
    })
  })
})
