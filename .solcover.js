module.exports = {
  skipFiles: ["Migrations.sol", "Mocks/"],
  providerOptions: {
    default_balance_ether: 10000000,
    vmErrorsOnRPCResponse: false,
    gasLimit: 0x1fffffffffffff,
    allowUnlimitedContractSize: true
  }
};
