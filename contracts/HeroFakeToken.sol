pragma solidity ^0.5.0;


import 'openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol';
import 'openzeppelin-solidity/contracts/math/SafeMath.sol';


contract HeroFakeToken is ERC20Mintable {
    using SafeMath for uint256;
    string public constant name = "Hero Fake Token";
    string public constant symbol = "HEROFake";
    uint8 public constant decimals = 18;

    constructor() public {
        // super.mint(msg.sender, 10000000);
    }

    function transferFakeHeroTokens(address destinationAddress) public {
        super.mint(destinationAddress, 100000000);
    }
}