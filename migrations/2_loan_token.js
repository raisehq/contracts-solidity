var LoanTokens = artifacts.require("./LoanToken.sol");

module.exports = function (deployer) {
  // This migration is only applicable to tests, as the token is instantiated by the Master
  if (process.env.NODE_ENV === 'test') {
    deployer.deploy(LoanTokens);
  }
};
