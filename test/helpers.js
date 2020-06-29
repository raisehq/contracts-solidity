const {promisify} = require("util");
const {toWei, fromWei, BN} = web3.utils;

async function waitNBlocks(n) {
  await Promise.all(
    [...Array(n).keys()].map(i => {
      web3.currentProvider.send(
        {
          jsonrpc: "2.0",
          method: "evm_mine",
          id: i
        },
        () => {}
      );
    })
  );
}

function advanceBlock() {
  return promisify(web3.currentProvider.send.bind(web3.currentProvider))({
    jsonrpc: "2.0",
    method: "evm_mine"
  });
}

// Increase the timestamp in local blockchain, duration param in seconds
async function increaseTime(duration) {
  if (!BN.isBN(duration)) {
    duration = new BN(duration);
  }

  if (duration.isNeg()) throw Error(`Cannot increase time by a negative amount (${duration})`);

  await promisify(web3.currentProvider.send.bind(web3.currentProvider))({
    jsonrpc: "2.0",
    method: "evm_increaseTime",
    params: [duration.toNumber()]
  });

  await advanceBlock();
}

async function increaseToTime(target) {
  if (!BN.isBN(target)) {
    target = new BN(target);
  }

  const now = await latest();

  if (target.lt(now))
    throw Error(`Cannot increase current time (${now}) to a moment in the past (${target})`);
  const diff = target.sub(now);
  return increaseTime(diff);
}

// Convenience constants for commonly-used or difficult to remember bignum values
// Source: compound https://github.com/compound-finance/compound-money-market/blob/241541a62d0611118fb4e7eb324ac0f84bb58c48/test/Utils.js#L24
const bigNums = {
  // 2^256 - 1  http://www.wolframalpha.com/input/?i=2%5E256+-+1
  maxUint: "115792089237316195423570985008687907853269984665640564039457584007913129639935"
};

const calculatePendingDebt = (netLoan, totalDebt) => totalDebt.sub(netLoan);
const calculateNetLoan = (principal, loanPercentFee) =>
  principal.sub(principal.mul(loanPercentFee).div(toWei(new BN("100", 10))));

const extractReceipt = function(message) {
  console.log(message);
  const receiptString = message.split("the EVM:")[1].trim();
  return JSON.parse(receiptString);
};

const revertToSnapShotId = id => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "evm_revert",
        params: [id],
        id: new Date().getTime()
      },
      (err, result) => {
        if (err) {
          return reject(err);
        }
        return resolve(result);
      }
    );
  });
};

const revertToSnapShot = async id => {
  const response = await revertToSnapShotId(id);
  await advanceBlock();
  return response;
};

const takeSnapshot = () => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "evm_snapshot",
        params: [],
        id: new Date().getTime()
      },
      async (err, snapshotId) => {
        if (err) {
          return reject(err);
        }
        await advanceBlock();
        return resolve(snapshotId);
      }
    );
  });
};

module.exports = {
  waitNBlocks,
  advanceBlock,
  increaseTime,
  increaseToTime,
  bigNums,
  calculatePendingDebt,
  calculateNetLoan,
  extractReceipt,
  revertToSnapShot,
  takeSnapshot
};
