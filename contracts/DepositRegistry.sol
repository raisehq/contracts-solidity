pragma solidity ^0.5.0;

import 'openzeppelin-solidity/contracts/ownership/Ownable.sol';
import 'openzeppelin-solidity/contracts/token/ERC20/ERC20.sol';

contract DepositRegistry is Ownable {
  mapping(address => bool) deposited;
  uint256 DEPOSIT_AMNT = 200;
  ERC20 token;

  event Deposited(address indexed user);
  event Withdrawn(address indexed user);

  constructor(address tokenAddress) public {
    token = ERC20(tokenAddress);
  }
  function deposit() public {
    require(!deposited[msg.sender], 'not again');
    uint256 remaining = token.allowance(msg.sender, address(this));
    uint256 balance = token.balanceOf(msg.sender);
    require(balance >= DEPOSIT_AMNT, 'no enough founds');
    require(remaining >= DEPOSIT_AMNT, 'not allowed');
    token.transferFrom(msg.sender, address(this), DEPOSIT_AMNT);
    deposited[msg.sender] = true;

    emit Deposited(msg.sender);
  }
  function withdraw(address to) public {
    require(deposited[msg.sender], 'you are not in');
    uint256 balance = token.balanceOf(address(this));
    require(balance >= DEPOSIT_AMNT, 'no enough founds');
    token.transfer(to, DEPOSIT_AMNT);

    emit Withdrawn(to);
  }
  function hasDeposited(address user) public view returns (bool) {
    return deposited[user];
  }
}