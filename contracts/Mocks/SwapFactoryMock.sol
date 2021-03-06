pragma solidity 0.5.12;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "../interfaces/ISwapAndDeposit.sol";
import "../interfaces/ISwapAndDepositFactory.sol";
import "../interfaces/IAuthorization.sol";
import "../CloneFactory.sol";

contract SwapFactoryMock is ISwapAndDepositFactory, CloneFactory, Ownable {
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

    function deploy() external returns (address) {
        require(authAddress != address(0), "auth must be set");
        address depositAddress = IAuthorization(authAddress).getDepositAddress();
        require(libraryAddress != address(0), "library must be set");
        require(uniswapAddress != address(0), "uniswap must be set");
        require(depositAddress != address(0), "deposit must be set");
        address proxyAddress = createClone(libraryAddress);
        require(
            ISwapAndDeposit(proxyAddress).init(depositAddress, uniswapAddress),
            "Failed to init"
        );

        emit NewSwapContract(proxyAddress);

        return proxyAddress;
    }

    function deployDoubleInitUniswap() external returns (address) {
        require(authAddress != address(0), "auth must be set");
        address depositAddress = IAuthorization(authAddress).getDepositAddress();
        require(libraryAddress != address(0), "library must be set");
        require(uniswapAddress != address(0), "uniswap must be set");
        require(depositAddress != address(0), "deposit must be set");
        address proxyAddress = createClone(libraryAddress);
        ISwapAndDeposit(proxyAddress).init(address(0), uniswapAddress);
        ISwapAndDeposit(proxyAddress).init(address(0), uniswapAddress);

        emit NewSwapContract(proxyAddress);

        return proxyAddress;
    }

    function deployNoInit() external returns (address) {
        require(authAddress != address(0), "auth must be set");
        address depositAddress = IAuthorization(authAddress).getDepositAddress();
        require(libraryAddress != address(0), "library must be set");
        require(uniswapAddress != address(0), "uniswap must be set");
        require(depositAddress != address(0), "deposit must be set");
        address proxyAddress = createClone(libraryAddress);
        emit NewSwapContract(proxyAddress);

        return proxyAddress;
    }

    function deployDoubleInitDeposit() external returns (address) {
        require(authAddress != address(0), "auth must be set");
        address depositAddress = IAuthorization(authAddress).getDepositAddress();
        require(libraryAddress != address(0), "library must be set");
        require(uniswapAddress != address(0), "uniswap must be set");
        require(depositAddress != address(0), "deposit must be set");
        address proxyAddress = createClone(libraryAddress);
        ISwapAndDeposit(proxyAddress).init(depositAddress, address(0));
        ISwapAndDeposit(proxyAddress).init(depositAddress, address(0));

        emit NewSwapContract(proxyAddress);

        return proxyAddress;
    }

    function isCloned(address target, address query) external view returns (bool result) {
        return isClone(target, query);
    }
}
