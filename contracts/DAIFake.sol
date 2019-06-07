pragma solidity ^0.5.0;


import 'openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol';
import 'openzeppelin-solidity/contracts/math/SafeMath.sol';


contract DAIFake is ERC20Mintable {
    using SafeMath for uint256;
    string public constant name = "DAI Fake Token";
    string public constant symbol = "DAIFake";
    uint8 public constant decimals = 18;

    constructor() public {
        super.mint(msg.sender, 10000000);
    }

    function transferFakeDAITokens(address destinationAddress) public {
        super.mint(destinationAddress, 100000000);
    }

    function transferAmountToAddress(address to, uint256 amount) public {
        super.mint(to, amount);
    }
}