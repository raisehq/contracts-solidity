const { loanGenerator } = require('./LoanGenerator');
const { randomLoansMutator } = require('./LoanMutator.js');
const { depositIfNeeded } = require('./DepositIfNeeded.js');

module.exports = async function (callback) {
  try {
    const numberLoans = !!process.env.NUMBER_LOANS ? Number(process.env.NUMBER_LOANS) : 10;
    const network = await web3.eth.net.getId();
    if (network !== 1) {
      await depositIfNeeded(web3);
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