pragma solidity ^0.5.0;

import 'openzeppelin-solidity/contracts/token/ERC20/ERC20.sol';

contract DAI is ERC20 {
    function approve(address spender, uint256 value) public returns (bool) {}
    function transferFrom(address sender, address recipient, uint256 amount) public returns (bool) {}
    function transfer(address to, uint256 amount) public returns (bool) {}
    function balanceOf(address account) public returns (bool) {}
    function allowance(address owner, address spender) public returns (uint256) {}
    
    event Transfer(address indexed _from, address indexed _to, uint256 _value);
    event Approval(address indexed _owner, address indexed _spender, uint256 _value);

}