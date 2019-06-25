const { promisify } = require('util');

const LoanState = (i) => [
  'CREATED', // accepts bids until timelimit initial state
  'FAILED_TO_FUND', // not fully funded in timelimit
  'ACTIVE', // fully funded, inside timelimit
  'DEFAULTED', // not repaid in time loanRepaymentLength
  'REPAID', // the borrower repaid in full, lenders have yet to reclaim funds
  'CLOSED' // from failed_to_fund => last lender to withdraw triggers change / from repaid => fully witdrawn by lenders
][i]

async function waitNBlocks(web3, n) {
    await Promise.all(
        [...Array(n).keys()].map(i => {
            web3.currentProvider.send({
                jsonrpc: '2.0',
                method: 'evm_mine',
                id: i
                }, ()=> {});
        })
    );
}

async function latest(web3) {
  const now = web3.utils.toBN((await web3.eth.getBlock('latest')).timestamp)
  return now;
}

function advanceBlock(web3) {
  return promisify(web3.currentProvider.send.bind(web3.currentProvider))({
    jsonrpc: '2.0',
    method: 'evm_mine',
  });
}

// Increase the timestamp in local blockchain, duration param in seconds
async function  increaseTime(web3, duration) {
    const BN = web3.utils.BN;
    if (!BN.isBN(duration)) {
      duration = new BN(duration);
    }
  
    if (duration.isNeg()) throw Error(`Cannot increase time by a negative amount (${duration})`);
  
    await promisify(web3.currentProvider.send.bind(web3.currentProvider))({
      jsonrpc: '2.0',
      method: 'evm_increaseTime',
      params: [duration.toNumber()],
    });
  
    await advanceBlock(web3);
}

async function increaseToTime(web3, target) {
  if (!web3.utils.isBN(target)) {
    target = new web3.utils.BN(target);
  }

  const now = await latest(web3);
  console.log('target', new Date(Number(target) * 1000))
  console.log('now', new Date(Number(now) * 1000))
  if (target.lt(now)) throw Error(`Cannot increase current time (${now}) to a moment in the past (${target})`);
  const diff = target.sub(now);
  return increaseTime(web3, diff);
}

module.exports = {
  waitNBlocks,
  advanceBlock,
  increaseTime,
  increaseToTime,
  LoanState,
  latest
}