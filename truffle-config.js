const fs = require("fs");

/**
 * Use this file to configure your truffle project. It's seeded with some
 * common settings for different networks and features like migrations,
 * compilation and testing. Uncomment the ones you need or modify
 * them to suit your project as necessary.
 *
 * More information about configuration can be found at:
 *
 * truffleframework.com/docs/advanced/configuration
 *
 * To deploy via Infura you'll need a wallet provider (like truffle-hdwallet-provider)
 * to sign your transactions before they're sent to a remote public node. Infura accounts
 * are available for free at: infura.io/register.
 *
 * You'll also need a mnemonic - the twelve word phrase the wallet uses to generate
 * public/private key pairs. If you're publishing your code to GitHub make sure you load this
 * phrase from a file you've .gitignored so it doesn't accidentally become public.
 *
 */

// const HDWalletProvider = require('truffle-hdwallet-provider');
// const infuraKey = "fj4jll3k.....";

// const mnemonic = fs
//   .readFileSync(".secret")
//   .toString()
//   .trim();
const infuraApi = network => `https://${network}.infura.io/v3/eb15aaa516234d9f9cf16c7ce4517f27`;
const HDWalletProvider = require("@truffle/hdwallet-provider");
const ownerKey = process.env.PRIVATE_KEY || fs.readFileSync("./private.key").toString();
const adminKey = process.env.PRIVATE_KEY || fs.readFileSync("./private.key").toString();
const privateKeys = [ownerKey, adminKey];

module.exports = {
  fixedContracts: {
    KYC: {
      42: true,
      1: true
    },
    Deposit: {
      42: true,
      1: true
    },
    Auth: {
      42: true,
      1: true
    }
  },
  /**
   * Networks define how you connect to your ethereum client and let you set the
   * defaults web3 uses to send transactions. If you don't specify one truffle
   * will spin up a development blockchain for you on port 9545 when you
   * run `develop` or `test`. You can ask a truffle command to use a specific
   * network from the command line, e.g
   *
   * $ truffle test --network <network-name>
   */

  networks: {
    // Useful for testing. The `development` name is special - truffle uses it by default
    // if it's defined here and no other network is specified at the command line.
    // You should run a client (like ganache-cli, geth or parity) in a separate terminal
    // tab if you use this network and you must also set the `host`, `port` and `network_id`
    // options below to some value.
    //
    development: {
      host: "localhost",
      port: 8545,
      //     gas: 9994805,
      gasPrice: 20000000000,
      network_id: "*" // Match any network id
    },
    test: {
      host: "localhost",
      port: 8545,
      //     gas: 9994805,
      gasPrice: 20000000000,
      network_id: "*" // Match any network id
    },
    cypress: {
      host: "localhost",
      port: 8545,
      gas: 0xfffffffffff, // <-- Use this high gas value
      gasPrice: 0x01, // <-- Use this low gas price
      provider: function() {
        return new HDWalletProvider(
          "stamp polar cup smart ill agree human episode reform trigger text forget",
          "http://localhost:8545",
          0,
          10
        );
      }, // <-- Use this low gas price
      network_id: "*" // Match any network id
    },
    kovan: {
      gas: 8000000,
      gasPrice: 1000000000,
      provider: function() {
        return new HDWalletProvider(privateKeys, infuraApi("kovan"), 0, 2);
      },
      skipDryRun: true,
      network_id: "42" // Kovan network id
    },
    goerli: {
      //gas: 4465030,
      gas: 7400000,
      gasPrice: 1000000000,
      provider: function() {
        return new HDWalletProvider(privateKeys, infuraApi("goerli"), 0, 2);
      },
      skipDryRun: true,
      network_id: "5" // Görli network id
    },
    mainnet: {
      networkCheckTimeout: 10000000,
      gasPrice: 9100000000,
      skipDryRun: true,
      network_id: "1", // mainnet
      provider: function() {
        return new HDWalletProvider(privateKeys, infuraApi("mainnet"), 0, 2);
      }
    }
  },

  // Set default mocha options here, use special reporters etc.
  mocha: {
    // timeout: 100000
  },

  // Configure your compilers
  compilers: {
    solc: {
      version: "0.5.12",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        }
      }
    }
  },
  plugins: ["solidity-coverage"]
};
