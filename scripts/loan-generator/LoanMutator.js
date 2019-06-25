const {increaseToTime, waitNBlocks} = require('../helpers');
const LoanContract = require('../../build/contracts/LoanContract.json')
const DaiProxy = require('../../build/contracts/DAIProxy.json');
const faker = require('faker');

async function getDaiProxy(web3) {
    const currentNetworkId = await web3.eth.net.getId();
    return new web3.eth.Contract(DaiProxy.abi, DaiProxy.networks[currentNetworkId].address)
}

function sample(items) {
    return items[items.length * Math.random() | 0];
}

async function lendersBidAuction(loans, web3) {
    const { toWei, fromWei } = web3.utils;
    const daiProxy = await getDaiProxy(web3);
    const lenders = (await web3.eth.getAccounts()).slice(0, 1);
    const promiseMap = loans.map(async loan => {
        const fullAmount = Number(fromWei((await loan.methods.maxAmount().call()), 'ether'));
        const amount = Math.random() <= 0.70 ? fullAmount : fullAmount * 0.5;
        const randomLender = sample(lenders);
        return daiProxy.methods.fund(loan._address, toWei(amount.toString())).send({from: randomLender});
    })
    return Promise.all(promiseMap);
};

async function mayBorrowerWithdraw() {};
async function mayBorrowerPay() {};
async function mayLenderWithdraw(){};

const instantiateContract = (web3, abi, address) => {
    return new web3.eth.Contract(abi, address);
}

const callAll = async (contracts, method) => {
    const promiseMap = contracts.map(async contract => contract.methods[method]().call());
    return Promise.all(promiseMap);
}

const sendAll = async (contracts, method) => {
    const promiseMap = contracts.map(async contract => contract.methods[method]().send());
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
        acc[current] = (acc[current] || 0) + 1;
        return acc;
    }, {})
    console.log('Report: ', statusCount);
}

const randomLoansMutator = async (web3, loansAddresses) => {
    const loans = loansAddresses.map(address => instantiateContract(web3, LoanContract.abi, address));
    const loanBlockEndings = await callAll(loans, 'auctionEndBlock');
    const minAuctionEnd = Math.min(...loanBlockEndings);
    const maxAuctionEnd = Math.max(...loanBlockEndings);
    reportAuctionEndings(minAuctionEnd, maxAuctionEnd);
    // First pass blocks so interest raises and some auctions could close prior investing
    await waitNBlocks(web3, faker.random.number({min: minAuctionEnd * 1.01, max: maxAuctionEnd * 0.9}) - (await web3.eth.getBlockNumber()));
    await lendersBidAuction(loans, web3);
    // Past more blocks and close auctions
    const blocksToCloseAuctions = maxAuctionEnd - (await web3.eth.getBlockNumber()) + 1
    // Maybe borrowers takes the money
    await mayBorrowerWithdraw();
    // Maybe borrowers pay in time   
    await mayBorrowerPay();
    // Maybe lenders get their bucks + interest
    await mayLenderWithdraw();
    // Pass the time so some loans move to DEFAULTED or CLOSED state
    const maxTimestamp = Math.max(...(await callAll(loans, 'termEndTimestamp'))); 
    await increaseToTime(web3, maxTimestamp);
    await sendAll(loans, 'updateStateMachine');
    
    // Print report in console
    await reportStatus(loans);
}

module.exports = {
    randomLoansMutator
}