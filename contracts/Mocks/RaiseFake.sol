pragma solidity 0.5.10;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

contract RaiseFake is ERC20Mintable {
    using SafeMath for uint256;
    string public constant NAME = "RAISE Fake Token";
    string public constant SYMBOL = "RAISEFake";
    uint8 public constant DECIMALS = 18;

    constructor() public {
        super.mint(msg.sender, 1000000000 ether);
    }

    function mintTokens(address destinationAddress) public {
        super.mint(destinationAddress, 1000000000 ether);
    }
}
