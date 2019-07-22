# Hero Smart Contracts

This repo contains the set of smart contracts that provide the foundations for the Hero marketplace.

### Deployed contracts

Contracts are currently only available on the Kovan testnet. The latest addresses are available here: 

http://blockchain-definitions.s3-website-eu-west-1.amazonaws.com/v1/contracts.json

The Kovan migration script will also deploy fake DAI and HERO tokens to support testing. 

## Supported use cases

The contracts support the following use cases:

* Creating loan requests and pricing them via a dutch auction process -> `contracts/LoanContractDispatcher.sol` and `contracts/LoanContract.sol`
* Tracking Hero membership eligibility -> `contracts/Authorization.sol`
* Allowing the Hero loan contracts to interact with DAI -> `contracts/DAIProxy.sol`
* Hero members referring others in exchange for token rewards -> `contracts/ReferralTracker.sol`

### Hero membership deposits

As per the original [whitepaper](https://s3-ap-southeast-1.amazonaws.com/herotoken/Hero+Whitepaper_111617.pdf), lenders need to deposit 200 HERO tokens in order to be able to invest on the marketplace.

These deposits are held in the `DepositRegistry` contract and will be withdrawable at any time provided members have verified their accounts on the Hero platform. This will be chaned in the future to allow a more flexible scheme should user fail to complete the verification process.

Withdrawing membership deposits will effectively waive the lender's right to operate on the platform; no new investments will be possible although open positions still settle normally.

## Architecture

The interactions between each contract are depicted here:

https://drive.google.com/open?id=1eW3AXcncLX0K-LFvi_fq9fbtviTMEdF5

### Minimum viable decentralization

Even through each loan will execute autonomously once created, the following actions still happen via a centrally controlled account:

* Authorizing a new lender on the marketplace by adding it to the `KYCRegistry`
* Establishing minimum and maximum amounts and interest rates for new loan requests
* Setting up the duration for a loan dutch auction
* Pausing the Hero referral program and adding funds to it

## Generate N test loans
First migrate contracts in your local blockchain:

`npx truffle migrate --network ganache` or `npx truffle migrate` while `npx truffle dev` is open

Once migrated run the script via truffle, by default creates 10 loans, you can set the number of loans with `NUMBER_LOANS` env variable:
`NUMBER_LOANS=200 npx truffle exec scripts/loan-generator/main.js --network ganache`

## Ledger Nano S migration guide

1. Connect your Ledger via USB to your computer.
2. Unlock your Ledger.
3. Change to the Ethereum app
4. At the Ethereum app, go to Options and set the following:
    - Contract data: Yes
    - Browser support: No
5. Check that your 0 index address have Ether in the network you will do the migration.
6. Run `npx truffle migrate --network NETWORK_ledger`, for example `npx truffle migrate --network kovan_ledger`
7. Proceed to confirm every transaction with your Ledger.

## Known issues and remaining work

* Ownership of defaulted loans isn't transferred to debt collection agents  
* tests and coverage need to be added to CI
