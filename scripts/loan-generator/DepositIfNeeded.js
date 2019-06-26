const HeroToken = require('../../build/contracts/HeroOrigenToken.json');
const DepositRegistry = require('../../build/contracts/DepositRegistry.json');

const depositIfNeeded = async (web3) => {
  const id = await web3.eth.net.getId();
  const accounts = await web3.eth.getAccounts();
  const Hero = new web3.eth.Contract(HeroToken.abi, HeroToken.networks[id].address);
  const Deposit = new web3.eth.Contract(DepositRegistry.abi, DepositRegistry.networks[id].address);

  console.log('~ Check HERO Deposits')

  for (const account of accounts) {
    const didDeposited = await Deposit.methods.hasDeposited(account).call();
    if (!didDeposited) {
        await Hero.methods.approve(Deposit._address, web3.utils.toWei('200')).send({from: account});
        await Deposit.methods.depositFor(account).send({from: account});
        const isDeposited = await Deposit.methods.hasDeposited(account).call();
        if (isDeposited) {
            console.log(`  Deposited 200 HERO from ${account}`);
        } else {
            console.log(`  Error depositing 200 HERO from ${account}`);
        }
    }
  }
}
module.exports = {
    depositIfNeeded
}