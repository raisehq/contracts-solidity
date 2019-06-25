const { promisify } = require('util');

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
  const BN = web3.utils.BN;
  if (!BN.isBN(target)) {
    target = new BN(target);
  }

  const now = (await latest());

  if (target.lt(now)) throw Error(`Cannot increase current time (${now}) to a moment in the past (${target})`);
  const diff = target.sub(now);
  return increase(diff);
}

module.exports = {
  waitNBlocks,
  advanceBlock,
  increaseTime,
  increaseToTime
}