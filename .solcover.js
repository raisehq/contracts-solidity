module.exports = {
  skipFiles: ["Migrations.sol", "Mocks/"],
  port: 8545,
  providerOptions: {
    default_balance_ether: 10000000000000,
    gasLimit: 0x1fffffffffffff,
    allowUnlimitedContractSize: true
  }
};
