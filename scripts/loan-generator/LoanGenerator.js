const LoanDispatcherBuild = require('../../build/contracts/LoanContractDispatcher.json');
const faker = require('faker');


const repeatFunction = (times, fn, args) => Array(times).fill().map(x => fn(...args));

const getRandomLoanInput = (web3, minBlock) => {
    const {toWei} = web3.utils;
    const auctionBlockLength = faker.random.number({min: minBlock, max: minBlock + 100});
    const maxAmount = faker.random.number({min: 1000, max: 10000});
    const minAmount = maxAmount * 0.70;
    const bpMaxInterestRate = faker.random.number({min: 1000, max: 5000});
    const termEndTimestamp = Math.floor((new Date(faker.date.future(1)).getTime() / 1000));
    return [
        auctionBlockLength,
        toWei(minAmount.toString()),
        toWei(maxAmount.toString()),
        bpMaxInterestRate.toString(),
        termEndTimestamp
    ];
}

const deployRandomLoan = async (LoanDispatcher, web3, from, minAuctionBlock) => {
    const input = getRandomLoanInput(web3, minAuctionBlock);
    const deployMethod = LoanDispatcher.methods.deploy(...input);
    try {
        const tx = await deployMethod.send({ from, gas: 8000000 });
        return tx;
    } catch (err) {
        return err;
    }
}

const loanGenerator = async (numberLoans, web3) => {
    const minAuctionBlock = numberLoans + 10;
    const accounts = await web3.eth.getAccounts();
    const networkId = await web3.eth.net.getId();
    const blockPriorJob = await web3.eth.getBlockNumber() + 1;
    const LoanDispatcher = new web3.eth.Contract(LoanDispatcherBuild.abi, LoanDispatcherBuild.networks[networkId].address);
    const response = await Promise.all(
       repeatFunction(numberLoans, deployRandomLoan, [LoanDispatcher, web3, accounts[0], minAuctionBlock])
    );
    const createdLoans = (await LoanDispatcher.getPastEvents(
        'LoanContractCreated',
        {fromBlock: blockPriorJob, toBlock: 'latest'}
    )).map(x => x.returnValues);
    const errors = response.filter(x => x instanceof Error);
    
    return ({createdLoans, errors});
}
module.exports = {
    loanGenerator
}