const {LoanState, increaseToTime, waitNBlocks} = require('../helpers');
const LoanContract = require('../../build/contracts/LoanContract.json')
const DaiProxy = require('../../build/contracts/DAIProxy.json');
const DaiFake = require('../../build/contracts/DAIFake.json');
const faker = require('faker');
const { mapSeries } = require('bluebird');
const BigNumber = require('bignumber.js');

const bnToBigNumber = (bn) => new BigNumber(bn.toString());

async function getDaiProxy(web3) {
    const currentNetworkId = await web3.eth.net.getId();
    return new web3.eth.Contract(DaiProxy.abi, DaiProxy.networks[currentNetworkId].address)
}

async function getDai(web3) {
    const currentNetworkId = await web3.eth.net.getId();
    return new web3.eth.Contract(DaiFake.abi, DaiFake.networks[currentNetworkId].address)
}

function sample(items) {
    return items[items.length * Math.random() | 0];
}

async function lendersBidAuction(loans, web3) {
    const { toWei, fromWei } = web3.utils;
    const daiProxy = await getDaiProxy(web3);
    const dai = await getDai(web3);
    const lenders = (await web3.eth.getAccounts()).slice(0, 1);
    await mapSeries(loans, async (loan) => {
        const fullAmount = Number(fromWei(await loan.methods.maxAmount().call(), 'ether'));
        // 70% of making a full loan
        const amount = Math.random() <= 0.70 ? fullAmount : fullAmount * 0.5;
        const randomLender = sample(lenders);
        await dai.methods.approve(daiProxy._address, toWei(amount.toString())).send({from: randomLender});
        return daiProxy.methods.fund(loan._address, toWei(amount.toString())).send({gas: 8000000, from: randomLender})
    });
};

async function mayBorrowerWithdraw() {
    await mapSeries(loans, async (loan) => {
        const borrower = await loan.methods.originator().call();
        // 70% borrowers will withdraw
        return Math.random() <= 0.70 ? loan.methods.withdrawLoan().send({from: borrower}) : '';
    });
};

async function mayBorrowerPay() {
    await mapSeries(loans, async (loan) => {
        const borrower = await loan.methods.originator().call();
        const borrowerDebt = await loan.methods.borrowerDebt().call();
        return daiProxy.methods.repay(loan._address, toWei(borrowerDebt.toString())).send({gas: 8000000, from: borrower})
    });
};
async function mayLenderWithdraw(){
    await mapSeries(loans, async (loan) => {
        const borrower = await loan.methods.originator().call();
        // 70% borrowers will withdraw
        return Math.random() <= 0.70 ? loan.methods.withdrawLoan().send({from: borrower}) : '';
    });
};

const instantiateContract = (web3, abi, address) => {
    return new web3.eth.Contract(abi, address);
}

const callAll = async (contracts, method) => {
    const promiseMap = contracts.map(async contract => contract.methods[method]().call());
    return Promise.all(promiseMap);
}

const sendAll = async (contracts, method, args) => {
    const promiseMap = contracts.map(async contract => contract.methods[method]().send(args));
    return Promise.all(promiseMap);
}

const reportAuctionEndings = (min, max) => {
    console.log('Auctions End Block:');
    console.log('- Min:', min);
    console.log('- Max:', max);
}

const reportStatus = async (loans) => {
    const loanStatuses = await callAll(loans, 'currentState');
    const statusCount = loanStatuses.reduce((acc, current) => {
        acc[LoanState(current)] = (acc[LoanState(current)] || 0) + 1;
        return acc;
    }, {})
    console.log('Report: ', statusCount);
}

const randomLoansMutator = async (web3, loansAddresses) => {
    const owner = (await web3.eth.getAccounts())[0]
    const loans = loansAddresses.map(address => instantiateContract(web3, LoanContract.abi, address));
    const loanBlockEndings = await callAll(loans, 'auctionEndBlock');
    const minAuctionEnd = Number(BigNumber.minimum(...(loanBlockEndings.map(bnToBigNumber))));
    const maxAuctionEnd = Number(BigNumber.maximum(...(loanBlockEndings.map(bnToBigNumber))));
    reportAuctionEndings(minAuctionEnd, maxAuctionEnd);
    // First pass blocks so interest raises and some auctions could close prior investing
    const minesToBlock = faker.random.number({min: minAuctionEnd, max: maxAuctionEnd * 0.9}) - (await web3.eth.getBlockNumber())
    console.log('Block to mine:', minesToBlock);
    await waitNBlocks(web3, minesToBlock);
    await lendersBidAuction(loans, web3);
    // Past more blocks and close auctions
    await mayBorrowerWithdraw();
    // Maybe borrowers pay in time   
    await mayBorrowerPay();
    // Maybe lenders get their bucks + interest
    await mayLenderWithdraw();
    // Pass the time so some loans move to DEFAULTED or CLOSED state
    const maxTimestamp = web3.utils.toBN(BigNumber.maximum(...(await callAll(loans, 'termEndTimestamp')).map(bnToBigNumber)).toString()); 
    console.log('  Last timestamp', new Date(Number(maxTimestamp) * 1000));
    await increaseToTime(web3, maxTimestamp);
    await sendAll(loans, 'updateStateMachine', { from: owner});
    
    // Print report in console
    await reportStatus(loans);
}

module.exports = {
    randomLoansMutator
}