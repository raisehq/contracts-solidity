const {
  LedgerSubprovider,
  RPCSubprovider,
  Web3ProviderEngine,

} = require('@0x/subproviders');
const ProviderSubprovider = require("web3-provider-engine/subproviders/provider.js");

const TransportNodeHid = require('@ledgerhq/hw-transport-node-hid').default;
const Eth = require('@ledgerhq/hw-app-eth').default;
const Web3 = require('web3')


async function ledgerEthereumNodeJsClientFactoryAsync() {
  const ledgerConnection = await TransportNodeHid.create();
  const ledgerEthClient = new Eth(ledgerConnection);
  return ledgerEthClient;
}

const InfuraLedgerProvider = (options, infuraUrl) => {
  // Create a Web3 Provider Engine
  const providerEngine = new Web3ProviderEngine();
  // Compose our Providers, order matters
  // Use the Ledger Subprovider to intercept all account based requests
  // All other requests will go through the RPCSubprovider
  const ledgerSubprovider = new LedgerSubprovider({
    ...options,
    ledgerEthereumClientFactoryAsync: ledgerEthereumNodeJsClientFactoryAsync,
  });
  providerEngine.addProvider(ledgerSubprovider);
  // Use an RPC provider to route all other requests
  providerEngine.addProvider(new RPCSubprovider(infuraUrl));
  /**
   * HACK: Truffle providers should have `send` function, while `ProviderEngine` creates providers with `sendAsync`,
   * but it can be easily fixed by assigning `sendAsync` to `send`.
   */
  providerEngine.send = providerEngine.sendAsync.bind(providerEngine);
  providerEngine.start()
  return providerEngine;
}

module.exports = InfuraLedgerProvider;