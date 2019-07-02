pragma solidity ^0.5.0;

import 'openzeppelin-solidity/contracts/ownership/Ownable.sol';
import 'openzeppelin-solidity/contracts/token/ERC20/ERC20.sol';
import './ReferralTracker.sol';
import './KYCRegistry.sol';

contract DepositRegistry is Ownable {
  mapping(address => bool) deposited;
  uint256 DEPOSIT_AMNT = 200000000000000000000;
  ERC20 token;

  KYCRegistry kyc;
  ReferralTracker ref;

  event ProxyDepositCompleted(address indexed user);
  event UserDepositCompleted(address indexed user);
  event UserWithdrawnCompleted(address indexed user);

  constructor(address tokenAddress, address kycAddress) public {
    token = ERC20(tokenAddress);
    kyc = KYCRegistry(kycAddress);
  }

  function setReferralTracker(address contractAddress) public onlyOwner {
    ref = ReferralTracker(contractAddress);
  }

  function depositFor(address from) public {
    require(deposited[from] == false, 'alredy deposited');
    require(token.allowance(from, address(this)) >= DEPOSIT_AMNT, 'address not approved amount');

    deposited[from] = true;
    token.transferFrom(from, address(this), DEPOSIT_AMNT);

    emit UserDepositCompleted(from);
    emit ProxyDepositCompleted(from);
  }

  function depositForWithReferral(address from, address referrer) public {
    require(deposited[from] == false, 'alredy deposited');
    require(token.allowance(from, address(this)) >= DEPOSIT_AMNT, 'address not approved amount');
    require(msg.sender == from, 'cannot deposit with a referral from another address');

    deposited[from] = true;
    token.transferFrom(from, address(this), DEPOSIT_AMNT);

    ref.registerReferral(referrer, msg.sender);

    emit UserDepositCompleted(from);
    emit ProxyDepositCompleted(from);
  }

  function withdraw(address to) public {
    require(deposited[msg.sender], 'address not deposited');
    require(kyc.isConfirmed(msg.sender), 'cannot withdraw without KYC');

    deposited[msg.sender] = false;
    token.transfer(to, DEPOSIT_AMNT);
    emit UserWithdrawnCompleted(msg.sender);
  }
  function hasDeposited(address user) public view returns (bool) {
    return deposited[user];
  }
}
