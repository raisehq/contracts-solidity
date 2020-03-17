pragma solidity 0.5.12;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

contract MockERC20 is ERC20Mintable {
    using SafeMath for uint256;
    string private _name;
    string private _symbol;
    uint8 private constant _decimals = 18;

    constructor(string memory name, string memory symbol) public {
        _name = name;
        _symbol = symbol;
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
    /**
     * @dev Returns the name of the token.
     */
    function name() public view returns (string memory) {
        return _name;
    }

    /**
     * @dev Returns the symbol of the token, usually a shorter version of the
     * name.
     */
    function symbol() public view returns (string memory) {
        return _symbol;
    }

    /**
     * @dev Returns the number of decimals used to get its user representation.
     * For example, if `decimals` equals `2`, a balance of `505` tokens should
     * be displayed to a user as `5,05` (`505 / 10 ** 2`).
     *
     * Tokens usually opt for a value of 18, imitating the relationship between
     * Ether and Wei.
     *
     * NOTE: This information is only used for _display_ purposes: it in
     * no way affects any of the arithmetic of the contract, including
     * {IERC20-balanceOf} and {IERC20-transfer}.
     */
    function decimals() public view returns (uint8) {
        return _decimals;
    }
}
