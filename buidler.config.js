usePlugin("@nomiclabs/buidler-truffle5");
usePlugin("buidler-gas-reporter");

// This is a sample Buidler task. To learn how to create your own go to
// https://buidler.dev/guides/create-task.html
task("accounts", "Prints the list of accounts", async () => {
  const accounts = await web3.eth.getAccounts();

  for (const account of accounts) {
    console.log(account);
  }
});

console.log("Reading buidler config");

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
    buidlerevm: {
      blockGasLimit: 100000000,
      accounts: [
        {
          privateKey: "0x6d05fe3bbf9ae5807ed83bcc59f871c01cdb7c1e78f0cc4395561f07dc0dda72",
          balance: "10000000000000000000000000000000000"
        },
        {
          privateKey: "0x6d05fa3bbf9ae5807ed83bcc59f871c01cdb7c1e78f0cc4395561f07dc0dda72",
          balance: "10000000000000000000000000000000000"
        },
        {
          privateKey: "0x6d05fb3bbf9ae5807ed83bcc59f871c01cdb7c1e78f0cc4395561f07dc0dda72",
          balance: "10000000000000000000000000000000000"
        },
        {
          privateKey: "0x6d05fc3bbf9ae5807ed83bcc59f871c01cdb7c1e78f0cc4395561f07dc0dda72",
          balance: "10000000000000000000000000000000000"
        },
        {
          privateKey: "0x6d05ff3bbf9ae5807ed83bcc59f871c01cdb7c1e78f0cc4395561f07dc0dda72",
          balance: "10000000000000000000000000000000000"
        },
        {
          privateKey: "0x6d05f23bbf9ae5807ed83bcc59f871c01cdb7c1e78f0cc4395561f07dc0dda72",
          balance: "10000000000000000000000000000000000"
        },
        {
          privateKey: "0x6d05f33bbf9ae5807ed83bcc59f871c01cdb7c1e78f0cc4395561f07dc0dda72",
          balance: "10000000000000000000000000000000000"
        },
        {
          privateKey: "0x6d05f43bbf9ae5807ed83bcc59f871c01cdb7c1e78f0cc4395561f07dc0dda72",
          balance: "10000000000000000000000000000000000"
        },
        {
          privateKey: "0x6d05f53bbf9ae5807ed83bcc59f871c01cdb7c1e78f0cc4395561f07dc0dda72",
          balance: "10000000000000000000000000000000000"
        },
        {
          privateKey: "0x6d05f63bbf9ae5807ed83bcc59f871c01cdb7c1e78f0cc4395561f07dc0dda72",
          balance: "10000000000000000000000000000000000"
        },
        {
          privateKey: "0x6d05f73bbf9ae5807ed83bcc59f871c01cdb7c1e78f0cc4395561f07dc0dda72",
          balance: "10000000000000000000000000000000000"
        }
      ]
    }
  }
};
