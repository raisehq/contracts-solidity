pragma solidity 0.5.10;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./interfaces/ISwapAndDeposit.sol";
import "./interfaces/ISwapAndDepositFactory.sol";
import "./interfaces/IAuthorization.sol";
import "./CloneFactory.sol";

contract SwapAndDepositFactory is ISwapAndDepositFactory, CloneFactory, Ownable {
    address public libraryAddress;
    address public authAddress;
    address public uniswapAddress;

    event NewSwapContract(address proxyAddress);

    constructor(address _libraryAddress, address _authAddress, address _uniswapAddress) public {
        libraryAddress = _libraryAddress;
        authAddress = _authAddress;
        uniswapAddress = _uniswapAddress;
    }

    function setAuthAddress(address _authAddress) public onlyOwner {
        authAddress = _authAddress;
    }

    function setUniswapAddress(address _uniswapAddress) public onlyOwner {
        uniswapAddress = _uniswapAddress;
    }

    function setLibraryAddress(address _libraryAddress) public onlyOwner {
        libraryAddress = _libraryAddress;
    }

    function deploy() external returns (address proxyAddress) {
        require(authAddress != address(0), "auth must be set");
        address depositAddress = IAuthorization(authAddress).getDepositAddress();
        require(libraryAddress != address(0), "library must be set");
        require(uniswapAddress != address(0), "uniswap must be set");
        require(depositAddress != address(0), "deposit must be set");
        proxyAddress = createClone(libraryAddress);
        require(
            ISwapAndDeposit(proxyAddress).init(depositAddress, uniswapAddress),
            "Failed to init"
        );

        emit NewSwapContract(proxyAddress);

        return proxyAddress;
    }
}