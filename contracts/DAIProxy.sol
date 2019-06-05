// pragma solidity ^0.5.0;

// import './DAI.sol';
// import './Authorization.sol';

// contract DAIProxy {
//     DAI DAIToken;
//     Authorization auth;

//     modifier onlyKYCCanDeposit {
//         require(auth.isKYCConfirmed(msg.sender), 'user does not have KYC');
//         _;
//     }

//     constructor(address authAddress, uint256 tokenId) public {
//         auth = Authorization(authAddress);
//         DAIToken = DAI(tokenId); // not shure this is right
//     }

//     function fund(address loanAddress, address lender, uint256 fundingAmount) public onlyKYCCanDeposit {
//         require(DAIToken.approve(lender, fundingAmount), 'funding not approved'); // is this needed?
//         uint256 balance = DAIToken.balanceOf(lender);
//         require(balance >= fundingAmount, 'Not enough founds');
//         DAIToken.transferFrom(lender, loanAddress, fundingAmount);

//         emit DAIToken.Funded(lender, loanAddress, fundingAmount);
//     }

//     // isn't this the same as fund???
//     function repay(address loanAddress, address originator, uint256 repaymentAmount) public {
//         require(DAIToken.approve(originator, repaymentAmount), 'funding not approved'); // is this needed?
//         uint256 balance = DAIToken.balanceOf(loanAddress);
//         require(balance >= repaymentAmount, 'Not enough founds');
//         DAIToken.transferFrom(originator, loanAddress, repaymentAmount);

//         emit DAIToken.Funded(originator, loanAddress, repaymentAmount);
//     }
// }
