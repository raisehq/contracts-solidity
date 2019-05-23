const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
chai.use(chaiAsPromised)
const { expect } = chai
const LoanToken = artifacts.require('LoanToken')

contract('LoanToken Contract', function (accounts) {
  const symbol = 'HLT'
  const name = 'HeroToken'

  let token

  const owner = accounts[0]
  const firstLender = accounts[1]
  const secondLender = accounts[2]
  const defaultOriginator = accounts[3]

  describe('deploy', () => {
    it('should be able to deploy and create a unique ERC721 token', async () => {
      token = await LoanToken.new()
      // NB: The loanId is derivative. As we are modifying state on the contract the await returns the tx hash
      // However, when we make these calls from the master contract we will get access to the values 
      const loanId = 0
      await token.createLoanToken(defaultOriginator, firstLender, 1000, 'customerLoan1', { from: owner })

      expect(await token.symbol()).to.equal(symbol)
      expect(await token.name()).to.equal(name)

      const repaymentRemaining = await token.repaymentRemaining(loanId)
      expect(repaymentRemaining.toNumber()).to.eql(1000)
    })
  })


  describe('repaymentMade', () => {
    it('allows a repayment to be made', async () => {
      token = await LoanToken.new()
      const loanId = 0
      await token.createLoanToken(defaultOriginator, firstLender, 1000, 'customerLoan1', { from: owner })

      await token.repaymentMade(500, loanId)

      const repaymentRemaining = await token.repaymentRemaining(loanId)
      expect(repaymentRemaining.toNumber()).to.eql(500)
    })

    it('repayment references are correct when multiple loans exist', async () => {
      token = await LoanToken.new()
      const loanOne = 0
      const loanTwo = 1
      await token.createLoanToken(defaultOriginator, firstLender, 1000, 'customerLoan1', { from: owner })
      await token.createLoanToken(defaultOriginator, secondLender, 500, 'customerLoan1', { from: owner })

      await token.repaymentMade(500, loanOne)
      await token.repaymentMade(500, loanTwo)

      const repaymentRemainingOne = await token.repaymentRemaining(loanOne)
      const repaymentRemainingTwo = await token.repaymentRemaining(loanTwo)

      expect(repaymentRemainingOne.toNumber()).to.eql(500)
      expect(repaymentRemainingTwo.toNumber()).to.eql(0)
    })

    it('throws an error if the repayment is larger than the loan amount', async () => {
      token = await LoanToken.new()
      const loanId = 0
      await token.createLoanToken(defaultOriginator, firstLender, 1000, 'customerLoan1', { from: owner })

      const overRepayment = token.repaymentMade(5000, loanId)

      // NB: The eventually keyword from Chai as Promised makes this a promise
      await expect(overRepayment).to.eventually.be.rejectedWith(/Cannot overpay loan/)
    })
  })

  describe('createLoanToken', () => {
    it('correctly identifies the owner', async () => {
      token = await LoanToken.new()
      const loanId = 0
      await token.createLoanToken(defaultOriginator, firstLender, 1000, 'customerLoan1', { from: owner })

      const tokenOwner = await token.ownerOf(loanId)
      expect(tokenOwner).to.eql(firstLender)
    })

    it('allows the token to be transferred by the owner of the token', async () => {
      token = await LoanToken.new()
      const loanId = 0
      await token.createLoanToken(defaultOriginator, firstLender, 1000, 'customerLoan1', { from: owner })

      const tokenOwner = await token.ownerOf(loanId)
      expect(tokenOwner).to.eql(firstLender)

      await token.safeTransferFrom(firstLender, secondLender, loanId, { from: firstLender })

      const newOwner = await token.ownerOf(loanId)
      expect(newOwner).to.eql(secondLender)
    })

    it('does not allow anyone but the owner of the token to transfer', async () => {
      token = await LoanToken.new()
      const loanId = 0
      await token.createLoanToken(defaultOriginator, firstLender, 1000, 'customerLoan1', { from: owner })

      const tokenOwner = await token.ownerOf(loanId)
      expect(tokenOwner).to.eql(firstLender)

      const failedTransfer = token.safeTransferFrom(firstLender, secondLender, loanId, { from: secondLender })
      await expect(failedTransfer).to.eventually.be.rejectedWith(/VM Exception while processing transaction: revert/)
    })

    it('if someone has multiple tokens, transfer only transfers the correct token', async () => {
      token = await LoanToken.new()
      const loanOne = 0
      const loanTwo = 1
      await token.createLoanToken(defaultOriginator, firstLender, 1000, 'customerLoan1', { from: owner })
      await token.createLoanToken(defaultOriginator, firstLender, 1000, 'customerLoan1', { from: owner })

      const ownerOne = await token.ownerOf(loanOne)
      const ownerTwo = await token.ownerOf(loanTwo)
      expect(ownerOne).to.eql(firstLender)
      expect(ownerTwo).to.eql(firstLender)

      await token.safeTransferFrom(firstLender, secondLender, loanOne, { from: firstLender })

      const newOwner = await token.ownerOf(loanOne)
      expect(newOwner).to.eql(secondLender)

      const originalOwner = await token.ownerOf(loanTwo)
      expect(originalOwner).to.eql(firstLender)
    })
  })
})
