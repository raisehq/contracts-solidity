module.exports = {
  // mine blocks so it passes "time"
  waitNBlocks: async n => {
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
};
