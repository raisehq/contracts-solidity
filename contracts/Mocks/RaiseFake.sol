pragma solidity 0.5.12;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

contract RaiseFake is ERC20Mintable {
    using SafeMath for uint256;
    string public constant name = "DAI Fake Token";
    string public constant symbol = "DAIF";
    uint8 public constant decimals = 18;

    constructor() public {
        super.mint(msg.sender, 1000000000 ether);
    }

    function mintTokens(address destinationAddress) public {
        super.mint(destinationAddress, 1000000000 ether);
    }
}
