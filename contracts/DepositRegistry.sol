pragma solidity ^0.5.0;

import 'openzeppelin-solidity/contracts/ownership/Ownable.sol';
import 'openzeppelin-solidity/contracts/token/ERC20/ERC20.sol';

contract DepositRegistry is Ownable {
  mapping(address => bool) deposited;
  uint256 DEPOSIT_AMNT = 200;
  ERC20 token;

  event ProxyDepositCompleted(address indexed user);
  event UserDepositCompleted(address indexed user);
  event UserWithdrawnCompleted(address indexed user);

  constructor(address tokenAddress) public {
    token = ERC20(tokenAddress);
  }

  function depositFor(address _user) public {
    require(!deposited[_user], 'not again');
    uint256 remaining = token.allowance(_user, address(this));
    uint256 balance = token.balanceOf(_user);
    require(balance >= DEPOSIT_AMNT, 'no enough founds');
    require(remaining >= DEPOSIT_AMNT, 'not allowed');
    
    token.transferFrom(_user, address(this), DEPOSIT_AMNT);
    deposited[_user] = true;

    emit UserDepositCompleted(_user);
    emit ProxyDepositCompleted(msg.sender);
  }

  function withdraw(address to) public {
    require(deposited[msg.sender], 'you are not in');
    uint256 balance = token.balanceOf(address(this));
    require(balance >= DEPOSIT_AMNT, 'no enough founds');
    token.transfer(to, DEPOSIT_AMNT);

    emit UserWithdrawnCompleted(to);
  }
  function hasDeposited(address user) public view returns (bool) {
    return deposited[user];
  }
}