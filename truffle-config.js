require("@babel/polyfill");
const fs = require('fs');
const LedgerProvider = require('@deconet/truffle-ledger-provider');

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
//
// const fs = require('fs');
// const mnemonic = fs.readFileSync(".secret").toString().trim();
const infuraApi = (network) => `https://${network}.infura.io/v3/b707e018ae6f427384b54ad4df490a78`;
const HDWalletProvider = require('truffle-hdwallet-provider');
const ownerKey =
  process.env.PRIVATE_KEY || fs.readFileSync('./private.key').toString();
const adminKey = 
  process.env.PRIVATE_KEY || fs.readFileSync('./private.key').toString();
const privateKeys = [ownerKey, adminKey]
const ledgerDefaultConfig = {
  path: "44'/60'/0'/0", // ledger default derivation path
  askConfirm: false,
  accountsLength: 1,
  accountsOffset: 1
}
module.exports = {
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
      host: 'localhost',
      port: 8545,
      gas: 8000000,
      gasPrice: 1000000000,
      network_id: '*' // Match any network id
    },
    coverage: {
      host: "localhost",
      network_id: "*",
      port: 8545,         // <-- If you change this, also set the port option in .solcover.js.
      gas: 0xfffffffffff, // <-- Use this high gas value
      gasPrice: 0x01      // <-- Use this low gas price
    },
    kovan: {
      gas: 8000000,
      gasPrice: 1000000000,
      provider: function() {
        return new HDWalletProvider(privateKeys, infuraApi('kovan'), 0, 2);
      },
      skipDryRun: true,
      network_id: '42', // Kovan network id
    },
    goerli: {
      //gas: 4465030,
      gas: 8000000,
      gasPrice: 10000000000,
      provider: function() {
        return new HDWalletProvider(privateKeys, infuraApi('goerli'), 0, 2);
      },
      skipDryRun: true,
      network_id: '5', // Görli network id
    },
    kovan_ledger: {
      gas: 8000000,
      gasPrice: 100000000,
      network_id: '42', // rinkeby,
      skipDryRun: true,
      provider: function() {
        const ledgerOptions = {
          ...ledgerDefaultConfig,
          networkId: 42, // kovan
        };
        return new LedgerProvider(ledgerOptions, infuraApi('kovan'), true);
      }
    },
    rinkeby_ledger: {
      gas: 8000000,
      gasPrice: 100000000,
      network_id: '4', // rinkeby
      provider: function() {
        const ledgerOptions = {
          ...ledgerDefaultConfig,
          networkId: 4, // rinkeby
        };
        return new LedgerProvider(ledgerOptions, infuraApi('rinkeby'));
      },
    },
    mainnet_ledger: {
      gas: 8000000,
      gasPrice: 100000000,
      network_id: '1', // mainnet
      provider: function() {
        const ledgerOptions = {
          ...ledgerDefaultConfig,
          networkId: 1, // mainnet
        };
        return new LedgerProvider(ledgerOptions, infuraApi('mainnet'));
      },
    }
  },

  // Set default mocha options here, use special reporters etc.
  mocha: {
    // timeout: 100000
  },

  // Configure your compilers
  compilers: {
    solc: {
      version: '0.5.10',
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  }
};
