pragma solidity ^0.5.0;

import '../installed_contracts/zeppelin/contracts/ownership/Ownable.sol';
import '../installed_contracts/zeppelin/contracts/token/ERC20.sol';

contract HeroToken is ERC20 {}

contract DepositRegistry is Ownable {
  mapping(address => bool) deposited;
  UINT256 DEPOSIT_AMNT = 200;
  HeroToken token;

  event Deposited(address indexed user);
  event Withdrawn(address indexed user);

  constructor(address tokenAddress) public {
    token = HeroToken(tokenAddress);
  }
  function deposit() public {
    require(!deposited[msg.sender], 'not again');
    remaining = token.allowance(msg.sender, address(this));
    balance = token.balanceOf(msg.sender);
    require(balance >= DEPOSIT_AMNT, 'no enough founds');
    require(remaining >= DEPOSIT_AMNT, 'not allowed');
    token.transferFrom(msg.sender, address(this), DEPOSIT_AMNT);
    deposited[msg.sender] = true;

    emit Deposited(msg.sender);
  }
  function withdraw(address to) public onlyDeposited {
    require(deposited[msg.sender], 'you are not in');
    balance = token.balanceOf(address(this));
    require(balance >= DEPOSIT_AMNT, 'no enough founds');
    token.transfer(to, DEPOSIT_AMNT);

    emit Withdrawn(to);
  }
  function hasDeposited(address user) public view returns (bool) {
    return deposited[user];
  }
}