usePlugin("@nomiclabs/buidler-truffle5");
usePlugin("buidler-gas-reporter");
usePlugin("solidity-coverage");

// Show accounts
task("accounts", "Prints the list of accounts", async () => {
  const accounts = await web3.eth.getAccounts();

  for (const account of accounts) {
    console.log(account);
  }
});

console.log("Reading buidler config");

const accounts = [
  {
    privateKey: "0x6d05fe3bbf9ae5807ed83bcc59f871c01cdb7c1e78f0cc4395561f07dc0dda72",
    balance: "1000000000000000000000000000000000000"
  },
  {
    privateKey: "0x6d05fa3bbf9ae5807ed83bcc59f871c01cdb7c1e78f0cc4395561f07dc0dda72",
    balance: "1000000000000000000000000000000000000"
  },
  {
    privateKey: "0x6d05fb3bbf9ae5807ed83bcc59f871c01cdb7c1e78f0cc4395561f07dc0dda72",
    balance: "1000000000000000000000000000000000000"
  },
  {
    privateKey: "0x6d05fc3bbf9ae5807ed83bcc59f871c01cdb7c1e78f0cc4395561f07dc0dda72",
    balance: "1000000000000000000000000000000000000"
  },
  {
    privateKey: "0x6d05ff3bbf9ae5807ed83bcc59f871c01cdb7c1e78f0cc4395561f07dc0dda72",
    balance: "1000000000000000000000000000000000000"
  },
  {
    privateKey: "0x6d05f23bbf9ae5807ed83bcc59f871c01cdb7c1e78f0cc4395561f07dc0dda72",
    balance: "1000000000000000000000000000000000000"
  },
  {
    privateKey: "0x6d05f33bbf9ae5807ed83bcc59f871c01cdb7c1e78f0cc4395561f07dc0dda72",
    balance: "1000000000000000000000000000000000000"
  },
  {
    privateKey: "0x6d05f43bbf9ae5807ed83bcc59f871c01cdb7c1e78f0cc4395561f07dc0dda72",
    balance: "1000000000000000000000000000000000000"
  },
  {
    privateKey: "0x6d05f53bbf9ae5807ed83bcc59f871c01cdb7c1e78f0cc4395561f07dc0dda72",
    balance: "1000000000000000000000000000000000000"
  },
  {
    privateKey: "0x6d05f63bbf9ae5807ed83bcc59f871c01cdb7c1e78f0cc4395561f07dc0dda72",
    balance: "1000000000000000000000000000000000000"
  },
  {
    privateKey: "0x6d05f73bbf9ae5807ed83bcc59f871c01cdb7c1e78f0cc4395561f07dc0dda72",
    balance: "1000000000000000000000000000000000000"
  }
];

const GAS_PRICE = 10e9;

const baseNetworkConfig = {
  blockGasLimit: 0x1ffffffffffff,
  gasPrice: GAS_PRICE,
  allowUnlimitedContractSize: true
};

module.exports = {
  gasReporter: {
    enabled: process.env.REPORT_GAS ? true : false
  },
  solc: {
    version: "0.5.12",
    optimizer: {
      enabled: false, // enable logs and stacktrace for testing
      runs: 200
    }
  },
  networks: {
    coverage: {url: "http://localhost:8545", ...baseNetworkConfig},
    buidlerevm: {
      accounts,
      ...baseNetworkConfig
    }
  }
};
