pragma solidity ^0.5.0;


import 'openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol';
import 'openzeppelin-solidity/contracts/math/SafeMath.sol';


contract HeroFakeToken is MintableToken {
    using SafeMath for uint256;
    string public constant name = "Hero Fake Token";
    string public constant symbol = "HEROFake";
    uint8 public constant decimals = 18;

    mapping(address => uint256) balances;

    constructor() public {
        balances[msg.sender] = 1000000000;
    }

    function transferFakeHeroTokens(address destinationAddress) public {
        balances[destinationAddress] = 10000;
    }
}