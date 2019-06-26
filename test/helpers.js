const { promisify } = require('util');
const BN = web3.utils.BN;

async function  waitNBlocks(n) {
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

function  advanceBlock() {
  return promisify(web3.currentProvider.send.bind(web3.currentProvider))({
    jsonrpc: '2.0',
    method: 'evm_mine',
  });
}

// Increase the timestamp in local blockchain, duration param in seconds
async function  increaseTime(duration) {
    if (!BN.isBN(duration)) {
      duration = new BN(duration);
    }
  
    if (duration.isNeg()) throw Error(`Cannot increase time by a negative amount (${duration})`);
  
    await promisify(web3.currentProvider.send.bind(web3.currentProvider))({
      jsonrpc: '2.0',
      method: 'evm_increaseTime',
      params: [duration.toNumber()],
    });
  
    await advanceBlock();
}

async function increaseToTime(target) {
  if (!BN.isBN(target)) {
    target = new BN(target);
  }

  const now = (await latest());

  if (target.lt(now)) throw Error(`Cannot increase current time (${now}) to a moment in the past (${target})`);
  const diff = target.sub(now);
  return increase(diff);
}

// Convenience constants for commonly-used or difficult to remember bignum values
// Source: compound https://github.com/compound-finance/compound-money-market/blob/241541a62d0611118fb4e7eb324ac0f84bb58c48/test/Utils.js#L24
const bigNums = {
  // 2^256 - 1  http://www.wolframalpha.com/input/?i=2%5E256+-+1
  maxUint: '115792089237316195423570985008687907853269984665640564039457584007913129639935'
};


module.exports = {
  waitNBlocks,
  advanceBlock,
  increaseTime,
  increaseToTime,
  bigNums
}
