const {LoanState, increaseToTime, waitNBlocks, getDai, getDaiProxy} = require('../helpers');
const LoanContract = require('../../build/contracts/LoanContract.json')

const faker = require('faker');
const { mapSeries } = require('bluebird');
const BigNumber = require('bignumber.js');

const bnToBigNumber = (bn) => new BigNumber(bn.toString());



function sample(items) {
    return items[items.length * Math.random() | 0];
}

async function findLender(lenders, loan) {
    return lenders.find(async lender => {
        const lenderBalance = async (l) => loan.methods.lenderBidAmount(l).call({from: l});
        const isLender = (await lenderBalance(lender)).gt('0');
        return isLender;
    })
}

async function lendersBidAuction(loans, lenders, web3) {
    const { toWei, fromWei } = web3.utils;
    const daiProxy = await getDaiProxy(web3);
    await mapSeries(loans, async (loan) => {
        const fullAmount = Number(fromWei(await loan.methods.maxAmount().call(), 'ether'));
        // 70% of making a full loan
        const amount = Math.random() <= 0.70 ? fullAmount : fullAmount * 0.5;
        const randomLender = sample(lenders);
        return daiProxy.methods.fund(loan._address, toWei(amount.toString())).send({gas: 8000000, from: randomLender})
    });
};

async function mayBorrowerWithdraw(loans) {
    await mapSeries(loans, async (loan) => {
        const borrower = await loan.methods.originator().call();
        const loanState = await loan.methods.currentState().call();
        const loanWithdrawn = await loan.methods.loanWithdrawn().call();
        if (LoanState(loanState) == 'ACTIVE' && !loanWithdrawn) {
            return loan.methods.withdrawLoan().send({from: borrower});
        }
    });
};

async function mayBorrowerPay(loans, web3) {
    const daiProxy = await getDaiProxy(web3)
    await mapSeries(loans, async (loan) => {
        const borrower = await loan.methods.originator().call();
        const borrowerDebt = await loan.methods.borrowerDebt().call();
        const loanWithdrawn = await loan.methods.loanWithdrawn().call();
        // 60% borrowers will pay
        if (loanWithdrawn && Math.random() <= 0.60) {
            return daiProxy.methods.repay(loan._address, borrowerDebt).send({gas: 8000000, from: borrower})
        }
    });
};
async function mayLenderWithdraw(loans, lenders) {
    await mapSeries(loans, async (loan) => {
        const lender = await findLender(lenders, loan);
        const loanState = await loan.methods.currentState().call();
        if (!!lender && LoanState(loanState) == 'REPAID' && Math.random() <= 0.60) {
            return loan.methods.withdrawRepayment().send({from: lender});
        }
        return;
    });
};

const instantiateContract = (web3, abi, address) => {
    return new web3.eth.Contract(abi, address);
}

const callAll = async (contracts, method) => {
    const promiseMap = () => contracts.map(async contract => contract.methods[method]().call());
    return Promise.all(promiseMap());
}

const callAndAddress = async (contracts, method) => {
    const promiseMap = () => contracts.map(async contract => {
        const value = await contract.methods[method]().call();
        const address = contract._address;
        return ({value, address})
    });
    return Promise.all(promiseMap());
}

const sendAll = async (contracts, method, args) => {
    const promiseMap = () => contracts.map(async contract => contract.methods[method]().send(args));
    return Promise.all(promiseMap());
}

const reportAuctionEndings = (min, max) => {
    console.log('Auctions End Block:');
    console.log('- Min:', min);
    console.log('- Max:', max);
}

const reportStatus = async (loans) => {
    const loanStatuses = await callAndAddress(loans, 'currentState');
    const statusCount = loanStatuses.reduce((acc, {value, address}) => {
        const path = LoanState(value);
        if (!acc[path]) {
            acc[path] = {
                count: 0,
                contracts: []
            }
        }
        acc[path] = {
            count: (acc[path].count || 0) + 1,
            contracts: [...acc[path].contracts, ...[address]]
        }

        return acc;
    }, {})
    console.log('Report: ', JSON.stringify(statusCount, null, 2));
}

const randomLoansMutator = async (web3, loansAddresses) => {
    const owner = (await web3.eth.getAccounts())[0]
    const lenders = (await web3.eth.getAccounts()).slice(0, 1);
    const loans = loansAddresses.map(address => instantiateContract(web3, LoanContract.abi, address));
    const loanBlockEndings = await callAll(loans, 'auctionEndBlock');
    const minAuctionEnd = Number(BigNumber.minimum(...(loanBlockEndings.map(bnToBigNumber))));
    const maxAuctionEnd = Number(BigNumber.maximum(...(loanBlockEndings.map(bnToBigNumber))));
    reportAuctionEndings(minAuctionEnd, maxAuctionEnd);
    // First pass blocks so interest raises and some auctions could close prior investing
    const minesToBlock = faker.random.number({min: minAuctionEnd, max: maxAuctionEnd * 0.9}) - (await web3.eth.getBlockNumber())
    console.log('\nBlock to mine:', minesToBlock);
    await waitNBlocks(web3, minesToBlock);
    console.log('\nLenders bidding...')
    await lendersBidAuction(loans, lenders, web3);
    // Past more blocks and close auctions
    console.log('Borrowers withdrawn...')
    await mayBorrowerWithdraw(loans);
    // Maybe borrowers pay in time   
    console.log('Borrowers repay...')
    await mayBorrowerPay(loans, web3);
    // Maybe lenders get their bucks + interest
    console.log('Lenders withdraw...')
    await mayLenderWithdraw(loans, lenders);
    // Pass the time so some loans move to DEFAULTED or CLOSED state
    const targetTimestamp = BigNumber.maximum(...(await callAll(loans, 'termEndTimestamp')).map(bnToBigNumber)); 
    const maxTimestamp = web3.utils.toBN((BigNumber.sum(targetTimestamp, "1000")).toString());
    console.log('Target timestamp', new Date(Number(maxTimestamp) * 1000));
    await increaseToTime(web3, maxTimestamp);
    const time = new Date((await web3.eth.getBlock('latest')).timestamp * 1000)
    console.log('Current time:', time)
    await sendAll(loans, 'updateStateMachine', { from: owner});
    console.log('Updated all contract status') 
    // Print report in console
    await reportStatus(loans);
}

module.exports = {
    randomLoansMutator
}