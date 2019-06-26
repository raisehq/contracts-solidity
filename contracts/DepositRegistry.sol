pragma solidity ^0.5.0;

import 'openzeppelin-solidity/contracts/ownership/Ownable.sol';
import 'openzeppelin-solidity/contracts/token/ERC20/ERC20.sol';

contract DepositRegistry is Ownable {
  mapping(address => bool) deposited;
  uint256 DEPOSIT_AMNT = 200000000000000000000;
  ERC20 token;

  event ProxyDepositCompleted(address indexed user);
  event UserDepositCompleted(address indexed user);
  event UserWithdrawnCompleted(address indexed user);

  constructor(address tokenAddress) public {
    token = ERC20(tokenAddress);
  }

  function depositFor(address from) public {
    require(deposited[from] == false, 'alredy deposited');
    require(token.allowance(from, address(this)) >= DEPOSIT_AMNT, 'address not approved amount');

    deposited[from] = true;
    token.transferFrom(from, address(this), DEPOSIT_AMNT);

    emit UserDepositCompleted(from);
    emit ProxyDepositCompleted(from);
  }

  function withdraw(address to) public {
    require(deposited[to], 'address not deposited');
    deposited[to] = false;
    token.transfer(to, DEPOSIT_AMNT);
    emit UserWithdrawnCompleted(to);
  }
  function hasDeposited(address user) public view returns (bool) {
    return deposited[user];
  }
}