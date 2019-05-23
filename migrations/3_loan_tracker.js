const LoanMaster = artifacts.require("./LoanMaster.sol");

module.exports = function (deployer) {
  deployer.deploy(LoanMaster);
};
