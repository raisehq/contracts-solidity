const { getDai, getDaiProxy, bigNums } = require('../helpers.js');

async function infiniteApproveDaiProxy (web3, from) {
    const DAI = await getDai(web3)
    const DAIProxy = await getDaiProxy(web3)
    return DAI.methods.approve(DAIProxy._address, bigNums.maxUint).send({from});
}

async function approveCurrentAccounts(web3) {
    const accounts = await web3.eth.getAccounts();
    await Promise.all(accounts.map(acc => infiniteApproveDaiProxy(web3, acc)))
}

module.exports = {
    infiniteApproveDaiProxy,
    approveCurrentAccounts
}
