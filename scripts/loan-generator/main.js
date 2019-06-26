const { loanGenerator } = require('./LoanGenerator');
const { randomLoansMutator } = require('./LoanMutator');
const { depositIfNeeded } = require('./DepositIfNeeded');
const { approveCurrentAccounts } = require('./InfiniteApprove');

module.exports = async function (callback) {
  try {
    const numberLoans = !!process.env.NUMBER_LOANS ? Number(process.env.NUMBER_LOANS) : 10;
    const network = await web3.eth.net.getId();
    if (network !== 1) {
      await depositIfNeeded(web3);
      await approveCurrentAccounts(web3);
      console.log('~ Generating',numberLoans, 'loans')
      const { createdLoans, errors } = await loanGenerator(numberLoans, web3);

      console.log('Generated loans', createdLoans.length);
      console.log('Tx errors', errors.length);
      
      await randomLoansMutator(web3, createdLoans.map(x => x.contractAddress));
    }
  } catch (err) {
    console.log(err);
    return err;
  }
  callback();
};