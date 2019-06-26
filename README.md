# HeroToken Smart Contract

HeroToken Smart Contract

## Generate N test loans
First migrate contracts in your local blockchain:

`npx truffle migrate --network ganache` or `npx truffle migrate` while `npx truffle dev` is open

Once migrated run the script via truffle, by default creates 10 loans, you can set the number of loans with `NUMBER_LOANS` env variable:
`NUMBER_LOANS=200 npx truffle exec scripts/loan-generator/main.js --network ganache`
