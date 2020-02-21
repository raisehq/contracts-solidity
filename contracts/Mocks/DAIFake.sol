pragma solidity 0.5.12;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

contract DAIFake is ERC20Mintable {
    using SafeMath for uint256;
    string public constant NAME = "DAI Fake Token";
    string public constant SYMBOL = "DAIFake";
    uint8 public constant DECIMALS = 18;

    // 1000 tokens == 1000000000000000000000 in 18 decimal (Like wei)
    constructor() public {
        super.mint(msg.sender, 1000000000 ether);
    }

    function transferFakeDAITokens(address destinationAddress) public {
        super.mint(destinationAddress, 1000000000 ether);
    }

    function transferAmountToAddress(address to, uint256 amount) public {
        super.mint(to, amount);
    }

    function mintTokens(address destinationAddress) public {
        super.mint(destinationAddress, 1000000000 ether);
    }
}
