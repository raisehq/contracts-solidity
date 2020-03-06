pragma solidity 0.5.12;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

contract USDT is ERC20Mintable {
    using SafeMath for uint256;
    string public constant name = "USDT Fake Token";
    string public constant symbol = "USDT";
    uint8 public constant decimals = 18;

    constructor() public {
        // super.mint(msg.sender, 10000000);
    }

    function transferFakeHeroTokens(address destinationAddress) public {
        super.mint(destinationAddress, 200000000000000000000);
    }

    function transferAmountToAddress(address to, uint256 amount) public {
        super.mint(to, amount);
    }
}
