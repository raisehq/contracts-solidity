const { promisify } = require('util');
const BigNumber = require('bignumber.js');
const { BN } = require('web3-utils');
const DaiProxy = require('../build/contracts/DAIProxy.json');
const DaiFake = require('../build/contracts/DAIFake.json');
const { readFileSync } = require('fs');
const axios = require('axios');
const Web3 = require('web3')

const LoanState = (i) => [
  'CREATED', // accepts bids until timelimit initial state
  'FAILED_TO_FUND', // not fully funded in timelimit
  'ACTIVE', // fully funded, inside timelimit
  'DEFAULTED', // not repaid in time loanRepaymentLength
  'REPAID', // the borrower repaid in full, lenders have yet to reclaim funds
  'CLOSED' // from failed_to_fund => last lender to withdraw triggers change / from repaid => fully witdrawn by lenders
][i]

const MAX_GAS_WEI = new BN('9000000');

async function waitNBlocks(web3, n) {
  await Promise.all(
    [...Array(n).keys()].map(i => {
      web3.currentProvider.send({
        jsonrpc: '2.0',
        method: 'evm_mine',
        id: i
      }, () => { });
    })
  );
}

async function latest(web3) {
  const now = web3.utils.toBN((await web3.eth.getBlock('latest')).timestamp)
  return now;
}

function advanceBlock(web3) {
  return promisify(web3.currentProvider.send({
    jsonrpc: '2.0',
    method: 'evm_mine',
  }));
}

// Increase the timestamp in local blockchain, duration param in seconds
async function increaseTime(web3, duration) {
  if (!BN.isBN(duration)) {
    duration = new BN(duration);
  }
  if (duration.isNeg()) throw Error(`Cannot increase time by a negative amount (${duration})`);

  await promisify(web3.currentProvider.send.bind(web3.currentProvider))({
    jsonrpc: '2.0',
    method: 'evm_increaseTime',
    params: [duration.toNumber()],
  });

  await advanceBlock(web3, 1);
}

async function increaseToTime(web3, target) {
  if (!web3.utils.isBN(target)) {
    target = new web3.utils.BN(target);
  }

  const now = await latest(web3);
  if (target.lt(now)) throw Error(`Cannot increase current time (${now}) to a moment in the past (${target})`);
  const diff = target.sub(now);
  return increaseTime(web3, diff);
}

// Convenience constants for commonly-used or difficult to remember bignum values
// Source: compound https://github.com/compound-finance/compound-money-market/blob/241541a62d0611118fb4e7eb324ac0f84bb58c48/test/Utils.js#L24
const bigNums = {
  // 2^256 - 1  http://www.wolframalpha.com/input/?i=2%5E256+-+1
  maxUint: '115792089237316195423570985008687907853269984665640564039457584007913129639935',
};

async function getDaiProxy(web3) {
  const currentNetworkId = await web3.eth.net.getId();
  return new web3.eth.Contract(DaiProxy.abi, DaiProxy.networks[currentNetworkId].address)
}

async function getDai(web3) {
  const currentNetworkId = await web3.eth.net.getId();
  return new web3.eth.Contract(DaiFake.abi, DaiFake.networks[currentNetworkId].address)
}

const getS3Contracts = async () => {
  try {
    console.log('GET Contracts.json definition from S3')
    const { data: contracts } = await axios(
      `https://blockchain-definitions.s3-eu-west-1.amazonaws.com/v4/contracts.json`
    );
    return contracts;
  } catch (error) {
    console.log('what', error)
    if (error.response.status !== 404) throw error;
    console.log(`No exist previous contracts.json we continue and create new one.`);
    return {};
  }
}

const getContracts = async () => {
  try {
    const contracts = JSON.parse(readFileSync(`./contracts.json`));
    return contracts;
  } catch (error) {
    if (error.code === 'ENOENT') {
      const contracts = await getS3Contracts();
      return contracts;
    }
    throw error;
  }
}

const contractIsUpdated = (contracts, netId, name, artifacts) => {
  return !_.hasIn(contracts, `address.${netId}.${name}`) || artifacts['bytecode'] !== _.get(contracts, `bytecode.${name}`);
}
const getWeb3 = (web3Intance) => {
  return new Web3(web3Intance.currentProvider)
}

const getDeployGas = async (web3, artifact, arguments) => {
  try {
    const web3Latest = getWeb3(web3);
    const ContractWeb3 = new web3Latest.eth.Contract(artifact.abi);
    let gas =
      (new BN(
        await ContractWeb3.deploy({ data: artifact.bytecode, arguments }).estimateGas())
      ).add(new BN('1000000'))
    gas = gas.gte(MAX_GAS_WEI) ? MAX_GAS_WEI : gas;
    const gasPrice = new BN(await web3Latest.eth.getGasPrice());
    console.log(`Gas estimation for ${artifact.contractName}:`, web3Latest.utils.fromWei(gas.mul(gasPrice).toString()), 'ether')
    return gas;
  } catch (err) {
    console.log(err)
    throw new Error(err)
  }

}

const getMethodGas = async (web3, artifact, address, method, arguments, options) => {
  const web3Latest = getWeb3(web3);
  const ContractWeb3 = new web3Latest.eth.Contract(artifact.abi, address);
  const gas = new BN(await ContractWeb3.methods[method](...arguments, ).estimateGas(options))
  const gasPrice = new BN(await web3Latest.eth.getGasPrice());
  console.log(`Gas estimation for ${artifact.contractName}.${method}:`, web3Latest.utils.fromWei(gas.mul(gasPrice).toString()), 'ether')
  return gas;
}

module.exports = {
  getWeb3,
  getDeployGas,
  getMethodGas,
  waitNBlocks,
  advanceBlock,
  increaseTime,
  increaseToTime,
  LoanState,
  latest,
  bigNums,
  getDaiProxy,
  getDai,
  getContracts,
  getS3Contracts,
  contractIsUpdated,
}