module.exports = {
  client: require("ganache-cli"),
  skipFiles: ["Migrations.sol", "Mocks/"],
  providerOptions: {
    default_balance_ether: 10000000,
    vmErrorsOnRPCResponse: false
  }
};
